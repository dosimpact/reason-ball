import { useMemo, useState } from 'react';
import CircularGallery from '@bits/Components/CircularGallery/CircularGallery.jsx';
import './Infinite.css';

export default function Infinite({ memories }) {
  const [active, setActive] = useState(0);
  const items = useMemo(() => memories.map(memory => ({ image: memory.image, text: memory.title, description: `${memory.date} · ${memory.caption}` })), [memories]);
  return <section className="infinite-demo">
    <header className="infinite-heading"><span className="infinite-eyebrow">THE COLLECTION / OUR DAYS</span><h1>A thousand little<br/><em>reasons to love you.</em></h1><p>우리가 함께 모아 온, 반짝이는 순간들.</p></header>
    <div className="infinite-gallery"><CircularGallery items={items} bend={1.7} textColor="#eee9de" font="400 19px Georgia" fontUrl="" itemSize={1.1} itemAspect={0.8} gap={0.18} wave={0.25} borderRadius={0.015} onActiveChange={setActive} /></div>
    <footer className="infinite-footer"><span>← DRAG TO EXPLORE →</span><span className="infinite-count">{String(active + 1).padStart(2, '0')} <i>/ {String(memories.length).padStart(2, '0')}</i></span><span>사진을 눌러 더 가까이 보기 ↗</span></footer>
  </section>;
}
