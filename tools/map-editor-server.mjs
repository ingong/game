import {createServer} from 'node:http'
import {readFileSync,existsSync,statSync,realpathSync} from 'node:fs'
import {resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {projectRoot,generateMapSettings} from './map-settings.mjs'
import {assertLocalWrite,assertRevision,readMapDocument,saveMapDocument,revisionOf,commitFiles} from './map-editor-store.mjs'
import {compilePiskel} from './piskel.mjs'
import {build} from './build.mjs'

const PISKEL='assets/concepts/unicorn-runner.piskel'
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.zip':'application/zip','.piskel':'application/json'}
const json=(res,status,data) => {res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req) {
  const chunks=[];let size=0
  for await (const chunk of req) {size+=chunk.length;if(size>2*1024*1024) throw new Error('파일은 2 MiB 이하만 가져올 수 있습니다.');chunks.push(chunk)}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
export function readPiskelDocument(root) {
  const text=readFileSync(resolve(root,PISKEL),'utf8')
  return {text,revision:revisionOf(text)}
}
export function savePiskelDocument(root,{text,revision}={}) {
  assertRevision(readPiskelDocument(root).revision,revision)
  const png=compilePiskel(text)
  if (png.length>3000) throw new Error(`실행용 PNG ${png.length} B: 에셋 예산 3000 B를 초과합니다.`)
  // Only the registered RUNNER binding changes; the validated frame contract is fixed.
  const generated=readFileSync(resolve(root,'src/generated/assets.mjs'),'utf8')
  const pattern=/(export const RUNNER_SHEET_SRC = ')data:image\/png;base64,[A-Za-z0-9+/=]+(')/
  if (!pattern.test(generated)) throw new Error('러너 임베딩을 찾을 수 없습니다. assets:generate를 실행하세요.')
  const module=generated.replace(pattern,(_,before,after)=>before+'data:image/png;base64,'+png.toString('base64')+after)
  commitFiles(root,{[PISKEL]:text,'assets/runtime/unicorn-chibi-atlas.png':png,'src/generated/assets.mjs':module})
  return {...readPiskelDocument(root),bytes:png.length}
}
export function createMapEditorServer({root=projectRoot}={}) {
  let busy=false
  return createServer(async(req,res) => {
    try {
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host??'')) {json(res,403,{error:'Localhost only'});return}
      const path=new URL(req.url,`http://${req.headers.host}`).pathname
      if (req.method==='GET' && path==='/api/settings') {json(res,200,readMapDocument(root));return}
      if (req.method==='GET' && path==='/api/piskel') {json(res,200,readPiskelDocument(root));return}
      if (req.method==='GET' && path==='/api/status') {
        const zip=resolve(root,'dist/game.zip')
        json(res,200,{runnerBytes:statSync(resolve(root,'assets/runtime/unicorn-chibi-atlas.png')).size,
          zipBytes:existsSync(zip)?statSync(zip).size:null,limit:13312});return
      }
      if (req.method==='PUT' || req.method==='POST') {
        assertLocalWrite(req.headers)
        const data=await body(req)
        if (busy) {json(res,409,{error:'빌드가 진행 중입니다. 끝난 후 저장해 주세요.'});return}
        if (req.method==='PUT' && path==='/api/settings') {json(res,200,saveMapDocument(root,data));return}
        if (req.method==='PUT' && path==='/api/piskel') {json(res,200,savePiskelDocument(root,data));return}
        if (req.method==='POST' && path==='/api/build') {
          if (root!==projectRoot) throw new Error('Build is only available in the project workspace')
          busy=true
          try {await build();json(res,200,{zipBytes:statSync(resolve(root,'dist/game.zip')).size,limit:13312})}
          finally {busy=false}
          return
        }
      }
      if (req.method!=='GET') {json(res,405,{error:'지원하지 않는 요청입니다.'});return}
      const relative=path==='/' ? 'tools/map-editor/index.html':decodeURIComponent(path).replace(/^\//,'')
      const allowed=/^(?:tools\/map-editor\/|src\/|assets\/runtime\/|dist\/)/.test(relative) || relative==='tools/map-settings-model.mjs'
      if (!allowed || relative.split('/').some(part=>part==='..'||part==='.')) {json(res,404,{error:'Not found'});return}
      const file=resolve(root,relative)
      if (!file.startsWith(root+'/') || !existsSync(file) || !statSync(file).isFile() || !realpathSync(file).startsWith(realpathSync(root)+'/')) {json(res,404,{error:'Not found'});return}
      if (!mime[extname(file)]) {json(res,404,{error:'Not found'});return}
      res.writeHead(200,{'Content-Type':mime[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
      res.end(readFileSync(file))
    } catch(error) {json(res,error.status??400,{error:error.message})}
  })
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  generateMapSettings()
  const port=Number(process.env.MAP_EDITOR_PORT??4175)
  const server=createMapEditorServer()
  server.on('error',error=>{console.error(error.message);process.exitCode=1})
  server.listen(port,'127.0.0.1',()=>console.log(`Map asset workspace: http://127.0.0.1:${port}/`))
}
