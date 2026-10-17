import {paletteCommand} from '../options.mjs';

export function contrastCommand(command) {
  return paletteCommand(command,[
    {name:'min',value:'ratio',default:4.5,parse:value=>{
      if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value)<=1 || Number(value)>21) throw new Error('--min must be greater than 1 and no greater than 21.');
      return Number(value);
    }}
  ]);
}
