import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'
import { minify } from 'terser'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const htmlPath = resolve(dist, 'index.html')
const zipPath = resolve(dist, 'game.zip')
const assetRelativePath = 'assets/unicorn-runner-sprite-concept.png'
const assetSourcePath = resolve(root, 'src', assetRelativePath)
const assetOutputPath = resolve(dist, assetRelativePath)
const moduleTag = '<script type="module" src="./main.mjs"></script>'
const archiveDate = new Date('2000-01-01T00:00:00Z')

export function assertStandaloneHtml(html) {
  for (const forbidden of ['http://', 'https://']) {
    if (html.includes(forbidden)) throw new Error(`Generated HTML contains ${forbidden}`)
  }
}

export async function build() {
  const bundle = await esbuild.build({
    entryPoints: [resolve(root, 'src/main.mjs')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false
  })
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

  mkdirSync(dist, { recursive: true })
  mkdirSync(dirname(assetOutputPath), { recursive: true })
  writeFileSync(htmlPath, html)
  copyFileSync(assetSourcePath, assetOutputPath)
  utimesSync(htmlPath, archiveDate, archiveDate)
  utimesSync(assetOutputPath, archiveDate, archiveDate)
  rmSync(zipPath, { force: true })
  execFileSync('zip', ['-9', '-X', zipPath, 'index.html', assetRelativePath], {
    cwd: dist,
    stdio: 'pipe'
  })

  console.log(`Built dist/index.html and dist/${assetRelativePath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build()
