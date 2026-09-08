import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectPng } from './png-info.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const generatedPath = 'src/generated/assets.mjs'
const runnerFrames = ['contact','stride-left','stride-right-mirrored','jump','impact']
const nonempty = value => typeof value === 'string' && value.trim().length > 0
const safePath = value => nonempty(value) && !value.includes('\\') &&
  value.split('/').every(part => part && part !== '.' && part !== '..') && !value.includes(':')

function filesIn(root, folder) {
  if (!existsSync(resolve(root, folder))) return []
  return readdirSync(resolve(root, folder), { withFileTypes:true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (entry.name === '.DS_Store') return []
    const path = `${folder}/${entry.name}`
    return entry.isDirectory() ? filesIn(root, path) : [path]
  })
}
function regularFile(root, path) {
  // Do not follow symlinks out of the asset tree, including parent directories.
  let current = root
  for (const part of path.split('/')) {
    current = resolve(current, part)
    if (lstatSync(current).isSymbolicLink()) throw new Error(`Symlink is not an asset source: ${path}`)
  }
  if (!lstatSync(current).isFile()) throw new Error(`Not a regular file: ${path}`)
  return readFileSync(current)
}

export function auditAssets({ root = projectRoot } = {}) {
  const report = { version:1, assets:[], errors:[], warnings:[], totals:{} }
  const { errors, warnings } = report
  let manifest
  try { manifest = JSON.parse(readFileSync(resolve(root, 'assets/manifest.json'), 'utf8')) }
  catch (error) { errors.push(`Cannot read asset manifest: ${error.message}`); return report }
  if (!manifest || typeof manifest !== 'object' || manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    errors.push('Asset manifest requires version 1 and an assets array'); return report
  }
  const ids = new Set(), paths = new Set(), exports = new Set(), hashes = new Map()
  for (const entry of manifest.assets) {
    if (!entry || typeof entry !== 'object') { errors.push('Invalid asset entry'); continue }
    const asset = { ...entry }
    report.assets.push(asset)
    const label = entry.id || entry.path || 'unnamed asset'
    const fail = message => errors.push(`${label}: ${message}`)
    if (typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) fail('invalid ID')
    if (ids.has(entry.id)) fail(`duplicate ID ${entry.id}`)
    ids.add(entry.id)
    if (!nonempty(entry.title)) fail('title is required')
    if (!['image','archive','document','procedural'].includes(entry.kind)) fail('invalid kind')
    if (!['runtime','concept','reference'].includes(entry.role)) fail('invalid role')
    if (!entry.source || !['project','external'].includes(entry.source.kind) ||
      !nonempty(entry.source.author) || !nonempty(entry.source.evidence)) fail('source author and evidence are required')
    if (!nonempty(entry.license?.id) || !nonempty(entry.license?.note)) fail('license ID and note are required')
    if (entry.source?.kind === 'external' && !/^https?:\/\//.test(entry.source.url ?? '')) fail('external source URL is required')
    if (entry.role === 'runtime' && (entry.source?.kind !== 'project' || entry.license?.id !== 'project-original')) {
      fail('runtime assets must be project-original under the submission policy')
    }
    if (entry.role === 'runtime' && !['image','procedural'].includes(entry.kind)) fail('unsupported runtime kind')
    if (entry.review !== undefined && (!Array.isArray(entry.review) || !entry.review.every(nonempty))) fail('review must be a list of notes')
    else for (const note of entry.review ?? []) warnings.push(`${label}: ${note}`)
    if (entry.derivedFrom !== undefined && (!Array.isArray(entry.derivedFrom) || !entry.derivedFrom.every(nonempty))) fail('derivedFrom must be an ID list')
    const prefix = entry.kind === 'procedural' ? 'src/' : `assets/${{runtime:'runtime',concept:'concepts',reference:'references'}[entry.role]}/`
    if (!safePath(entry.path) || !entry.path.startsWith(prefix)) { fail(`invalid path for role: ${entry.path}`); continue }
    if (paths.has(entry.path)) fail(`duplicate path ${entry.path}`)
    paths.add(entry.path)
    let bytes
    try { bytes = regularFile(root, entry.path) }
    catch (error) { fail(`missing or unreadable file ${entry.path}: ${error.message}`); continue }
    asset.bytes = bytes.length
    asset.sha256 = createHash('sha256').update(bytes).digest('hex')
    if (hashes.has(asset.sha256)) warnings.push(`${label}: exact duplicate of ${hashes.get(asset.sha256)}`)
    else hashes.set(asset.sha256, label)
    report.totals[entry.role] = (report.totals[entry.role] ?? 0) + (entry.kind === 'procedural' ? 0 : bytes.length)
    if (entry.kind === 'image') {
      try {
        if (!entry.path.endsWith('.png')) throw new Error('Only PNG image sources are supported')
        asset.image = inspectPng(bytes)
        if (entry.width !== asset.image.width || entry.height !== asset.image.height) fail(`image dimensions differ from ${entry.width}x${entry.height}`)
      } catch (error) { fail(error.message) }
    }
    if (entry.role === 'runtime' && entry.kind === 'image') {
      if (!Number.isInteger(entry.budgetBytes) || entry.budgetBytes <= 0) fail('runtime byte budget is required')
      else if (bytes.length > entry.budgetBytes) fail(`byte budget exceeded: ${bytes.length}/${entry.budgetBytes}`)
      if (typeof entry.exportName !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(entry.exportName) || exports.has(entry.exportName)) fail('invalid or duplicate exportName')
      exports.add(entry.exportName)
      const frames = entry.frames
      if (!frames || !Number.isInteger(frames.width) || frames.width <= 0 || !Number.isInteger(frames.height) || frames.height <= 0 ||
        !Array.isArray(frames.names) || !frames.names.length || !frames.names.every(nonempty) || new Set(frames.names).size !== frames.names.length ||
        frames.width*frames.names.length !== asset.image?.width || frames.height !== asset.image?.height) fail('frame grid must exactly cover one horizontal atlas row')
      if (entry.exportName === 'RUNNER' && (frames?.width !== 32 || frames?.height !== 56 ||
        JSON.stringify(frames?.names) !== JSON.stringify(runnerFrames))) {
        fail(`RUNNER renderer requires five 32x56 frames in order: ${runnerFrames.join(', ')}`)
      }
      if (asset.image && asset.image.transparentPixels === 0) warnings.push(`${label}: no fully transparent pixels; inspect background edges before editing alpha`)
      if (asset.image?.partialAlphaPixels) warnings.push(`${label}: ${asset.image.partialAlphaPixels} partially transparent pixels; review pixel-art edges on light and dark backgrounds`)
    }
  }
  const byId = new Map(report.assets.map(asset => [asset.id,asset]))
  for (const asset of report.assets) {
    if (!Array.isArray(asset.derivedFrom)) continue
    for (const id of asset.derivedFrom) {
      if (!ids.has(id) || id === asset.id) errors.push(`${asset.id}: invalid derivedFrom source ${id}`)
    }
  }
  const visit = (origin, id, ancestors = new Set(), visited = new Set()) => {
    if (ancestors.has(id)) { errors.push(`${id}: derivedFrom cycle`); return }
    if (visited.has(id)) return
    visited.add(id)
    const asset = byId.get(id)
    if (id !== origin && byId.get(origin)?.role === 'runtime' && (asset?.role === 'reference' ||
      asset?.source?.kind !== 'project' || asset?.license?.id !== 'project-original')) {
      errors.push(`${origin}: runtime cannot derive from reference or non-project source ${id}`)
    }
    const parents = asset?.derivedFrom
    if (Array.isArray(parents)) for (const parent of parents) if (ids.has(parent)) visit(origin,parent,new Set([...ancestors,id]),visited)
  }
  for (const id of ids) visit(id,id)
  for (const path of filesIn(root, 'assets')) {
    if (path !== 'assets/manifest.json' && !paths.has(path)) errors.push(`Unregistered asset: ${path}`)
  }
  for (const path of filesIn(root, 'src')) {
    if (path === generatedPath) continue
    if (/\.(png|jpe?g|webp|gif|svg|avif|mp3|wav|ogg|mp4|webm|woff2?|ttf|glb|gltf)$/i.test(path)) errors.push(`Unregistered runtime file: ${path}`)
    if (/\.(mjs|js|html|css)$/.test(path)) {
      try {
        if (/data:(?:image|audio|font)\//i.test(regularFile(root,path).toString('utf8'))) errors.push(`Unregistered inline resource: ${path}`)
      } catch (error) { errors.push(error.message) }
    }
  }
  return report
}

export function generateAssets({ root = projectRoot, check = false } = {}) {
  const report = auditAssets({ root })
  if (report.errors.length) throw new Error(report.errors.join('\n'))
  const lines = ['// Generated by npm run assets:generate. Edit assets/manifest.json and the source PNGs.', '']
  for (const asset of report.assets.filter(asset => asset.role === 'runtime' && asset.kind === 'image').sort((a,b) => a.id.localeCompare(b.id))) {
    const prefix = asset.exportName
    const data = regularFile(root,asset.path).toString('base64')
    lines.push(`export const ${prefix}_SHEET_SRC = 'data:image/png;base64,${data}'`,
      `export const ${prefix}_FRAME_WIDTH = ${asset.frames.width}`,
      `export const ${prefix}_FRAME_HEIGHT = ${asset.frames.height}`,
      `export const ${prefix}_FRAME_COUNT = ${asset.frames.names.length}`, '')
  }
  const source = lines.join('\n'), destination = resolve(root,generatedPath)
  const current = existsSync(destination) ? readFileSync(destination,'utf8') : null
  if (check && source !== current) throw new Error('Generated assets are stale or missing. Run npm run assets:generate')
  if (!check && source !== current) {
    mkdirSync(dirname(destination), { recursive:true })
    writeFileSync(destination,source)
  }
  return report
}

async function main(command) {
  if (!['check','generate','audit','catalog'].includes(command)) throw new Error('Usage: node tools/assets.mjs check|generate|audit|catalog')
  const report = command === 'check' || command === 'generate'
    ? generateAssets({ check:command === 'check' }) : auditAssets()
  if (command === 'catalog') {
    const { writeCatalog } = await import('./asset-catalog.mjs')
    writeCatalog(projectRoot,report)
  }
  if (command === 'audit') console.log(JSON.stringify(report,null,2))
  else {
    console.log(`${report.assets.length} assets; ${report.errors.length} errors; ${report.warnings.length} review notes`)
    for (const warning of report.warnings) console.log(`REVIEW ${warning}`)
    for (const error of report.errors) console.error(`ERROR ${error}`)
    if (command === 'catalog') console.log('Catalog: reports/assets/index.html')
  }
  if (report.errors.length) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv[2]) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
