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

const themes = [
  {
    id: "taupe",
    name: "린넨 웨딩",
    description: "웜 토프 · 테라코타",
    colors: ["#806957", "#a65f4d", "#f8f6f3"],
  },
  {
    id: "pearl",
    name: "펄 블루",
    description: "슬레이트 블루 · 샌드",
    colors: ["#53677f", "#92765e", "#f7f8fa"],
  },
  {
    id: "rosewood",
    name: "로즈우드",
    description: "말린 장미 · 코코아",
    colors: ["#916267", "#796858", "#faf7f6"],
  },
  {
    id: "mocha",
    name: "모카 실크",
    description: "에스프레소 · 카멜",
    colors: ["#665248", "#a17251", "#f9f6f1"],
  },
  {
    id: "midnight",
    name: "이브닝 웨딩",
    description: "잉크 네이비 · 뮤트 브론즈",
    colors: ["#414c62", "#947456", "#f7f7f9"],
  },
];
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
          마음에 드는 분위기를 골라보세요. 선택 즉시 적용됩니다.
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
