import { useEffect, useState } from 'react';
import AnimatedContent from '@bits/Animations/AnimatedContent/AnimatedContent.jsx';
import './Storybook.css';

export default function Storybook({ memories }) {
  const [page,setPage]=useState(0);
  const [turn,setTurn]=useState('');
  const count=Math.ceil(memories.length/2);
  const go=(delta)=>{if(turn || page+delta<0 || page+delta>=count)return;setTurn(delta>0?'forward':'back');};
  useEffect(()=>{if(!turn)return;const timer=setTimeout(()=>{setPage(p=>p+(turn==='forward'?1:-1));setTurn('');},480);return()=>clearTimeout(timer);},[turn]);
  const left=memories[page*2],right=memories[page*2+1];
  return <section className="storybook-demo" onKeyDown={e=>{if(e.key==='ArrowRight')go(1);if(e.key==='ArrowLeft')go(-1);}} tabIndex={0} aria-label="추억 책, 좌우 방향키로 넘기기">
    <header className="storybook-heading"><span>BOUND TOGETHER, FOREVER</span><h1>The book of us.</h1><p>우리라는 이름으로 묶은, 오래 간직할 이야기.</p></header>
    <AnimatedContent trigger="mount" distance={25} duration={1} className="storybook-stage">
      <div className={`storybook-book ${turn ? `storybook-turn-${turn}`:''}`}>
        <article className="storybook-page storybook-left"><div className="storybook-page-top"><span>OUR LITTLE CHAPTERS</span><span>{String(page*2+1).padStart(2,'0')}</span></div><figure><img src={left?.image} alt={left?.title}/><figcaption>{left?.date}</figcaption></figure><h2>{left?.title}</h2><p>{left?.caption}</p><span className="storybook-page-number">— {page*2+1} —</span></article>
        <article className="storybook-page storybook-right"><div className="storybook-page-top"><span>{String(page+1).padStart(2,'0')} / THE STORY CONTINUES</span><span>♡</span></div><h2>{right?.title || '아직 쓰지 않은 이야기'}</h2><p>{right?.caption || '우리가 함께 채울 내일을 기다리며.'}</p><figure><img src={right?.image || left?.image} alt={right?.title || left?.title}/><figcaption>{right?.date || 'TO BE CONTINUED'}</figcaption></figure><span className="storybook-page-number">— {page*2+2} —</span></article>
        {turn && <div className="storybook-turning-sheet" aria-hidden="true"><span>our story<br/>continues…</span></div>}
      </div>
    </AnimatedContent>
    <nav className="storybook-controls" aria-label="앨범 페이지"><button onClick={()=>go(-1)} disabled={page===0 || !!turn}>← 이전 장</button><span>CHAPTER {String(page+1).padStart(2,'0')} <i>/ {String(count).padStart(2,'0')}</i></span><button onClick={()=>go(1)} disabled={page===count-1 || !!turn}>다음 장 →</button></nav><p className="storybook-hint">종이를 넘기듯, 천천히 · ← → 키로도 넘길 수 있어요</p>
  </section>;
}
