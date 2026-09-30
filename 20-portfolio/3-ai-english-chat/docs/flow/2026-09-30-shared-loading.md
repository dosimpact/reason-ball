# 공통 애니메이션 로딩 — 2026-09-30

## 배경과 결정

사용자 요청: 이전 변경 커밋 및 각 페이지 로딩 개선. 이전 작업은 `105063f`에 이미 커밋되어 있었다. `UX-LOADING-01`은 기존 비동기 요청/권한/캐시 정책을 유지하면서 대기 상태를 공통 UI로 표시한다.

설계: 설치된 Next.js `loading.md`의 layout 내부 Suspense 규약을 확인했다. `shared/ui/loading-indicator.tsx`는 server/client 모두에서 사용하며 inline/section/page 변형, 의미 있는 한국어 문구, role=status·polite·atomic, 장식 숨김, motion-safe 회전, 영역 최소 높이를 제공한다. characters/missions/history/profile/chat/shared의 route fallback을 둔다. 홈은 client query별 로딩을 표시한다. client query 대기는 별도로 연결한다. 인위적 최소 대기시간이나 유료 생성 요청은 추가하지 않는다.

홈·캐릭터/미션 목록·상세·편집·대화 준비·기록·공유·프로필 하위 영역에 적용한다. 프로필 초기 데이터 대기를 명시하고 오류에는 재시도를 제공하여 기본값/빈 목록을 실제 결과처럼 표시하지 않는다. 이미 존재하는 캐시 데이터는 재조회 시 유지한다. 요청 시간 단축을 측정하거나 보장하는 변경은 아니다.

## 검증

- 프로젝트 루트 `pnpm typecheck`: PASS.
- 프로젝트 루트 `pnpm lint`: PASS, 기존 img 경고5개.
- 상위 저장소 `pnpm typecheck`는 별도 프로젝트 Turbo 설정 파싱 오류로 실패했다. 이 앱은 독립 workspace이므로 해당 설정은 변경하지 않았으며 앱의 scoped 검사는 통과했다.
- 브라우저 지연 응답, reduced-motion, 모바일 및 Docker 빌드: 진행 중.

영향: 비즈니스 NFR-03, 시스템 접근성/표시 상태, 테스트 UX-LOADING-01.

## 최종 검증 결과

- 실제 dev3322 캐릭터 API5초 지연: 표시→데이터 도착 후 제거 PASS. computed animationName 일반 `spin`, reduced-motion `none` 확인.
- 모바일390×844 프로필 API2초 지연: 로딩→실제 프로필 표시 PASS, 가로 overflow 없음.
- 프로필 preferences503 mock: 로딩 종료·오류 안내·재시도 후 실제 응답 복구 PASS. 강제503의 console 네트워크 오류1개는 의도한 결과다.
- Docker production build PASS, 기존 로컬env 그대로 owned container 재기동. Google 이미지/영상/음성 생성 호출0.
- 초기 브라우저 검증 세션에서 route 중복 처리 오류가 발생해 해당 결과는 성공으로 세지 않았다. 별도 named session에서 위 시나리오를 재검증했다.
- 시각 증거: [데스크톱](evidence/2026-09-30-shared-loading/characters-desktop.png), [모바일](evidence/2026-09-30-shared-loading/profile-mobile.png).

전체 AI/DB 회귀를 재실행한 결과가 아니라 로딩 표시·복구와 production 빌드 검증이다.

- production 확인에서 루트 loading 경계가 비운영 Playground의404를 streamed200으로 바꾸는 부작용을 발견했다. 루트 경계를 제거하고 공개 라우트별 경계만 유지한다. 관리 경로의 응답 상태를 보존하기 위한 수정이다.

- 최종 수정 Docker 재빌드·재기동 PASS. localhost3325 캐릭터200, Playground404, container running/healthy 확인. production 브라우저 캐릭터 실데이터 및 프로필 로드 PASS. 최종 lint0오류/기존5경고.
