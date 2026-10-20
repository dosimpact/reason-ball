import {describe,it,expect} from 'vitest';
import {createLibrary,defineComponent} from '@openuidev/react-lang';
import {z} from 'zod';
import {registerCanvasElement,validateRegistered} from '../ui/registration';
import {library} from '@/shared/ui/openui';
const content=(program:string)=>({registrationId:'openui',registrationVersion:1,sourceId:'test',title:'Test',program,uiState:{}});
describe('Canvas registration boundary',()=>{
 it('accepts form state and local component declarations before root',()=>{
  const program='$name = ""\nform = Form([Input($name, "이름"), Button("초기화", @Reset($name))])\nroot=Col([form])';
  expect(validateRegistered(content(program)).program).toBe(program);
 });
 it.each(['root = Col([Text("note")])','root = Col([Table(["A"], [[1]])])','root = Col([Input($name, "Name")])\n$name = "initial"'])('accepts a standalone base element composition: %s',program=>{
  expect(validateRegistered(content(program)).program).toBe(program);
 });
 it('registers a new developer component library without changing Canvas panels',()=>{
  const Custom=defineComponent({name:'CustomStatus',description:'Custom status component',props:z.object({text:z.string()}),component:()=>null});
  const custom=createLibrary({root:'Col',components:[...Object.values(library.components),Custom]});
  registerCanvasElement({id:'custom-test',version:1,library:custom});
  const program='root = Col([CustomStatus("Ready")])';
  expect(validateRegistered({...content(program),registrationId:'custom-test'}).program).toBe(program);
  expect(()=>registerCanvasElement({id:'custom-test',version:1,library:custom})).toThrow('Duplicate');
 });
 it('rejects unsupported registration versions and unbound outer variables',()=>{
  expect(()=>validateRegistered({...content('root = Col([Text("note")])'),registrationVersion:2})).toThrow();
  expect(()=>validateRegistered(content('root = Col([Text(outside)])'))).toThrow();
 });
});
