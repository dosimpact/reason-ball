import test from 'node:test';
import assert from 'node:assert/strict';
import {cinemaScenes,sceneDuration,stepScene} from './chapterCinemaData.js';
test('excluded photos and empty chapters never enter playback; final scene terminates',()=>{const chapters=[{id:'empty',episodes:[{photos:[{id:'hidden',included:false}]}]},{id:'full',episodes:[{id:'ep',photos:[{id:'a',included:true,duration:5},{id:'b',included:false},{id:'c',included:true,duration:9}]}]}];const scenes=cinemaScenes(chapters);assert.deepEqual(scenes.map(s=>s.id),['title-full','a','c','cinema-end']);assert.equal(stepScene(3,1,scenes.length),3);assert.equal(stepScene(0,-1,scenes.length),0);});
test('photo exposure duration stays usable for invalid edits',()=>{assert.equal(sceneDuration(''),6);assert.equal(sceneDuration(-10),2);assert.equal(sceneDuration(90),30);assert.equal(sceneDuration('7.5'),7.5);});
