export const sceneDuration=value=>Math.min(30,Math.max(2,Number(value)||6));
export function createCinema(memories){
 const groups=[['처음이라는 빛','처음 마주한 우리',0,3],['함께 걷는 계절','작은 날들의 기록',3,6],['다정함이 머문 자리','오래 간직할 풍경',6,8],['지금, 여기의 우리','아직 이어지는 이야기',8,10]];
 return groups.map(([title,episode,start,end],i)=>({id:`chapter-${i}`,title,episodes:[{id:`episode-${i}`,title:episode,photos:memories.slice(start,end).map((memory,index)=>({...memory,id:`sample-${memory.id}`,title:Number(memory.id)===10?'우리가 함께한 시간':memory.title,caption:Number(memory.id)===10?'지나온 모든 장면이 지금의 우리를 만들었어. 이 시간을 오래 기억하고 싶어.':memory.caption,duration:6,included:true,fit:'cover',layout:['hero','diptych','montage','hero'][index%4]}))}]}));
}
export function cinemaScenes(chapters){
 const scenes=[];
 for(const chapter of chapters){const included=chapter.episodes.flatMap(episode=>episode.photos.filter(photo=>photo.included).map(photo=>({kind:'photo',chapter,episode,photo,id:photo.id,duration:sceneDuration(photo.duration)})));if(!included.length)continue;scenes.push({kind:'chapter',id:`title-${chapter.id}`,chapter,duration:3});scenes.push(...included);}
 if(scenes.length)scenes.push({kind:'end',id:'cinema-end',duration:8});
 return scenes;
}
export function stepScene(index,delta,length){return Math.max(0,Math.min(Math.max(0,length-1),index+delta));}
