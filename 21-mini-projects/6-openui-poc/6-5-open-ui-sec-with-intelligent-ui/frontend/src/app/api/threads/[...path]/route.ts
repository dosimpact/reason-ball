/*
 * OpenUI restStorage의 대화 생성·조회·변경·삭제 요청을 Python 경로로 중계합니다.
 */
import { relay } from "../../../../lib/backend";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  const { path } = await context.params;
  return relay(request, `threads/${path.map(encodeURIComponent).join("/")}`);
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
