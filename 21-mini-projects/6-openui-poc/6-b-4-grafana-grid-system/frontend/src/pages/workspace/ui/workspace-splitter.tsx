"use client";
import { useRef, type Dispatch, type SetStateAction } from "react";

export function WorkspaceSplitter({
  chatWidth,
  setChatWidth,
}: {
  chatWidth: number;
  setChatWidth: Dispatch<SetStateAction<number>>;
}) {
  const splitStart = useRef(48);
  const splitPointer = useRef<number | null>(null);
  return (
    <div
      className="workspace-splitter"
      role="separator"
      tabIndex={0}
      aria-label="대화와 Canvas 너비 조절"
      aria-orientation="vertical"
      aria-valuenow={chatWidth}
      aria-valuemin={30}
      aria-valuemax={70}
      onDoubleClick={() => setChatWidth(48)}
      onKeyDown={(e) => {
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "Home",
            "End",
            "Enter",
            "Escape",
          ].includes(e.key)
        )
          e.preventDefault();
        if (e.key === "Enter") setChatWidth(48);
        if (e.key === "Home") setChatWidth(30);
        if (e.key === "End") setChatWidth(70);
        if (e.key === "Escape") {
          setChatWidth(splitStart.current);
          if (
            splitPointer.current !== null &&
            e.currentTarget.hasPointerCapture(splitPointer.current)
          )
            e.currentTarget.releasePointerCapture(splitPointer.current);
          splitPointer.current = null;
        }
        if (e.key === "ArrowLeft") setChatWidth((v) => Math.max(30, v - 2));
        if (e.key === "ArrowRight") setChatWidth((v) => Math.min(70, v + 2));
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        splitStart.current = chatWidth;
        splitPointer.current = e.pointerId;
        e.currentTarget.focus();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (
          splitPointer.current !== e.pointerId ||
          !e.currentTarget.hasPointerCapture(e.pointerId)
        )
          return;
        const bounds = e.currentTarget.parentElement!.getBoundingClientRect();
        setChatWidth(
          Math.min(
            70,
            Math.max(30, ((e.clientX - bounds.left) / bounds.width) * 100),
          ),
        );
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
        splitPointer.current = null;
      }}
      onPointerCancel={() => setChatWidth(splitStart.current)}
    />
  );
}
