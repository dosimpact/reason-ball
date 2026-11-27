export function advanceConfession(state, scenes) {
 const scene=scenes[state.scene];
 if(state.proposal) return state;
 if(state.line<scene.lines.length-1) return {...state,line:state.line+1};
 if(scene.gate) return state;
 return {...state,scene:Math.min(state.scene+1,scenes.length-1),line:0};
}
export function previousConfession(state, scenes) {
 if(state.proposal) return state;
 if(state.line>0) return {...state,line:state.line-1};
 if(state.scene>0) return {...state,scene:state.scene-1,line:scenes[state.scene-1].lines.length-1};
 return state;
}
export function revealConfession(state, scenes) {
 return scenes[state.scene].gate && state.line >= scenes[state.scene].lines.length-1 ? {...state,proposal:true} : state;
}
export function sampleConfessionScenes(memories) {
 const images=memories.map(m=>m.image);
 const photo=(...indices)=>indices.map(i=>images[i%images.length]);
 return [
 {title:'우연이 우리라는 이름이 될 때',chapter:'01 / THE BEGINNING',layout:'split',tone:'light',photos:photo(0,1),lines:['너를 처음 만났던 날을 기억해.','그때는 몰랐어.','그 하루가, 내 인생의 가장 다정한 시작이었다는 걸.']},
 {title:'고마운 마음',chapter:'02 / THANK YOU',layout:'photo',tone:'dark',photos:photo(3,5,6),lines:['내가 나답지 못했던 날에도,','너는 내 편이 되어 주었지.','그 모든 작은 다정함을, 나는 오래 기억하고 있어.']},
 {title:'사랑을 알게 된 순간',chapter:'03 / I REALIZED',layout:'split-reverse',tone:'light',photos:photo(2,4),lines:['함께 본 풍경보다 더 오래 남는 건,','그 풍경을 바라보던 너의 얼굴이었어.','어디에 있든, 네 옆이 내가 돌아가고 싶은 곳이야.']},
 {title:'평범한 날의 확신',chapter:'04 / CERTAINTY',layout:'text',tone:'dark',photos:[],lines:['아주 특별한 하루보다,','별일 없는 수많은 날을 너와 보내고 싶어.','그게 내가 찾던 행복이라는 걸, 이제는 알아.']},
 {title:'우리의 내일',chapter:'05 / ALL OUR TOMORROWS',layout:'split',tone:'light',photos:photo(7,8,5),lines:['언제나 좋은 날만 있지는 않겠지만,','어려운 날에는 먼저 손을 내밀게.','네가 혼자라고 느끼지 않도록, 가장 가까운 사람이 될게.']},
 {title:'너에게 하는 약속',chapter:'06 / MY PROMISE',layout:'photo',tone:'dark',photos:photo(4,9),lines:['익숙함 속에서도 고마움을 잊지 않고,','매일 조금 더 너를 이해하고,','오늘보다 내일, 더 잘 사랑할게.']},
 {title:'그리고, 지금',chapter:'07 / ONE LAST THING',layout:'text',tone:'light',photos:[],lines:['이제, 너에게 꼭 묻고 싶은 말이 있어.'],gate:true}
 ];
}
