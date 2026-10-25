"use client";
import { useEffect, useState } from "react";
import {
  dashboardSchema,
  PanelContent,
  type Dashboard,
} from "@/entities/dashboard";
import { ThemeProvider } from "@openuidev/react-ui";
import Link from "next/link";
export default function PrintPage() {
  const [state, setState] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("thread");
    const request = id
      ? fetch(`/api/dashboard/state/${encodeURIComponent(id)}`)
      : Promise.reject(new Error("인쇄할 대화를 선택해 주세요."));
    request
      .then(async (r) => {
        if (!r.ok) throw new Error("대시보드를 불러오지 못했습니다.");
        setState(dashboardSchema.parse(await r.json()));
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <ThemeProvider mode="light">
      <main className="print-report">
        <style>{`.print-report{width:182mm;max-width:100%;margin:30px auto;padding:0;color:#172536;background:white;font-family:Arial;line-height:1.7}.print-report,.print-report *{box-sizing:border-box}.print-report h1,.print-report h2,.print-report h3{break-after:avoid}.print-report input{max-width:100%}.print-report nav{display:flex;justify-content:space-between;margin-bottom:35px}.print-report article{border:1px solid #ccd6e3;border-radius:12px;padding:24px;margin:20px 0;break-inside:auto}.print-report tr,.print-report [class*="chart-container"],.print-report .iui-chart{break-inside:avoid}.print-report a{color:#176b67}.print-report small{color:#53667e}@page{size:A4;margin:14mm}@media print{html,body{background:white!important}.print-report{width:182mm;max-width:182mm}body> :not(.print-report){display:none!important}.print-report nav,.print-report article button{display:none}.print-report{margin:0;padding:0}.print-report article{overflow:visible}}`}</style>
        <nav>
          <Link href="/">← 돌아가기</Link>
          <button onClick={() => window.print()} disabled={!state}>
            PDF로 저장 / 인쇄
          </button>
        </nav>
        <h1>SEC Research · Canvas report</h1>
        <p>전체 탭의 저장된 분석 결과 · {state?.panels.length ?? 0} panels</p>
        {error && <p role="alert">{error}</p>}
        {state?.tabs.map((tab) => (
          <section key={tab.id}>
            <h2>{tab.title}</h2>
            {!state.panels.some((panel) => panel.tab_id === tab.id) && (
              <p>저장된 패널이 없습니다.</p>
            )}
            {state.panels
              .filter((p) => p.tab_id === tab.id)
              .map((panel) => (
                <article key={panel.id}>
                  <h3>{panel.title}</h3>
                  <PanelContent panel={panel} />
                  <small>
                    {panel.sources.map((s, i) => (
                      <div key={i}>
                        {String(s.title ?? "Source")}:{" "}
                        <a href={String(s.url)}>{String(s.url)}</a>
                      </div>
                    ))}
                  </small>
                </article>
              ))}
          </section>
        ))}
      </main>
    </ThemeProvider>
  );
}
