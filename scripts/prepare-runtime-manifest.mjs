import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const output = resolve(process.argv[2]);
assert.notEqual(output, process.cwd(), "Use a separate output directory");
mkdirSync(output, { recursive: true });
const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));

// A root dev dependency can also be an optional peer of a runtime dependency.
// Resolve with only the runtime roots present so npm does not install that peer.
delete manifest.devDependencies;
writeFileSync(join(output, "package.json"), JSON.stringify(manifest));
writeFileSync(join(output, "package-lock.json"), JSON.stringify(lock));
execFileSync(
  "npm",
  [
    "install",
    "--package-lock-only",
    "--offline",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
  ],
  { cwd: output, stdio: "inherit" },
);
const runtime = JSON.parse(
  readFileSync(join(output, "package-lock.json"), "utf8"),
);
for (const [path, pkg] of Object.entries(runtime.packages)) {
  if (!path) continue;
  const pinned = lock.packages[path];
  assert.ok(pinned && pkg.integrity, `Unpinned runtime package at ${path}`);
  for (const field of ["version", "resolved", "integrity"]) {
    assert.equal(
      pkg[field],
      pinned[field],
      `Runtime lock changed ${field} at ${path}`,
    );
  }
}
