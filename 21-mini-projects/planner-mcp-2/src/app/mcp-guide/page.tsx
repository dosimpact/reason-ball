import { getMcpCatalog } from "@/app/server/mcp-catalog";
import { getStore } from "@/app/server/runtime";
import { McpGuide } from "@/widgets/workspace/mcp-guide";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page() {
  const tools = await getMcpCatalog(getStore());
  return <McpGuide tools={tools} />;
}
