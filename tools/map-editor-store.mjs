import {readFileSync,writeFileSync,mkdirSync,renameSync,existsSync,rmSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {resolve,dirname} from 'node:path'
import {runtimeMapSource} from './map-settings-model.mjs'
export const revisionOf = text => createHash('sha256').update(text).digest('hex')
export function assertLocalWrite(headers) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(headers.host??'') ||
    headers.origin!==`http://${headers.host}` ||
    !/^application\/json(?:;|$)/i.test(headers['content-type']??'')) {
    const error=new Error('이 편집 페이지에서 보낸 JSON 요청만 저장할 수 있습니다.');error.status=403;throw error
  }
}
export function assertRevision(actual,expected) {
  if (typeof expected!=='string' || actual!==expected) {
    const error=new Error('다른 창 또는 파일에서 변경되었습니다. 설정을 내보낸 뒤 디스크에서 다시 불러오세요.');error.status=409;throw error
  }
}
// Validate every candidate before calling this; rollback any partially committed files.
export function commitFiles(root,entries) {
  const changes=Object.entries(entries).map(([path,data]) => {
    const target=resolve(root,path)
    return {target,data,before:existsSync(target) ? readFileSync(target):null,temp:`${target}.${randomUUID()}.tmp`}
  })
  const committed=[]
  try {
    for (const change of changes) {mkdirSync(dirname(change.target),{recursive:true});writeFileSync(change.temp,change.data)}
    for (const change of changes) {renameSync(change.temp,change.target);committed.push(change)}
  } catch(error) {
    for (const change of committed.reverse()) {
      if (change.before===null) rmSync(change.target,{force:true})
      else writeFileSync(change.target,change.before)
    }
    throw error
  } finally {for (const change of changes) rmSync(change.temp,{force:true})}
}
export function readMapDocument(root) {
  const text=readFileSync(resolve(root,'config/map-settings.json'),'utf8')
  return {data:JSON.parse(text),revision:revisionOf(text)}
}
export function saveMapDocument(root,{data,revision}={}) {
  const current=readMapDocument(root)
  assertRevision(current.revision,revision)
  const source=runtimeMapSource(data)
  const text=JSON.stringify(data,null,2)+'\n'
  commitFiles(root,{'config/map-settings.json':text,'src/generated/map-settings.mjs':source})
  return {data,revision:revisionOf(text)}
}
