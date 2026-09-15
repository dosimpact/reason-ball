import { Workspace } from "@/widgets/planner-workspace/ui/workspace";
import { catalog } from "./lib/catalog";
export default function Page() {
  return <Workspace catalog={catalog()} />;
}
