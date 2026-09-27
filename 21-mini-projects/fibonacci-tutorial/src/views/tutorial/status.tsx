import { Button } from "@/shared/ui/button";

export function TutorialLoading() {
  return <div className="loading-screen" role="status"><div className="loading-spinner" /> 차트와 학습 기록을 준비하고 있습니다…</div>;
}

export function TutorialError({ message, onNewSession, pending }: { message: string; onNewSession: () => void; pending: boolean }) {
  return <div className="notice error" role="alert"><strong>학습 기록을 불러오지 못했습니다.</strong><span>{message}</span><Button onClick={onNewSession} disabled={pending}>새 연습 시작</Button></div>;
}
