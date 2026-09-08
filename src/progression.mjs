import {STAGES} from './stage.mjs'
export const stageAfterRun=(index,mode)=>mode==='success'?(index+1)%STAGES.length:index
