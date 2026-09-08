import {OBSTACLE_LABELS,OBSTACLE_RECIPES,obstacleRecipe} from '/src/obstacles.mjs'
import {STAGES} from '/src/stage.mjs'
import {drawObstacle,drawRoad,drawLava} from '/src/render.mjs'
import {createRun} from '/src/sim.mjs'
import {createCamera} from '/src/camera.mjs'
const families={4:'수정',0:'기상',5:'이동체',1:'낙하',2:'발판',6:'발판'}
const cards=[],grid=document.querySelector('#cards'),filters=document.querySelector('#filters')
for(const label of ['전체',...new Set(Object.values(families))]) {
  const button=document.createElement('button');button.textContent=label;button.setAttribute('aria-pressed',String(label==='전체'))
  button.onclick=()=>{
    filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)))
    let count=0;cards.forEach(c=>{c.article.hidden=label!=='전체'&&families[c.obstacle[0]]!==label;if(!c.article.hidden)count++})
    document.querySelector('#count').textContent=`${count} / 20종`;draw()
  };filters.insertBefore(button,filters.lastElementChild)
}
OBSTACLE_LABELS.forEach(([name,note],i)=>{
  const id=i+1,article=document.createElement('article'),canvas=document.createElement('canvas'),body=document.createElement('div')
  canvas.width=320;canvas.height=200;canvas.setAttribute('aria-label',`${name} 동작 미리보기`);body.className='body'
  const index=document.createElement('span');index.className='index';index.textContent=`${String(id).padStart(2,'0')} / ${families[OBSTACLE_RECIPES[i][0]]}`
  const heading=document.createElement('h2');heading.textContent=name
  const text=document.createElement('p');text.textContent=note
  body.append(index,heading,text)
  for(const stage of STAGES) {
    const placement=stage.obstacles.find(o=>o[8]===id)
    if(!placement)continue
    const link=document.createElement('a');link.href=`./index.html?stage=${stage.id}&asset=obstacle-${id}`;link.textContent=`ST${stage.id} · ${placement[1]}m ↗`;body.append(link)
  }
  article.append(canvas,body);grid.append(article)
  cards.push({article,ctx:canvas.getContext('2d'),obstacle:obstacleRecipe(id,28,id===15?7:0)})
})
let time=0,last=0
const animated=document.querySelector('#animate')
if(matchMedia('(prefers-reduced-motion: reduce)').matches)animated.checked=false
const stage={...STAGES[0],length:120,sections:[[0,120,32,0,0,0,0]],visual:{...STAGES[0].visual,sky:'#dbe2f5',void:'#c5cde9',road:'#727692',accent:'#ff526e'}}
function draw(){
  for(const {article,ctx,obstacle} of cards){
    if(article.hidden)continue
    const run={...createRun(stage),mode:'running',time,anim:time,z:0}
    if(obstacle[0]===2)run.collapse={index:0,timer:(time%2)*obstacle[6]}
    const camera=createCamera(run);camera.z=2;camera.horizon=.32
    ctx.imageSmoothingEnabled=false;ctx.fillStyle=stage.visual.sky;ctx.fillRect(0,0,320,200)
    drawLava(ctx,run,camera,stage,320,200);drawRoad(ctx,camera,stage,320,200)
    drawObstacle(ctx,{obstacle,index:0},run,camera,stage,320,200)
  }
}
function frame(now){if(now-last>90){if(animated.checked)time+=Math.min(.2,(now-last)/1000);last=now;draw()}requestAnimationFrame(frame)}
requestAnimationFrame(frame)
