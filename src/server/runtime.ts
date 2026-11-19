import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { createAuth } from "./auth";
import { assertRuntimeRole, OwnedDatabase, query } from "./database";
import { resendSupportMailer, resendAuthMailer } from "./mail";
import { Workspace } from "./workspace";
import { createWorkspaceHandler } from "./workspace-api";
import { createContactHandler } from "./contact-api";
import { AppError } from "./errors";

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new AppError(
      503,
      "SETUP_INCOMPLETE",
      "The new workspace is not available yet. Please try again later.",
    );
  return value;
}

async function initialise() {
  const origin = required("APP_ORIGIN");
  const secureCookies = process.env.NODE_ENV === "production";
  const config = {
    origin,
    secureCookies,
    secret: required("BETTER_AUTH_SECRET"),
    clientIpHeader: required("AUTH_CLIENT_IP_HEADER"),
  };
  const sendMail = resendAuthMailer(
    required("RESEND_API_KEY"),
    required("AUTH_EMAIL_FROM"),
  );
  const appUrl = required("APP_DATABASE_URL");
  const authUrl = required("AUTH_DATABASE_URL");
  if (appUrl === authUrl)
    throw new Error(
      "Authentication and financial database logins must be separate",
    );
  const pool = (connectionString: string, role: string) =>
    new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      options: `-c role=${role} -c statement_timeout=30000 -c idle_in_transaction_session_timeout=30000`,
    });
  const appDb = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({ pool: pool(appUrl, "cgt_app") }),
  });
  const authDb = new Kysely<Record<string, never>>({
    dialect: new PostgresDialect({ pool: pool(authUrl, "cgt_auth") }),
  });
  try {
    await Promise.all([
      assertRuntimeRole(appDb, "cgt_app"),
      assertRuntimeRole(authDb, "cgt_auth"),
    ]);
    const auth = createAuth(authDb, config, sendMail);
    const workspace = new Workspace(new OwnedDatabase(appDb));
    return {
      auth,
      origin,
      workspace,
      contactHandler: createContactHandler({
        origin,
        ipHeader: config.clientIpHeader,
        secret: config.secret,
        send: resendSupportMailer(
          required("RESEND_API_KEY"),
          required("AUTH_EMAIL_FROM"),
        ),
        consume: async (key) => {
          const allowed = await query(
            appDb,
            `INSERT INTO cgt.contact_limits(key) VALUES($1)
            ON CONFLICT(key) DO UPDATE SET
              window_start=CASE WHEN cgt.contact_limits.window_start<=now()-interval '1 hour' THEN now() ELSE cgt.contact_limits.window_start END,
              request_count=CASE WHEN cgt.contact_limits.window_start<=now()-interval '1 hour' THEN 1 ELSE cgt.contact_limits.request_count+1 END
            WHERE cgt.contact_limits.request_count<5 OR cgt.contact_limits.window_start<=now()-interval '1 hour' RETURNING key`,
            [key],
          );
          if (!allowed.length)
            throw new AppError(
              429,
              "TOO_MANY_REQUESTS",
              "Too many messages. Try again in an hour or email support@cgttracker.com.",
            );
        },
      }),
      checkDatabase: () =>
        Promise.all([
          query(appDb, "SELECT display_summary FROM cgt.import_drafts LIMIT 0"),
          query(appDb, "SELECT ibkr_client_account_id FROM cgt.broker_accounts LIMIT 0"),
          query(appDb, "SELECT portfolio_revision FROM cgt.reviewed_opening_pools LIMIT 0"),
          query(appDb, "SELECT cgt.ledger_gbp(1,'1','1') FROM cgt.unverified_import_receipts LIMIT 0"),
          query(authDb, "SELECT 1"),
        ]),
      workspaceHandler: createWorkspaceHandler(
        workspace,
        (headers) => auth.api.getSession({ headers }),
        origin,
      ),
    };
  } catch (error) {
    await Promise.allSettled([appDb.destroy(), authDb.destroy()]);
    throw error;
  }
}

// Lazy initialisation: the build never connects to production or needs secrets.
let instance: ReturnType<typeof initialise> | undefined;
export function runtime() {
  instance ??= initialise().catch((error) => {
    instance = undefined;
    throw error;
  });
  return instance;
}
