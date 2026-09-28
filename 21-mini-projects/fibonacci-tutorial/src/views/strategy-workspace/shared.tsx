"use client";

import Link from "next/link";
import { catalog } from "@/entities/tutorial";
import { TutorialSidebar } from "@/widgets/tutorial-sidebar";
import styles from "./strategy-workspace.module.css";

export function StrategyShell({ children, crumb }: { children: React.ReactNode; crumb?: string }) {
  return <div className="app-shell"><TutorialSidebar catalog={catalog} activeUnitId="" activeSection="monitoring" /><main className="main-content"><header className="topbar"><nav className="breadcrumb" aria-label="현재 위치"><Link href="/">Fibonacci Lab</Link><span>›</span><Link href="/monitoring">전략 모니터링</Link>{crumb && <><span>›</span><span>{crumb}</span></>}</nav><div className="topbar-right"><span className="topbar-status">교육용 모의 실행</span><div className="avatar">FL</div></div></header><div className={`page-content ${styles.page}`}>{children}</div></main></div>;
}

export function StrategyIntro({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <header className={styles.intro}><div><span className={styles.eyebrow}>STRATEGY WORKSPACE</span><h1>{title}</h1><p>{description}</p></div>{action}</header>;
}

export function utc(time: number | null | undefined): string {
  return time == null ? "—" : `${new Date(time * 1000).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

export function number(value: number | null | undefined, suffix = ""): string {
  return value == null ? "—" : `${value.toFixed(2)}${suffix}`;
}

export function modeName(mode: "BACKTEST" | "FORWARD") { return mode === "BACKTEST" ? "백테스트" : "포워드 테스트"; }
export function controlName(value: string) { return ({ WAITING:"대기", RUNNING:"진행", PAUSED:"일시정지", COMPLETED:"완료", ERROR:"오류" } as Record<string,string>)[value] ?? value; }

export function suggestedCutoff(interval: "1h" | "4h" | "1d") {
  const duration = ({ "1h":3600, "4h":14400, "1d":86400 })[interval];
  const open = Math.floor((Date.now() / 1000 - 121 * duration) / duration) * duration;
  return new Date((open - new Date(open * 1000).getTimezoneOffset() * 60) * 1000).toISOString().slice(0, 16);
}
