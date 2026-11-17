import { build } from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'
mkdirSync('.next/standalone/.next', { recursive: true })
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
cpSync('public', '.next/standalone/public', { recursive: true })

// Next traces page dependencies, not this separate operator entry point. Bundle
// its JS dependencies so the worker does not depend on the web server's trace.
await build({ entryPoints: ['scripts/reconcile-billing.ts'], bundle: true, platform: 'node', external: ['pg-native'], format: 'cjs', target: 'node24', outfile: '.next/standalone/jobs/reconcile-billing.cjs' })
