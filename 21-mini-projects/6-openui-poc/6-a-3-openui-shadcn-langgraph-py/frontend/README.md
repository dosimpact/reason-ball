# shadcn frontend

Next.js + React + Tailwind + OpenUI shadcn 카탈로그. 프로젝트 통합 안내는 [상위 README](../README.md)를 참조한다.

`pnpm install --frozen-lockfile` → `.env.example`을 `.env`로 복사 → `pnpm generate` → `pnpm sync:prompt` → `pnpm dev`.

http://127.0.0.1:3046 에서 실행하며 Python API 기본 주소는 http://127.0.0.1:2038 이다. `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:smoke`, `pnpm test:e2e`를 제공한다. 실제 모델 키와 도구 실행은 백엔드가 소유한다.
