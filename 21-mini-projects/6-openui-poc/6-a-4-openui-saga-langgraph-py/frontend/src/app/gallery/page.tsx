"use client";

import dynamic from "next/dynamic";

const Gallery = dynamic(() => import("./gallery"), { ssr: false, loading: () => <p>Loading Saga gallery…</p> });
export default function GalleryPage() { return <Gallery />; }
