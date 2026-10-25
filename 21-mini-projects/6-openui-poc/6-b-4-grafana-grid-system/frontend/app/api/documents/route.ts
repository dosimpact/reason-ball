/*
 * 문서 목록 요청을 Python으로 전달합니다. 프런트엔드가 PDF나 SQLite를 직접 읽지 않습니다.
 */
import { relay } from "../../../src/shared/lib/backend";
export const runtime = "nodejs";
export async function GET(request: Request) { return relay(request, "documents"); }
