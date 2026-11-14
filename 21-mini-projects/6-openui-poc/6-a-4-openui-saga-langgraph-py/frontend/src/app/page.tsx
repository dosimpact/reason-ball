"use client";
import dynamic from "next/dynamic";
const SagaChatShell = dynamic(() => import("@/components/saga/chat-shell").then(module => module.SagaChatShell), { ssr: false });
export default function Page() { return <SagaChatShell/>; }
