import { METRICS } from '../lib/metrics.ts'
import { readFile } from 'node:fs/promises'

async function run() {
  const ids = METRICS.map(m => m.id)
  let manifest: Record<string, any> = {}
  try {
    const text = await readFile('public/data/sources.json', 'utf8')
    manifest = JSON.parse(text)
  } catch (err) {
    console.error('Failed to read manifest')
    process.exit(1)
  }
  const missing = ids.filter(id => !manifest[id])
  if (missing.length) {
    console.error('Missing manifest entries for:', missing.join(', '))
    process.exit(1)
  }
  console.log('All metrics present in manifest')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
