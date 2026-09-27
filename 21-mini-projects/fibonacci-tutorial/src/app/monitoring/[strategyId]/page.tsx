import { StrategyDetailView } from "@/views/strategy-workspace";

export default async function StrategyPage({ params }: { params: Promise<{ strategyId: string }> }) {
  const { strategyId } = await params;
  return <StrategyDetailView key={strategyId} strategyId={strategyId} />;
}
