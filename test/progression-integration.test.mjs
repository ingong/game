import test from 'node:test'
import assert from 'node:assert/strict'
import {startGame} from '../src/main.mjs'
import {STAGES} from '../src/stage.mjs'

test('game loop advances all seven stages and replays stage one through keyboard input',()=>{
  const lengths=STAGES.map(s=>s.length)
  const handlers=new Map(),texts=[]
  let pending,now=0
  const ctx=new Proxy({measureText:value=>({width:String(value).length*6}),fillText:value=>texts.push(value)},
    {get:(object,key)=>key in object?object[key]:()=>{}})
  const target={innerWidth:320,innerHeight:180,
    addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),
    requestAnimationFrame:fn=>{pending=fn;return 1},cancelAnimationFrame:()=>{pending=null}}
  const frame=()=>{texts.length=0;now+=100;pending(now)}
  const space=()=>{
    handlers.get('keydown')({code:'Space',preventDefault(){}})
    frame()
    handlers.get('keyup')({code:'Space',preventDefault(){}})
  }
  let game
  try {
    // Collapse course lengths only to exercise transitions quickly; full routes are tested separately.
    STAGES.forEach(s=>s.length=0)
    game=startGame({width:320,height:180,getContext:()=>ctx},target)
    frame()
    for(let i=0;i<7;i++) {
      space()
      for(let f=0;f<35;f++)frame()
      assert.ok(texts.includes(STAGES[i].name))
      assert.ok(texts.includes(i===6?'ALL 7 CLEAR':'CLEAR'))
    }
    space()
    assert.ok(texts.includes(STAGES[0].name))
  } finally {
    game?.destroy()
    STAGES.forEach((s,i)=>s.length=lengths[i])
  }
})
