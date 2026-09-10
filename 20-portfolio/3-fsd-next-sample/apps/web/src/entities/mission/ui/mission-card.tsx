import { ArrowRight, Clock3, MapPin, Users } from "lucide-react";
import Link from "next/link";
import type { Mission } from "../model/types";

type MissionCardProps = {
  mission: Mission;
  completed?: boolean;
};

const categoryColors: Record<string, string> = {
  여행: "bg-orange-100 text-orange-700",
  일상: "bg-violet-100 text-violet-700",
  관계: "bg-emerald-100 text-emerald-700",
  업무: "bg-sky-100 text-sky-700",
};

export function MissionCard({ mission, completed = false }: MissionCardProps) {
  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-black/6 bg-white p-5 shadow-[0_16px_45px_-35px_rgba(25,18,8,.5)] transition duration-300 hover:-translate-y-1"
      data-testid={`mission-card-${mission.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${categoryColors[mission.category] ?? "bg-neutral-100 text-neutral-700"}`}
        >
          {mission.category}
        </span>
        <span className="text-xs font-semibold text-neutral-400">
          {completed ? "완료 · 보상 해금" : mission.difficulty}
        </span>
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        <h3 className="text-xl font-bold tracking-tight">{mission.title}</h3>
        <p className="mt-1.5 text-sm leading-5 text-neutral-500">{mission.subtitle}</p>
        <div className="mt-5 space-y-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <MapPin className="size-3.5 text-[#e16748]" aria-hidden="true" />
            {mission.location}
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <Clock3 className="size-3.5" aria-hidden="true" />
              약 {mission.durationMinutes}분
            </span>
            <span className="flex items-center gap-2">
              <Users className="size-3.5" aria-hidden="true" />
              {mission.learnerCount.toLocaleString("ko-KR")}명
            </span>
          </div>
        </div>
        <div
          className="mt-5 flex items-center gap-3 rounded-2xl p-3"
          style={{
            background: `linear-gradient(135deg, ${mission.rewardPalette[0]}18, ${mission.rewardPalette[1]}35)`,
          }}
        >
          <span className="text-2xl" aria-hidden="true">
            {mission.rewardEmoji}
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Reward
            </p>
            <p className="text-xs font-semibold text-neutral-700">{mission.rewardTitle}</p>
          </div>
        </div>
      </div>
      <Link
        href={`/missions/${mission.id}`}
        className="mt-5 inline-flex items-center justify-between rounded-xl border border-black/8 px-4 py-3 text-sm font-bold transition group-hover:border-neutral-950 group-hover:bg-neutral-950 group-hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={`${mission.title} 미션 상세 보기`}
      >
        미션 살펴보기 <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

