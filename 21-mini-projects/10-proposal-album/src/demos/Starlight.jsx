import { useState } from 'react';
import Particles from '@bits/Backgrounds/Particles/Particles.jsx';
import './Starlight.css';

const colors = ['#efe5cc', '#c8bcf7', '#ffffff'];
export default function Starlight({ memories }) {
  const [revealed, setRevealed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [photo, setPhoto] = useState(0);
  return <section className={`starlight-demo ${revealed ? 'starlight-revealed' : ''}`}>
    <div className="starlight-particles"><Particles particleColors={colors} particleCount={320} particleSpread={12} particleBaseSize={65} speed={0.065} shape="sparkle" twinkle={0.75} glow={0.7} moveParticlesOnHover particleHoverFactor={0.3} /></div>
    <div className="starlight-orbit starlight-orbit-one"/><div className="starlight-orbit starlight-orbit-two"/>
    <div className="starlight-topline"><span>FOR ALL OUR TOMORROWS</span><span>✧</span><span>YOU + ME, ALWAYS</span></div>
    <div className="starlight-content"><div className="starlight-heading"><span className="starlight-kicker">EVERY STAR LED ME TO YOU</span><h1>{revealed ? 'My forever, is you.' : <>Under the same stars,<br/><em>we found each other.</em></>}</h1><p>{revealed ? '수많은 우연 끝에, 나의 가장 확실한 선택.' : '수많은 별들 사이, 나의 우주는 언제나 너였어.'}</p></div>
      <button className="starlight-photo" onClick={() => setPhoto((photo + 1) % memories.length)} aria-label="다음 추억 사진 보기"><img src={memories[photo]?.image} alt={memories[photo]?.title}/><span>{memories[photo]?.date} <i>✦</i> {memories[photo]?.title}</span></button>
      <div className="starlight-action" aria-live="polite">{!revealed ? <><span className="starlight-prelude">아직 전하지 못한, 가장 소중한 한마디.</span><button className="starlight-reveal-button" onClick={() => setRevealed(true)}>나의 마지막 이야기 열기 <span>↗</span></button></> : <div className="starlight-question"><span className="starlight-ring">◇</span><h2>{accepted ? '우리의 새로운 시작 ♡' : '우리의 다음 장을 함께 써줄래?'}</h2><p>{accepted ? '함께할 모든 내일을 기대하며. 이 순간을 오래 기억할게.' : '오늘의 우리처럼, 앞으로의 모든 날도 함께하고 싶어.'}</p>{!accepted && <button className="starlight-reveal-button" onClick={() => setAccepted(true)}>응, 언제나 함께할게 ♡</button>}<button className="starlight-reset" onClick={() => {setRevealed(false);setAccepted(false);}}>처음부터 다시 보기</button></div>}</div>
    </div><footer className="starlight-footer"><span>사진을 누르면 다음 추억으로</span><span>A PROMISE WRITTEN IN THE STARS</span><span>DEMO · 예시 메시지</span></footer>
  </section>;
}
