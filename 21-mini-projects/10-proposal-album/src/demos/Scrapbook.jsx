import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import ClickSpark from '@bits/Animations/ClickSpark/ClickSpark.jsx';
import './Scrapbook.css';

const spots=[{x:7,y:7,r:-12},{x:35,y:2,r:7},{x:65,y:11,r:-6},{x:18,y:47,r:6},{x:48,y:46,r:-8},{x:73,y:48,r:12}];
export default function Scrapbook({memories}){
 const board=useRef(null),dragged=useRef(false),close=useRef(null),dialog=useRef(null),opener=useRef(null);
 const [selected,setSelected]=useState(null),[layout,setLayout]=useState(0),[top,setTop]=useState(null),[page,setPage]=useState(0);
 const pageCount=Math.ceil(memories.length/6);
 const visible=memories.slice(page*6,page*6+6);
 const changePage=delta=>{setPage(p=>Math.max(0,Math.min(pageCount-1,p+delta)));setLayout(v=>v+1);setTop(null);};
 useEffect(()=>{
   if(!selected)return;
   const modal=dialog.current;
   const previousOverflow=document.body.style.overflow;
   document.body.style.overflow='hidden';
   modal.showModal();
   close.current?.focus();
   return()=>{modal.close();document.body.style.overflow=previousOverflow;opener.current?.focus();};
 },[selected]);
 return <section className="scrapbook-demo"><ClickSpark sparkColor={['#d46740','#d7a948','#73918b']} shape="star" sparkCount={6} sparkRadius={25}>
  <header className="scrapbook-header"><div><span>LITTLE MOMENTS, BIG FEELINGS</span><h1>우리의 조각 모음<span>✳</span></h1><p>엉뚱한 날도, 웃음이 터진 날도. 모두 붙여 두었어.</p></div><button onClick={()=>{setLayout(v=>v+1);setTop(null);}}>↻ 처음 배치로</button></header>
  <div className="scrapbook-board" ref={board}><span className="scrapbook-doodle scrapbook-doodle-one" aria-hidden="true">you + me<br/><i>♡</i></span><span className="scrapbook-doodle scrapbook-doodle-two" aria-hidden="true">the good<br/>old days ↗</span><span className="scrapbook-note">TO DO:<br/>☑ 같이 웃기<br/>☑ 오래 사랑하기<br/>☐ 다음 모험 떠나기</span>
   {visible.map((m,i)=><motion.button key={`${layout}-${m.id}`} className={`scrapbook-card scrapbook-card-${i}`} drag dragConstraints={board} dragElastic={.15} dragMomentum={false} onDragStart={()=>{dragged.current=true;setTop(m.id);}} onDragEnd={()=>setTimeout(()=>{dragged.current=false;},100)} onPointerDown={()=>{dragged.current=false;setTop(m.id);}} onClick={event=>{if(!dragged.current){opener.current=event.currentTarget;setSelected(m);}}} whileDrag={{scale:1.07,rotate:0}} whileHover={{scale:1.025}} style={{left:`${spots[i].x}%`,top:`${spots[i].y}%`,rotate:spots[i].r,zIndex:top===m.id?20:i+1}} aria-label={`${m.title}, 드래그로 이동하거나 눌러 이야기 보기`}><span className="scrapbook-tape"/><img src={m.image} alt={m.title} draggable={false}/><span className="scrapbook-card-title">{m.title}</span><span className="scrapbook-card-date">{m.date} <i>♡</i></span></motion.button>)}
  </div><nav className="scrapbook-pagination" aria-label="스크랩북 페이지"><button onClick={()=>changePage(-1)} disabled={page===0}>← 이전 페이지</button><span>PAGE {String(page+1).padStart(2,'0')} / {String(pageCount).padStart(2,'0')} <i>· {page*6+1}–{Math.min((page+1)*6,memories.length)} OF {memories.length} PHOTOS</i></span><button onClick={()=>changePage(1)} disabled={page===pageCount-1}>다음 페이지 →</button></nav><footer className="scrapbook-footer"><span>사진을 끌어서 나만의 페이지를 만들어요</span><span>CLICK A PHOTO TO READ ITS STORY ↗</span><span>{String(memories.length).padStart(2,'0')} HAPPY LITTLE THINGS</span></footer>
  <dialog ref={dialog} className="scrapbook-modal" aria-labelledby="scrapbook-modal-title" onCancel={event=>{event.preventDefault();setSelected(null);}} onClick={event=>{if(event.target===event.currentTarget)setSelected(null);}}>{selected&&<div className="scrapbook-modal-paper"><button ref={close} className="scrapbook-close" onClick={()=>setSelected(null)} aria-label="사진 닫기">×</button><img src={selected.image} alt={selected.title}/><span>{selected.date}</span><h2 id="scrapbook-modal-title">{selected.title}</h2><p>{selected.caption}</p><i>우리의 아주 작은, 커다란 행복.</i></div>}</dialog>
 </ClickSpark></section>;
}
