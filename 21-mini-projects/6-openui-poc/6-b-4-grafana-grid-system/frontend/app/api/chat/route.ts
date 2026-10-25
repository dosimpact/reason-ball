/*
 * 채팅 요청과 응답 스트림을 Python 비교 API로 중계합니다. 대화 저장과 모델 실행은 백엔드 책임입니다.
 */
import { relay } from "../../../src/shared/lib/backend";
export const runtime = "nodejs";
export async function POST(request: Request) { return relay(request, "chat"); }
