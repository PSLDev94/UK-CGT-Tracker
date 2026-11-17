import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

// No parent project node_modules, runtime credentials or NODE_PATH may mask a
// missing dependency. An unconfigured worker must reach its own error handler.
const directory = mkdtempSync(join(tmpdir(), 'cgt-job-smoke-'))
try {
  const entry = join(directory, 'reconcile-billing.cjs')
  copyFileSync('.next/standalone/jobs/reconcile-billing.cjs', entry)
  const result = spawnSync(process.execPath, [entry], {
    cwd: directory,
    env: { NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 10000,
  })
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr.trim(), '{"event":"billing_reconciliation_failed"}')
  console.log('Isolated billing worker loads and rejects missing configuration safely')
} finally {
  rmSync(directory, { recursive: true, force: true })
}
