import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compilePiskel } from './piskel.mjs'
export { packPixels, encodeIndexedPng } from './indexed-png.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)),'..')
export const RUNNER_EXPORT = {
  source:'assets/concepts/unicorn-runner.piskel',
  target:'assets/runtime/unicorn-chibi-atlas.png'
}

export function compileRunner() {
  return compilePiskel(readFileSync(resolve(root,RUNNER_EXPORT.source),'utf8'))
}
export function exportRunner({check=false}={}) {
  const png=compileRunner(), target=resolve(root,RUNNER_EXPORT.target)
  const current=existsSync(target)?readFileSync(target):null
  if(check) {
    if(!current || !png.equals(current)) throw new Error('Runner export is stale. Run npm run assets:generate')
  } else if(!current || !png.equals(current)) writeFileSync(target,png)
  return png.length
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2)
  if(args.some(arg=>arg!=='--check')) throw new Error('Usage: node tools/runner-export.mjs [--check]')
  console.log(`Runner PNG ${exportRunner({check:args.includes('--check')})} bytes`)
}
