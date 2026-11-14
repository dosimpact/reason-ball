import type { ActionSchema } from "../action";
export interface MagicProps { action?:ActionSchema; nodes?:string[]; edges?:{from:number;to:number}[]; cards?:{title:string;description:string;href:string;cta:string}[]; text?:string; items?:string[]; value?:number; src?:string; imageSrc?:string; beforeCode?:string; afterCode?:string; tweetId?:string; }
