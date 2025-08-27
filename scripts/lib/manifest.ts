import { readFile, writeFile } from 'node:fs/promises'

export async function readManifest(path: string = 'public/data/sources.json'): Promise<Record<string, any>> {
  try {
    const text = await readFile(path, 'utf8')
    return JSON.parse(text)
  } catch (err: any) {
    if (err && err.code === 'ENOENT') return {}
    throw err
  }
}

export async function writeManifest(manifest: Record<string, any>, path = 'public/data/sources.json'): Promise<void> {
  const json = JSON.stringify(manifest, null, 2)
  await writeFile(path, json)
}

export async function upsertSource(id: string, meta: Record<string, any>): Promise<void> {
  const manifest = await readManifest()
  manifest[id] = { ...(manifest[id] || {}), ...meta }
  await writeManifest(manifest)
}
