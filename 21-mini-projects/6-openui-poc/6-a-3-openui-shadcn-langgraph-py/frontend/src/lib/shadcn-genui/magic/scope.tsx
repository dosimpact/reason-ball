"use client";
import { Component, isValidElement, type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MotionConfig } from "motion/react";
const subscribe=(callback:()=>void)=>{const query=window.matchMedia("(prefers-reduced-motion: reduce)");query.addEventListener("change",callback);return ()=>query.removeEventListener("change",callback);};
const snapshot=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
class EffectErrorBoundary extends Component<{children:ReactNode;label:string},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed ? <p data-magic-error role="status">{this.props.label} is unavailable on this device.</p> : this.props.children;}
}
export function MagicBoundary({children,label}:{children:ReactNode;label:string}) {
 const reduced=useSyncExternalStore(subscribe,snapshot,()=>false);
 const root=useRef<HTMLDivElement>(null);const [visible,setVisible]=useState(false);
 useEffect(()=>{if(!root.current)return;const observer=new IntersectionObserver(([entry])=>setVisible(entry.isIntersecting),{rootMargin:"160px"});observer.observe(root.current);return ()=>observer.disconnect();},[]);
 const supplied=isValidElement<{text?:string;items?:string[];value?:number;beforeCode?:string;afterCode?:string;cards?:{title:string;description:string;href:string;cta:string}[];nodes?:string[];imageSrc?:string;images?:string[];markers?:{latitude:number;longitude:number}[];src?:string}>(children)?children.props:{};
 return <div ref={root} data-magic-scope data-magic-reduced={reduced || undefined} className="relative isolate min-h-32 w-full overflow-hidden rounded-lg p-4" style={{contain:"layout paint",transform:"translateZ(0)"}}><MotionConfig reducedMotion="user"><EffectErrorBoundary label={label}>{reduced ? <div data-magic-static><p>{supplied.text ?? "Magic UI"}</p>{supplied.items?.map((item,i)=><p key={i}>{item}</p>)}{supplied.cards?.map((card,i)=><article key={i}><h3>{card.title}</h3><p>{card.description}</p><a href={card.href}>{card.cta}</a></article>)}{supplied.nodes?.map((node,i)=><p key={i}>{node}</p>)}{supplied.images?.map((src,i)=><img key={i} src={src} alt={`Image ${i+1}`} />)}{supplied.markers?.map((marker,i)=><p key={i}>{marker.latitude}, {marker.longitude}</p>)}{supplied.src && <a href={supplied.src}>Open media</a>}{supplied.imageSrc && <img src={supplied.imageSrc} alt={supplied.text ?? label} />}{(supplied.value !== undefined || label === "number-ticker" || label === "animated-circular-progress-bar") && <output>{supplied.value ?? 75}</output>}{supplied.beforeCode && <pre>{supplied.beforeCode}</pre>}{supplied.afterCode && <pre>{supplied.afterCode}</pre>}</div> : visible ? children : <span role="status">{label.replaceAll("-"," ")}</span>}</EffectErrorBoundary></MotionConfig></div>;
}
