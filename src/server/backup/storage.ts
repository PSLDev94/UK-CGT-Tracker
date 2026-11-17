import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const BACKUP_MAX_AGE_MS = 26 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const RECEIPT_LIMIT = 2048;
const ARCHIVE_LIMIT = 4 * 1024 ** 3;
type Environment = "staging" | "production";
type Receipt = {
  version: 1;
  environment: Environment;
  archive: string;
  sha256: string;
  bytes: number;
  startedAt: string;
  verifiedAt: string;
};

export function backupStorage(env: Record<string, string | undefined>) {
  const endpoint = new URL(env.BACKUP_S3_ENDPOINT || "");
  if (
    endpoint.protocol !== "https:" ||
    !/^[a-f0-9]{32}(?:\.eu)?\.r2\.cloudflarestorage\.com$/.test(
      endpoint.hostname,
    ) ||
    endpoint.port ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/"
  )
    throw new Error("Expected private R2 endpoint");
  const bucket = env.BACKUP_S3_BUCKET;
  const environment = env.BACKUP_ENVIRONMENT;
  if (
    !bucket ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) ||
    (environment !== "staging" && environment !== "production") ||
    !env.BACKUP_S3_ACCESS_KEY_ID ||
    !env.BACKUP_S3_SECRET_ACCESS_KEY
  )
    throw new Error("Missing backup storage configuration");
  return {
    bucket,
    environment,
    client: new S3Client({
      endpoint: endpoint.href,
      region: "auto",
      maxAttempts: 3,
      credentials: {
        accessKeyId: env.BACKUP_S3_ACCESS_KEY_ID,
        secretAccessKey: env.BACKUP_S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}

function parseReceipt(
  value: unknown,
  environment: Environment,
  now: number,
): Receipt {
  if (!value || typeof value !== "object")
    throw new Error("Invalid backup receipt");
  const r = value as Receipt;
  const pattern = new RegExp(
    `^${environment}/\\d{4}-\\d{2}-\\d{2}/[a-f0-9-]{36}\\.cgtenc$`,
  );
  const started = Date.parse(r.startedAt);
  const verified = Date.parse(r.verifiedAt);
  if (
    r.version !== 1 ||
    r.environment !== environment ||
    typeof r.archive !== "string" ||
    !pattern.test(r.archive) ||
    typeof r.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.sha256) ||
    !Number.isSafeInteger(r.bytes) ||
    r.bytes <= 36 ||
    r.bytes > ARCHIVE_LIMIT ||
    !Number.isFinite(started) ||
    !Number.isFinite(verified) ||
    new Date(started).toISOString() !== r.startedAt ||
    new Date(verified).toISOString() !== r.verifiedAt ||
    verified < started ||
    verified > now ||
    verified - started > 60 * 60_000 ||
    r.archive.split("/")[1] !== r.startedAt.slice(0, 10)
  )
    throw new Error("Invalid backup receipt");
  return r;
}

async function digest(stream: AsyncIterable<Uint8Array>) {
  const hash = createHash("sha256");
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

/** A receipt exists only after a full readback of the encrypted archive. */
export async function uploadVerifiedBackup(
  input: {
    client: S3Client;
    bucket: string;
    environment: Environment;
    archive: string;
    file: string;
    bytes: number;
    startedAt: string;
  },
  clock: () => number = Date.now,
) {
  const { client, bucket, file } = input;
  const sha256 = await digest(createReadStream(file));
  const receipt = parseReceipt(
    {
      version: 1,
      environment: input.environment,
      archive: input.archive,
      bytes: input.bytes,
      startedAt: input.startedAt,
      verifiedAt: new Date(clock()).toISOString(),
      sha256,
    },
    input.environment,
    clock(),
  );
  const upload = createReadStream(file);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: receipt.archive,
        Body: upload,
        ContentLength: receipt.bytes,
        ContentType: "application/octet-stream",
        IfNoneMatch: "*",
        Metadata: { sha256, format: "CGTBKP01" },
      }),
      { abortSignal: AbortSignal.timeout(15 * 60_000) },
    );
  } finally {
    upload.destroy();
  }
  const copy = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: receipt.archive,
    }),
    { abortSignal: AbortSignal.timeout(15 * 60_000) },
  );
  // Drain the body even when the declared length differs, releasing the socket.
  const actual = copy.Body
    ? await digest(copy.Body as AsyncIterable<Uint8Array>)
    : null;
  if (copy.ContentLength !== receipt.bytes || actual !== sha256)
    throw new Error("Stored backup readback verification failed");
  receipt.verifiedAt = new Date(clock()).toISOString();
  parseReceipt(receipt, input.environment, clock());
  const body = JSON.stringify(receipt);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `${receipt.archive}.verified.json`,
      Body: body,
      ContentLength: Buffer.byteLength(body),
      ContentType: "application/json",
      IfNoneMatch: "*",
    }),
    { abortSignal: AbortSignal.timeout(30_000) },
  );
  return receipt;
}

/** Read-only freshness check. Does not replace decryption/restore rehearsals. */
export async function checkBackupFreshness(
  client: S3Client,
  bucket: string,
  environment: Environment,
  now = Date.now(),
) {
  if (!Number.isFinite(now)) throw new Error("Invalid check time");
  // Three UTC dates cover the 26-hour window, including across midnight.
  const names = new Set<string>();
  const signal = AbortSignal.timeout(60_000);
  for (let day = 0; day < 3; day++) {
    const prefix = `${environment}/${new Date(now - day * DAY_MS).toISOString().slice(0, 10)}/`;
    let token: string | undefined;
    const seenTokens = new Set<string>();
    for (let page = 0; ; page++) {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 100,
          ContinuationToken: token,
        }),
        { abortSignal: signal },
      );
      for (const object of result.Contents ?? []) {
        if (object.Key?.endsWith(".verified.json")) {
          if (!object.Key.startsWith(prefix))
            throw new Error("Unexpected receipt path");
          names.add(object.Key);
        }
      }
      if (names.size > 64)
        throw new Error("Backup receipt scan exceeded capacity");
      if (!result.IsTruncated) break;
      token = result.NextContinuationToken;
      if (page >= 3 || !token || seenTokens.has(token))
        throw new Error("Incomplete backup receipt scan");
      seenTokens.add(token);
    }
  }
  const receipts: Receipt[] = [];
  for (const name of names) {
    const object = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: name }),
      { abortSignal: signal },
    );
    if (!object.Body) throw new Error("Missing backup receipt body");
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      bytes += chunk.byteLength;
      if (bytes > RECEIPT_LIMIT)
        throw new Error("Backup receipt exceeds limit");
      chunks.push(chunk);
    }
    if (bytes !== object.ContentLength)
      throw new Error("Truncated backup receipt");
    const receipt = parseReceipt(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
      environment,
      now,
    );
    if (`${receipt.archive}.verified.json` !== name)
      throw new Error("Mismatched backup receipt path");
    receipts.push(receipt);
  }
  receipts.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = receipts[0];
  // Age is based on the start of the database snapshot, not upload completion.
  if (!latest || now - Date.parse(latest.startedAt) > BACKUP_MAX_AGE_MS)
    throw new Error("No recent verified database backup");
  const archive = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: latest.archive }),
    { abortSignal: signal },
  );
  if (
    archive.ContentLength !== latest.bytes ||
    archive.Metadata?.sha256 !== latest.sha256 ||
    archive.Metadata?.format !== "CGTBKP01"
  )
    throw new Error("Verified database backup is missing or changed");
  return { ...latest, ageMs: now - Date.parse(latest.startedAt) };
}
