import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { minify } from 'terser'
import { generateAssets } from './assets.mjs'
import { exportRunner } from './runner-export.mjs'
import { generateMapSettings } from './map-settings.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const htmlPath = resolve(dist, 'index.html')
const zipPath = resolve(dist, 'game.zip')
const moduleTag = '<script type="module" src="./main.mjs"></script>'
const archiveDate = new Date('2000-01-01T00:00:00Z')
const MAX_ZIP_BYTES = 13_312

export function assertStandaloneHtml(html) {
  for (const forbidden of ['assets/', 'itch', 'unicorn-runner-sprite-concept', 'http://', 'https://']) {
    if (html.includes(forbidden)) throw new Error(`Generated HTML contains ${forbidden}`)
  }
}

export async function build({ maxZipBytes = MAX_ZIP_BYTES } = {}) {
  generateMapSettings({ check:true })
  exportRunner({ check:true })
  generateAssets({ check:true })
  const bundle = await esbuild.build({
    entryPoints: [resolve(root, 'src/main.mjs')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    metafile: true
  })
  for (const input of Object.keys(bundle.metafile.inputs)) {
    if (resolve(input).startsWith(resolve(root, 'assets') + '/')) {
      throw new Error(`Source/reference asset imported into submission: ${input}`)
    }
  }
  const result = await minify(bundle.outputFiles[0].text, {
    module: false,
    toplevel: true,
    compress: { passes: 3, unsafe_math: true },
    mangle: true
  })

  if (!result.code) throw new Error('Terser did not produce JavaScript')

  const shell = readFileSync(resolve(root, 'src/index.html'), 'utf8')
  if (!shell.includes(moduleTag)) throw new Error('Development module tag not found')

  const html = shell
    .replace(moduleTag, `<script>${result.code}</script>`)
    .replace(/>\s+</g, '><')
  assertStandaloneHtml(html)

  rmSync(dist, { recursive:true, force:true })
  mkdirSync(dist, { recursive:true })
  writeFileSync(htmlPath, html)
  utimesSync(htmlPath, archiveDate, archiveDate)
  execFileSync('zip', ['-9', '-X', zipPath, 'index.html'], {
    cwd: dist,
    stdio: 'pipe'
  })

  const zipBytes = statSync(zipPath).size
  if (zipBytes > maxZipBytes) throw new Error(`ZIP is ${zipBytes} bytes; limit is ${maxZipBytes} bytes`)
  console.log('Built dist/index.html')
  console.log(`ZIP ${zipBytes}/${MAX_ZIP_BYTES} bytes`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build()
