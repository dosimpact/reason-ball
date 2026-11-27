import { useEffect, useRef } from 'react';
import ScrollReveal from '@bits/TextAnimations/ScrollReveal/ScrollReveal.jsx';
import './Letter.css';

export default function Letter({ memories }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('is-visible'); }), { root: scrollRef.current, threshold: 0.12 });
    scrollRef.current.querySelectorAll('.letter-photo').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <section className="letter-demo" ref={scrollRef}>
    <div className="letter-paper">
      <header className="letter-masthead"><span>A LETTER TO YOU</span><span>ONE & ONLY · VOL. 01</span></header>
      <div className="letter-intro"><span className="letter-sample">SAMPLE LETTER · 예시 편지</span><h1>사랑하는<br/><em>너에게.</em></h1><p>수많은 날들 중에서,<br/>내가 가장 좋아하는 날은 너와 함께한 날이야.</p><a href="#letter-story" onClick={e => { e.preventDefault(); scrollRef.current.querySelector('#letter-story').scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>편지 읽어 내려가기 <span>↓</span></a></div>
      <figure className="letter-photo letter-cover"><img src={memories[0]?.image} alt={memories[0]?.title}/><figcaption>01 / {memories[0]?.date} — {memories[0]?.title}</figcaption></figure>
      <article id="letter-story" className="letter-body"><span className="letter-small">DEAR, MY FAVORITE PERSON</span><ScrollReveal scrollContainerRef={scrollRef} baseRotation={0} baseOpacity={0.25} enableBlur={false} textClassName="letter-reveal">너를 만난 뒤로 평범했던 하루들이 오래 간직하고 싶은 장면이 되었어.</ScrollReveal><p>함께 걷던 길, 별것 아닌 이야기로 웃던 저녁. 사진 속에 남은 건 아주 짧은 순간이지만, 그날의 마음은 아직도 선명해.</p><p>어떤 여행지보다, 어떤 멋진 풍경보다, 그 옆에 네가 있다는 게 가장 좋았어.</p></article>
      <div className="letter-photo-pair">{memories.slice(2,4).map((memory,index) => <figure className="letter-photo" key={memory.id}><img src={memory.image} alt={memory.title}/><figcaption>{String(index+2).padStart(2,'0')} / {memory.title}</figcaption></figure>)}</div>
      <article className="letter-body letter-ending"><span className="letter-small">AND ALL THE DAYS TO COME</span><ScrollReveal scrollContainerRef={scrollRef} baseRotation={0} baseOpacity={0.2} enableBlur={false} textClassName="letter-reveal">우리의 다음 장을 함께 써줄래?</ScrollReveal><p>특별한 날에도, 조금 지치는 날에도.<br/>가장 가까운 곳에서 네 편이 되어 줄게.</p><div className="letter-signature">언제나, 너를 사랑하는 나로부터.</div><span className="letter-heart">♡</span></article>
      <footer className="letter-bottom">이 편지와 사진은 데모를 위한 예시입니다. 우리의 이야기로 채워 주세요.</footer>
    </div>
  </section>;
}
