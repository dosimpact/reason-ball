import { listDummyCutoffs } from "@/server/strategies/data";

export async function GET(): Promise<Response> {
  return Response.json(listDummyCutoffs());
}
