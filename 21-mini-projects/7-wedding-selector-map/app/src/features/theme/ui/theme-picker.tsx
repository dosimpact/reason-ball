"use client";
import { useSyncExternalStore } from "react";
import { Palette, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/shared/ui/dialog";

import { themes } from "../model/themes";

function snapshot() {
  return document.documentElement.dataset.theme || "taupe";
}
function subscribe(callback: () => void) {
  window.addEventListener("orot-theme", callback);
  return () => window.removeEventListener("orot-theme", callback);
}
export function ThemePicker() {
  const selected = useSyncExternalStore(subscribe, snapshot, () => "taupe");
  function select(id: string) {
    document.documentElement.setAttribute("data-theme", id);
    try {
      localStorage.setItem("orot:theme", id);
    } catch {
      /* Session selection still works. */
    }
    window.dispatchEvent(new Event("orot-theme"));
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="theme-launcher" aria-label="컬러 테마 선택">
          <Palette size={20} />
          <span>테마</span>
        </button>
      </DialogTrigger>
      <DialogContent className="theme-dialog">
        <DialogTitle>우리의 웨딩 컬러</DialogTitle>
        <DialogDescription>
          차분한 컬러부터 선명한 컬러까지, 10가지 분위기를 골라보세요.
        </DialogDescription>
        <div className="theme-options" role="group" aria-label="컬러 팔레트">
          {themes.map((theme) => (
            <button
              key={theme.id}
              className="theme-option"
              aria-pressed={selected === theme.id}
              onClick={() => select(theme.id)}
            >
              <span className="theme-swatches" aria-hidden="true">
                {theme.colors.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <span>
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
              </span>
              {selected === theme.id && <Check size={18} aria-label="선택됨" />}
            </button>
          ))}
        </div>
        <p className="theme-note">
          이 브라우저에 저장됩니다. 지도 배경은 Positron을 유지합니다.
        </p>
      </DialogContent>
    </Dialog>
  );
}
