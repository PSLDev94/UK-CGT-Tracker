import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// This project uses a deliberately small, scalar-only token contract. Fail on
// new syntax rather than guessing at a YAML value or silently skipping a token.
const frontmatter = readFileSync('DESIGN.md', 'utf8').split('---')[1]
assert(frontmatter, 'DESIGN.md must have frontmatter')
const css = readFileSync('src/app/globals.css', 'utf8')
const tokens = [...css.matchAll(/^\s+--((?:color|font|radius|space)-[\w-]+): (.+);$/gm)]
assert(tokens.length > 0, 'No runtime tokens found')
const groups = { color: 'colors', font: 'typography', radius: 'rounded', space: 'spacing' }
for (const [, token, value] of tokens) {
  const split = token.indexOf('-')
  const family = token.slice(0, split)
  const name = token.slice(split + 1)
  const section = frontmatter.match(new RegExp(`^${groups[family]}:\\n((?:[ \\t].*\\n)+)`, 'm'))?.[1]
  assert(section, `Missing token group ${groups[family]}`)
  const pattern = family === 'font' ? `^  ${name}:\\n    fontFamily: (.+)$` : `^  ${name}: (.+)$`
  const raw = section.match(new RegExp(pattern, 'm'))?.[1]
  assert(raw, `Missing documented token ${token}`)
  const documented = raw.startsWith('"') ? JSON.parse(raw) : raw.startsWith("'") ? raw.slice(1, -1).replaceAll("''", "'") : raw
  assert.equal(documented, value, `DESIGN.md differs from runtime token ${token}`)
}
console.log(`Design contract: ${tokens.length} runtime tokens match DESIGN.md`)
