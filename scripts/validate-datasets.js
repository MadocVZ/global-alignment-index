const fs = require('fs')
const path = require('path')

const dataDir = path.join(__dirname, '..', 'public', 'data')
const schemaPath = path.join(__dirname, '..', 'schemas', 'timeseries.schema.json')
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))

const files = fs
  .readdirSync(dataDir)
  .filter(f => f.endsWith('.json') && !['sources.json', 'metrics_registry.json'].includes(f))

let ok = true

for (const f of files) {
  const full = path.join(dataDir, f)
  try {
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))
    if (!Array.isArray(data)) throw new Error('not an array')
    let prevYear = -Infinity
    data.forEach((d, i) => {
      if (typeof d !== 'object' || d === null) throw new Error(`item ${i} not object`)
      const keys = Object.keys(d)
      if (keys.length !== 2 || !('year' in d) || !('value' in d)) throw new Error(`item ${i} invalid keys`)
      if (!Number.isInteger(d.year)) throw new Error(`item ${i} year not integer`)
      if (typeof d.value !== 'number' || Number.isNaN(d.value)) throw new Error(`item ${i} value not number`)
      if (d.year <= prevYear) throw new Error(`item ${i} year not ascending`)
      prevYear = d.year
    })
  } catch (err) {
    console.error(`Validation failed for ${f}: ${err.message}`)
    ok = false
  }
}

if (!ok) {
  process.exit(1)
}
