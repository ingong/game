import {RED_STAGE,STAGES} from '/src/stage.mjs'
import {createRun} from '/src/sim.mjs'
import {createCamera} from '/src/camera.mjs'
import {render,stageElevation,drawRoad,drawLava,drawSectionProps,drawObstacle} from '/src/render.mjs'
import {drawRunnerSprite as drawRunner,setRunnerSheetSource} from '/src/art.mjs'
import {MAP_ASSETS,VISUAL_CONTROLS,VISUAL_DEFAULTS,STAGE_ACCENTS,stageVisualDefaults,validateMapSettings} from '/tools/map-settings-model.mjs'

const matches=(asset,o)=>o[0]===asset.type&&(asset.variant===undefined||o[8]===asset.variant)
const $=selector=>document.querySelector(selector)
let documentState, data, piskel, slot=0, selected='sky', filter='전체', busy=false, clock=0, last=0
let messageTimer
const canvas=$('#preview'), ctx=canvas.getContext('2d')
const thumbs=new Map()
const active=()=>data.stages[slot]
const dirty=()=>Boolean(data&&JSON.stringify(data)!==JSON.stringify(documentState.data))
const scene=()=>({...STAGES[slot],name:active().name,visual:active().visual})
function notify(text,error=false) {
  clearTimeout(messageTimer);$('#message').textContent=text;$('#message').classList.toggle('error',error)
  if (!error) messageTimer=setTimeout(()=>$('#message').textContent='',6000)
}
async function api(path,method='GET',payload) {
  const response=await fetch(path,{method,headers:payload ? {'Content-Type':'application/json'}:{},body:payload ? JSON.stringify(payload):undefined})
  const result=await response.json()
  if (!response.ok) throw new Error(result.error??'요청을 처리하지 못했습니다.')
  return result
}
function syncSaveState() {
  $('#save-state').textContent=busy ? '처리 중…' : dirty() ? '저장하지 않은 변경' : '프로젝트와 동기화됨'
  $('#save').disabled=busy||!dirty();$('#build').disabled=busy||dirty()
}
function setBusy(value) {
  busy=value
  document.querySelectorAll('button,input').forEach(element=>element.disabled=value)
  syncSaveState()
}
function download(text,name) {
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})), link=document.createElement('a')
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function buildStageNav() {
  $('#stages').replaceChildren()
  data.stages.forEach((stage,index)=>{
    const button=document.createElement('button');button.className='stage-button'+(slot===index?' selected':'')
    button.setAttribute('aria-pressed',String(slot===index));button.setAttribute('aria-label',`스테이지 ${stage.id} ${stage.state==='draft'?'준비 중':'플레이 가능'}`)
    const number=document.createElement('span');number.className='stage-number';number.textContent=String(stage.id).padStart(2,'0')
    const label=document.createElement('span'), name=document.createElement('strong'), state=document.createElement('small')
    name.textContent=stage.name;state.textContent=stage.state==='draft'?'시각 설정 준비':'현재 플레이 가능'
    label.append(name,state);button.append(number,label)
    button.addEventListener('click',()=>{slot=index;refreshStage()});$('#stages').append(button)
  })
}
function refreshStage() {
  buildStageNav();$('#stage-heading').textContent=`${String(slot+1).padStart(2,'0')} / ${active().name}`
  $('#stage-name').value=active().name
  $('#stage-status').textContent='플레이 가능 · 고유 코스'
  $('#draft-note').textContent=`${STAGES[slot].hint} · ${STAGES[slot].length} m · 제한 ${STAGES[slot].timeLimit}초`
  $('#position').max=STAGES[slot].length-5
  $('#position').value=Math.min(Number($('#position').value),STAGES[slot].length-5)
  $('#stage-status').classList.remove('draft');$('#draft-note').hidden=false
  refreshInspector();syncAssetStates();syncSaveState();drawAll()
}
function changed() {syncSaveState();syncAssetStates();drawAll()}
const controlKeys={sky:['sky'],void:['void','ripples'],road:['road','tiles','edges','accent'],landmark:['landmarks','spacing','scale','accent']}
function refreshInspector() {
  const asset=MAP_ASSETS.find(a=>a.id===selected)
  $('#asset-kind').textContent=asset.kind;$('#asset-name').textContent=asset.name;$('#asset-note').textContent=asset.note
  $('#controls').replaceChildren();$('#placements').replaceChildren()
  for (const [key,label,type,min,max,step] of VISUAL_CONTROLS.filter(c=>(controlKeys[selected]??[]).includes(c[0]))) {
    const row=document.createElement('div');row.className='control'
    const name=document.createElement('label');name.textContent=label;name.htmlFor=`control-${key}`
    const input=document.createElement('input');input.id=name.htmlFor;input.type=type
    if(type==='range') {input.min=min;input.max=max;input.step=step}
    if(type==='checkbox') input.checked=active().visual[key];else input.value=active().visual[key]
    const output=document.createElement('output');output.htmlFor=input.id
    const show=()=>{output.textContent=type==='checkbox'?'':key==='spacing'?`${input.value} m`:key==='scale'?`${Number(input.value).toFixed(2)}×`:input.value}
    show();row.append(name,output,input)
    input.addEventListener('input',()=>{
      active().visual[key]=type==='checkbox'?input.checked:type==='range'?Number(input.value):input.value
      show();changed()
    });$('#controls').append(row)
  }
  if (asset.type!==undefined) {
    const instances=STAGES[slot].obstacles.filter(o=>matches(asset,o))
    const note=document.createElement('p');note.className='placement-note'
    note.textContent=`선택 스테이지에 ${instances.length}개 배치. 위치를 누르면 맵에서 확인합니다. 공략법은 위 설명을 참고하세요. 다른 종류는 별도 카드로 표시합니다.`
    const list=document.createElement('div');list.className='placement-list'
    instances.forEach(o=>{const button=document.createElement('button');button.textContent=`${o[1]} m`;button.addEventListener('click',()=>focusObstacle(o));list.append(button)})
    $('#placements').append(note,list)
  }
}
function focusObstacle(obstacle) {if(!obstacle)return;$('#travel').checked=false;$('#position').value=Math.max(5,obstacle[1]-25);drawAll()}
function buildLibrary() {
  const kinds=['전체',...new Set(MAP_ASSETS.map(a=>a.kind))]
  for (const kind of kinds) {
    const button=document.createElement('button');button.textContent=kind;button.classList.toggle('active',filter===kind)
    button.setAttribute('aria-pressed',String(filter===kind));button.addEventListener('click',()=>{filter=kind;applyFilter()});$('#filters').append(button)
  }
  for (const asset of MAP_ASSETS) {
    const button=document.createElement('button');button.className='asset-card';button.dataset.id=asset.id
    button.setAttribute('aria-label',`${asset.name} 선택`)
    const thumb=document.createElement('canvas');thumb.width=192;thumb.height=112;thumb.setAttribute('aria-hidden','true')
    const meta=document.createElement('div');meta.className='asset-meta'
    const label=document.createElement('div'),title=document.createElement('strong'),kind=document.createElement('small'),state=document.createElement('span')
    title.textContent=asset.name;kind.textContent=asset.kind;state.className='asset-state'
    label.append(title,kind);meta.append(label,state);button.append(thumb,meta)
    button.addEventListener('click',()=>{selected=asset.id;refreshInspector();syncAssetStates();if(asset.type!==undefined)focusObstacle(STAGES[slot].obstacles.find(o=>matches(asset,o)))})
    $('#assets').append(button);thumbs.set(asset.id,{canvas:thumb,ctx:thumb.getContext('2d'),button,state})
  }
  applyFilter()
}
function applyFilter() {
  const query=$('#search').value.trim().toLowerCase();let count=0
  for(const asset of MAP_ASSETS) {const visible=(filter==='전체'||filter===asset.kind)&&asset.name.toLowerCase().includes(query);thumbs.get(asset.id).button.hidden=!visible;if(visible)count++}
  $('#asset-count').textContent=`${count} / ${MAP_ASSETS.length}`;$('#empty').hidden=count!==0
  $('#filters').querySelectorAll('button').forEach(button=>{button.classList.toggle('active',button.textContent===filter);button.setAttribute('aria-pressed',String(button.textContent===filter))})
}
function syncAssetStates() {
  for (const asset of MAP_ASSETS) {
    const {button,state}=thumbs.get(asset.id);const off=asset.id==='landmark'&&!active().visual.landmarks
    button.classList.toggle('selected',selected===asset.id);button.setAttribute('aria-pressed',String(selected===asset.id))
    state.classList.toggle('off',off)
    const count=asset.type!==undefined?STAGES[slot].obstacles.filter(o=>matches(asset,o)).length:null
    state.textContent=off?'꺼짐':count===0?'미사용':count!==null?`${count}개`:'사용'
  }
}
function drawThumb(asset) {
  const {canvas,ctx,button}=thumbs.get(asset.id);if(button.hidden)return
  const w=canvas.width,h=canvas.height,visual=active().visual
  ctx.imageSmoothingEnabled=false;ctx.fillStyle=visual.sky;ctx.fillRect(0,0,w,h)
  const stage={...scene(),length:120,sections:[[0,120,36,0,0,0,11]],obstacles:[]}
  const run={...createRun(stage),mode:'running',time:clock,anim:clock,z:0}
  const camera=createCamera(run);camera.horizon=.25
  if(asset.id==='runner') {drawRunner(ctx,run,w/2,h-12,.95);return}
  if(asset.id==='sky') return
  if(asset.id==='void') {drawLava(ctx,run,camera,stage,w,h);return}
  if(asset.id==='landmark') {
    stage.visual={...visual,landmarks:true,spacing:80};stage.length=80;camera.z=36
    drawSectionProps(ctx,run,camera,stage,w,h);return
  }
  drawLava(ctx,run,camera,stage,w,h)
  drawRoad(ctx,camera,stage,w,h)
  if(asset.type!==undefined) {
    const obstacle=[...STAGES.flatMap(s=>s.obstacles).find(o=>matches(asset,o))];obstacle[1]=32;obstacle[2]=0
    drawObstacle(ctx,{obstacle,index:0,depth:52},run,camera,stage,w,h)
  }
}
function drawAll() {
  if(!data)return
  const stage=scene(),z=Number($('#position').value)
  const run={...createRun(stage),mode:'running',time:clock%stage.timeLimit,anim:clock,z,speed:0}
  const camera=createCamera(run,stageElevation(stage,z))
  ctx.imageSmoothingEnabled=false;render(ctx,run,camera,stage,canvas.width,canvas.height)
  $('#position-label').textContent=`${Math.round(z)} / ${stage.length} m`
  for(const asset of MAP_ASSETS)drawThumb(asset)
}
function frame(now) {
  if(now-last>=80) {
    const dt=last?Math.min((now-last)/1000,.2):0;last=now
    if($('#animate').checked)clock+=dt
    if($('#travel').checked) {let z=Number($('#position').value)+dt*24;$('#position').value=z>STAGES[slot].length-5?5:z}
    if($('#animate').checked||$('#travel').checked)drawAll()
  }
  requestAnimationFrame(frame)
}
function showBudget(status) {
  $('#zip-size').textContent=status.zipBytes===null?'미빌드':`${status.zipBytes.toLocaleString()} B`
  $('#zip-meter').style.width=`${Math.min(100,(status.zipBytes??0)/status.limit*100)}%`
  $('#zip-note').textContent=status.zipBytes===null?'저장 후 제출 ZIP을 빌드하세요.':`마지막 빌드 · ${(status.limit-status.zipBytes).toLocaleString()} B 여유 / ${status.limit.toLocaleString()} B`
  if(status.runnerBytes!==undefined)$('#runner-size').textContent=`캐릭터 변환 결과 ${status.runnerBytes.toLocaleString()} B`
}
$('#stage-name').addEventListener('input',event=>{active().name=event.target.value;buildStageNav();$('#stage-heading').textContent=`${String(slot+1).padStart(2,'0')} / ${active().name}`;changed()})
$('#position').addEventListener('input',drawAll);$('#animate').addEventListener('change',drawAll)
$('#search').addEventListener('input',applyFilter)
$('#save').addEventListener('click',async()=>{
  const errors=validateMapSettings(data);if(errors.length){notify(errors.join(' '),true);return}
  setBusy(true)
  try {documentState=await api('/api/settings','PUT',{data,revision:documentState.revision});data=structuredClone(documentState.data);notify('프로젝트에 저장했습니다. 개발 게임에 반영되며, 제출 ZIP은 다시 빌드해 주세요.')}
  catch(error){notify(error.message,true)}finally{setBusy(false)}
})
$('#reload').addEventListener('click',async()=>{
  if(dirty()&&!confirm('저장하지 않은 설정을 버리고 디스크에서 다시 불러올까요?'))return
  setBusy(true)
  try {documentState=await api('/api/settings');data=structuredClone(documentState.data);piskel=await api('/api/piskel');await setRunnerSheetSource('/assets/runtime/unicorn-chibi-atlas.png?revision='+piskel.revision);refreshStage();notify('디스크의 설정과 캐릭터를 불러왔습니다.')}
  catch(error){notify(error.message,true)}finally{setBusy(false)}
})
$('#build').addEventListener('click',async()=>{
  setBusy(true);notify('제출 ZIP을 빌드하고 크기를 검사하고 있습니다.')
  try {const result=await api('/api/build','POST',{});showBudget({...result,runnerBytes:(await api('/api/status')).runnerBytes});notify(`빌드 완료 · ${result.zipBytes.toLocaleString()} / ${result.limit.toLocaleString()} B`)}
  catch(error){notify(error.message,true)}finally{setBusy(false)}
})
$('#export-settings').addEventListener('click',()=>download(JSON.stringify(data,null,2),'map-settings.json'))
$('#reset-stage').addEventListener('click',()=>{active().visual=stageVisualDefaults(slot);refreshInspector();changed();notify('선택 스테이지의 배경을 기본값으로 바꿨습니다. 저장 전에는 파일을 바꾸지 않습니다.')})
$('#download-piskel').addEventListener('click',()=>download(piskel.text,'unicorn-runner.piskel'))
$('#import-piskel').addEventListener('click',()=>$('#piskel-file').click())
$('#piskel-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return
  if(file.size>2*1024*1024){notify('Piskel 파일은 2 MiB 이하로 가져오세요.',true);event.target.value='';return}
  setBusy(true)
  try {const result=await api('/api/piskel','PUT',{text:await file.text(),revision:piskel.revision});piskel=result;await setRunnerSheetSource('/assets/runtime/unicorn-chibi-atlas.png?revision='+result.revision);drawAll();showBudget(await api('/api/status'));notify(`Piskel 원본을 적용했습니다. 실행용 캐릭터 ${result.bytes} B. 제출 ZIP은 다시 빌드해 주세요.`)}
  catch(error){notify(error.message,true)}finally{event.target.value='';setBusy(false)}
})
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue=''}})
try {
  ;[documentState,piskel]=await Promise.all([api('/api/settings'),api('/api/piskel')])
  const errors=validateMapSettings(documentState.data);if(errors.length)throw new Error(errors.join(' '))
  await setRunnerSheetSource('/assets/runtime/unicorn-chibi-atlas.png?revision='+piskel.revision)
  data=structuredClone(documentState.data)
  const params=new URLSearchParams(location.search),requestedStage=Number(params.get('stage'))
  if(requestedStage>=1&&requestedStage<=7&&Number.isInteger(requestedStage))slot=requestedStage-1
  if(MAP_ASSETS.some(a=>a.id===params.get('asset')))selected=params.get('asset')
  buildLibrary();refreshStage()
  const requestedAsset=MAP_ASSETS.find(a=>a.id===selected)
  if(requestedAsset?.type!==undefined)focusObstacle(STAGES[slot].obstacles.find(o=>matches(requestedAsset,o)))
  showBudget(await api('/api/status'))
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)$('#animate').checked=false
  requestAnimationFrame(frame)
} catch(error) {setBusy(true);$('#save-state').textContent='연결 오류';notify(`작업실을 열지 못했습니다: ${error.message}`,true)}
