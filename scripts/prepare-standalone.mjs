import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('.next/standalone/.next', { recursive: true })
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
cpSync('public', '.next/standalone/public', { recursive: true })

await build({ entryPoints: ['scripts/reconcile-billing.ts'], bundle: true, platform: 'node', packages: 'external', format: 'cjs', target: 'node24', outfile: '.next/standalone/jobs/reconcile-billing.cjs' })
