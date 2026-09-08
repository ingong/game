import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {runtimeMapSource} from './map-settings-model.mjs'
export const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..')
export function generateMapSettings({root=projectRoot,check=false}={}) {
  const data=JSON.parse(readFileSync(resolve(root,'config/map-settings.json'),'utf8'))
  const source=runtimeMapSource(data), target=resolve(root,'src/generated/map-settings.mjs')
  const before=existsSync(target) ? readFileSync(target,'utf8'):null
  if (check && before!==source) throw new Error('Map settings are stale. Run npm run assets:generate')
  if (!check && before!==source) {mkdirSync(dirname(target),{recursive:true});writeFileSync(target,source)}
  return data
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  generateMapSettings({check:process.argv.includes('--check')});console.log('Map settings: 7 playable prototype stages')
}
