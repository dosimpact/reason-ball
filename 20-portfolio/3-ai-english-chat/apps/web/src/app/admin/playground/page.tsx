import { notFound } from "next/navigation";

import { isPlaygroundEnabled } from "@/shared/lib/playground-policy";
import { Playground } from "./_components/playground";

export const dynamic = "force-dynamic";

export default function AdminPlaygroundPage() {
  if (!isPlaygroundEnabled(process.env)) notFound();
  return <Playground />;
}
