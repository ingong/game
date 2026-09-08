import {OBSTACLE_RECIPES,OBSTACLE_LABELS} from '../src/obstacles.mjs'
// Shared by the development UI and validator; never imported by the game.
export const VISUAL_DEFAULTS = {
  sky:'#c4e9f5', void:'#dedaf5', road:'#666793', accent:'#ff526e',
  tiles:true, edges:true, ripples:0, landmarks:false, spacing:80, scale:.65
}
export const STAGE_ACCENTS = ['#ff526e','#ff994d','#ffe16b','#58d995','#4cc9f0','#7a88ff','#be7bff']
export const STAGE_NAMES=['RED','ORANGE','YELLOW','GREEN','BLUE','INDIGO','VIOLET']
const STAGE_COLORS=[['#ffd9d2','#f2bdc8','#9c5265'],['#ffe4ca','#f5ccb7','#a8664d'],
  ['#fff2c4','#e6dfad','#8b784b'],['#d6f3dc','#b9ded4','#507b70'],
  ['#c4e9f5','#c1d9ef','#526f96'],['#d4ddff','#c2c4ec','#615b96'],
  ['#efdbff','#dcc3eb','#805c92']]
export const stageVisualDefaults=i=>({...VISUAL_DEFAULTS,accent:STAGE_ACCENTS[i],...Object.fromEntries(['sky','void','road'].map((key,k)=>[key,STAGE_COLORS[i][k]]))})

export const VISUAL_CONTROLS = [
  ['sky','하늘','color'], ['void','낙하 구역','color'],
  ['road','바닥','color'], ['accent','발광 색','color'],
  ['tiles','바닥 이음선','checkbox'], ['edges','도로 무지개 띠','checkbox'],
  ['ripples','배경 물결 수','range',0,4,1], ['landmarks','길 표식 사용','checkbox'],
  ['spacing','표식 간격','range',40,160,8], ['scale','표식 크기','range',.3,1,.05]
]
export const MAP_ASSETS = [
  {id:'runner',name:'유니콘 러너',kind:'캐릭터',note:'Piskel에서 편집하는 32 × 56 px, 5프레임 캐릭터.'},
  {id:'sky',name:'하늘',kind:'배경',note:'밝은 하늘. 도로 아래에는 낮은 구름층이 보입니다.'},
  {id:'void',name:'낙하 구역',kind:'배경',note:'도로 아래 구름층. 도로 틈에도 같은 하늘이 이어집니다.'},
  {id:'road',name:'도로',kind:'지형',note:'스테이지의 폭·높이를 따라 그립니다.'},
  {id:'landmark',name:'길 표식',kind:'장식',note:'충돌 없는 작은 표식. 켜기·간격·크기를 조절합니다.'},
  ...OBSTACLE_LABELS.map(([name,note],i)=>({id:`obstacle-${i+1}`,name,kind:'장애물',type:OBSTACLE_RECIPES[i][0],variant:i+1,note})),
  {id:'finish',name:'도착 포털',kind:'목표',type:3,note:'각 스테이지의 끝을 표시합니다.'}
]
export function createMapSettings() {
  return {version:1,stages:Array.from({length:7},(_,i) => ({
    id:i+1,name:`${STAGE_NAMES[i]} ${i+1}`,state:'playable',visual:stageVisualDefaults(i)
  }))}
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exactKeys = (value,keys) => object(value) && Object.keys(value).length===keys.length && keys.every(k => Object.hasOwn(value,k))
export function validateMapSettings(data) {
  const errors=[]
  if (!exactKeys(data,['version','stages']) || data.version!==1 || !Array.isArray(data.stages) || data.stages.length!==7) return ['스테이지 설정은 version 1과 7개 슬롯이 필요합니다.']
  data.stages.forEach((stage,index) => {
    const prefix=`스테이지 ${index+1}`
    if (!exactKeys(stage,['id','name','state','visual']) || stage.id!==index+1 || stage.state!=='playable') {
      errors.push(`${prefix}: 슬롯 ID 또는 상태가 올바르지 않습니다.`); return
    }
    if (typeof stage.name!=='string' || stage.name.trim().length<1 || stage.name.length>28 || /[\u0000-\u001f]/.test(stage.name)) errors.push(`${prefix}: 이름은 1~28자입니다.`)
    if (!exactKeys(stage.visual,Object.keys(VISUAL_DEFAULTS))) {errors.push(`${prefix}: 배경 설정 항목이 올바르지 않습니다.`);return}
    for (const [key,label,type,min,max,step] of VISUAL_CONTROLS) {
      const value=stage.visual[key]
      const valid=type==='color' ? typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value)
        : type==='checkbox' ? typeof value==='boolean'
        : typeof value==='number' && Number.isFinite(value) && value>=min && value<=max && (key!=='ripples' || Number.isInteger(value))
      if (!valid) errors.push(`${prefix}: ${label} 값이 올바르지 않습니다.`)
    }
  })
  return errors
}
export function runtimeMapSource(data) {
  const errors=validateMapSettings(data)
  if (errors.length) throw new Error(errors.join('\n'))
  const stages=data.stages.map(({name,visual})=>({name,visual}))
  return `// Generated from config/map-settings.json. Seven prototype stages.\nexport const STAGE_SETTINGS = ${JSON.stringify(stages)}\nexport const MAP_SETTINGS = STAGE_SETTINGS[0]\n`
}
