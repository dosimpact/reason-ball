"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChartNoAxesCombined, Plus } from "lucide-react";
import type { StrategySummary } from "@/entities/strategy";
import { Button } from "@/shared/ui/button";
import { strategyApi } from "./api";
import { StrategyIntro, StrategyShell, controlName, modeName, utc } from "./shared";
import styles from "./strategy-workspace.module.css";

export function StrategyListView() {
  const query = useQuery({ queryKey: ["strategies"], queryFn: strategyApi.list, retry: false });
  return <StrategyShell><StrategyIntro title="전략 모니터링" description="파동 분석 계획을 저장하고, 백테스트와 포워드 테스트의 실행 기록을 살펴보세요." action={<Button asChild><Link href="/monitoring/new"><Plus size={16} /> 새 전략 만들기</Link></Button>} />
    {query.isPending ? <div className={styles.card} role="status">전략 목록을 불러오는 중입니다.</div> : query.isError ? <div className={styles.error} role="alert">{query.error.message} <Button variant="secondary" onClick={() => query.refetch()}>다시 시도</Button></div> : <StrategyListContent strategies={query.data.strategies} />}
    <p className={styles.hint} style={{ marginTop:18 }}>체결은 확정된 OHLC 봉의 교육용 시뮬레이션입니다. 실제 거래소 주문은 발생하지 않습니다.</p>
  </StrategyShell>;
}

export function StrategyListContent({ strategies }: { strategies: StrategySummary[] }) {
  return strategies.length === 0 ? <section className={`${styles.card} ${styles.empty}`}><ChartNoAxesCombined size={28} aria-hidden="true" /><h2>저장된 전략이 없습니다</h2><p className={styles.muted}>시장과 기준 시점을 선택하고 첫 계획을 작성하세요.</p><div className={styles.actions} style={{ justifyContent:"center", marginTop:18 }}><Button asChild><Link href="/monitoring/new">계획 작성 시작 <ArrowRight size={16} /></Link></Button></div></section> : <div className={styles.list}>{strategies.map((strategy) => <Link key={strategy.id} className={styles.listItem} href={`/monitoring/${strategy.id}`}><div><strong>{strategy.title}</strong><span>{modeName(strategy.mode)} · {strategy.source.type === "dummy" ? "더미 시뮬레이션" : `${strategy.source.symbol} ${strategy.source.interval} · Binance`} · 기준 {utc(strategy.asOf)}<br />{strategy.latestRun ? `최근 실행 ${controlName(strategy.latestRun.controlStatus)} · ${strategy.latestRun.monitoring.status} · 관측 ${utc(strategy.latestRun.monitoring.observedThrough)}` : strategy.status === "DRAFT" ? "초안 저장됨 · 계획 작성 대기" : "계획 확정됨 · 실행 대기"}</span></div><b>{strategy.status === "DRAFT" ? "초안" : strategy.latestRun ? controlName(strategy.latestRun.controlStatus) : "확정"} <ArrowRight size={13} /></b></Link>)}</div>;
}
