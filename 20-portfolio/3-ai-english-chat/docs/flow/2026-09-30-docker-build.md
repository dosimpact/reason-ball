# 2026-09-30 Docker 빌드·실행 설계

## 배경과 결정

사용자는 로컬 환경을 사용하는 빌드 서비스와 Docker/package.json 명령을 요청하고 turbo prune을 제안했다. 현재 상위 `pnpm-workspace.yaml`은 이 프로젝트를 명시적으로 제외하고, 프로젝트 내부는 `apps/web` 하나인 독립 pnpm workspace다. 상위 workspace 편입이나 Turbo 의존성 추가 없이 프로젝트만 build context로 사용한다. 내부 공유 패키지가 늘어나면 이 workspace 안에서 `turbo prune @ai-english-chat/web --docker`를 도입할 수 있다.

## 구현 계획 및 수용 기준

- Docker 다단계: manifests/lockfile 의존성 설치 → 소스 빌드 → Next standalone 비root 실행.
- `NEXT_STANDALONE=1`일 때만 standalone 출력. 기존 개발·production preview 빌드 동작 유지.
- `.dockerignore`로 환경파일, node_modules, 로컬 산출물/테스트보고서를 제외.
- package scripts: docker:build/up/down/logs. Node22 parseEnv로 `.env.local`의 따옴표를 해석하고 shell interpolation 없이 Docker 실행.
- 빌드는 명시적인 NEXT_PUBLIC allowlist만 전달. 서버 비밀값은 실행 때만 전달하고 인수/로그에 출력하지 않음.
- 실행 기본 localhost:3325, 키·provider는 로컬 설정 유지. 컨테이너 네트워크에 필요한 OAuth loopback→host.docker.internal과 외부 origin 허용만 보정.
- 실행·종료는 지정한 Lingua 컨테이너만 대상. 이름 충돌 시 자동 삭제하지 않음.
- 실제 Docker build, HTTP·정적 자산·브라우저 smoke, 이미지 환경파일/비밀값 미포함 확인. 실제 유료 생성은 호출하지 않음.

## 근거

- [Turbo prune](https://turborepo.dev/docs/reference/prune): 필요한 workspace/lockfile와 Docker용 json/full 출력 분리.
- 설치된 Next16.3.4 로컬 output/environment-variables 문서: standalone tracing root, public/static 별도 복사, 공개 환경변수 build-time 고정.
- [Next 환경변수](https://nextjs.org/docs/pages/guides/environment-variables).

## 검증

- `pnpm docker:build`: PASS. 초기에는 테스트를 context에서 제외하면서 Playwright 설정이 남아 TS2307 실패; 설정도 함께 제외한 뒤 빌드 통과. 의존성 설치 단계 캐시 재사용 확인.
- `pnpm docker:up`, `docker:down` 후 재실행: PASS. localhost3325 응답200 유지, 기존3322/3324와 다른 컨테이너 유지.
- 컨테이너: nonroot uid1000, image302,599,292바이트, healthcheck healthy.
- HTTP 홈/캐릭터/미션200, Playground404. Playwright 홈 실제 캐릭터·학습 요약 로딩, console error0.
- 컨테이너에서 로컬 OAuth proxy `/models`200. 모델 목록 접근 검증이며 채팅 생성 검증은 아니다. 실제 이미지·영상·TTS 호출 없음.
- 이미지 파일시스템 `.env*` 없음. 설정된 서버 비밀값3개 원문 검색0건. 첫 광범위 검사에서 공개 SUPABASE_PUBLISHABLE_KEY가 검출되어 공개 alias를 분리했다; 공개키 번들 포함은 정상이며 서버 비밀값 노출과 구분한다.
- `pnpm lint`: 오류0, 기존 img 경고5. Docker build의 TypeScript 검사 PASS.
- `git diff --check`: PASS. 시스템7절·테스트 저량·AGENTS·사용법 동기화.

최종 서비스 `http://localhost:3325`를 실행 상태로 유지했다. 원본 reason-ball 경로에는 아직 적용하지 않았으며 기존 feat/talkie-google-media 워크트리의 변경이다.
