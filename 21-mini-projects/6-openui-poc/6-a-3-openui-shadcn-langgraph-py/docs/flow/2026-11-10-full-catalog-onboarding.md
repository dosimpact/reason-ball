# SHADCN-003 / MAGIC-001 전체 카탈로그 온보딩

## 배경과 결정

기존 59개 OpenUI 정의는 보조 데이터 타입을 포함하며 공식 컴포넌트 지원 수와 다르다. 공식 shadcn Components와 Magic UI 공개 목록(Community 포함)을 전체 온보딩한다. 별도 AI Elements, Pro 및 템플릿은 제외한다.

사용자 요청에 따라 메인이 공통 계약과 통합을 담당하고 gpt-6.1-sol 에이전트 세 개가 shadcn, Magic UI, 갤러리 및 검사 작업을 병렬 수행한다. 원본 참조, 형제 프로젝트, Goal.md, 환경 및 대화 데이터를 보존한다.

## 진행 및 검증

- 구현 진행 중. 정적 검사, 결정적 전수 갤러리 검사와 실제 모델 검사를 구분한다.
- 카탈로그 변경 후 generate 및 sync:prompt를 수행한다.
- 완료 시 business.md, system.md 및 출처 문서에 검증된 현재 상태를 반영한다.

## 중간 검증

- 공식 매핑: shadcn 66개 페이지, Magic UI 78개 공개 항목. 기존 59개와 추가 38+78개로 OpenUI 정의 175개.
- 결정적 fixture 138개가 모든 정의를 호출하는 것을 AST 기반 계약 검사로 확인했다. 공식 출처 매핑 및 frontend/backend 프롬프트 동일성 검사 통과.
- backend pytest 13개 및 Ruff 통과. frontend typecheck 통과. 전체 lint는 오류 0개, 경고 17개(원본 image 및 hook/컴파일러 관련 경고 포함).
- 실제 모델 카탈로그 smoke: shadcn, Magic UI, 혼합 생성 3개 통과. 이는 스트림 완료와 요청한 컴포넌트 호출 확인이며 화면 검증과 구분한다.
- 기존 실제 모델 smoke: 주가/검색 도구 호출, 후속 대화, 잘못된 요청 400 검사 통과.
- 초기 catalog smoke는 백엔드 준비 전 `fetch failed`로 실패했다. 백엔드 준비 후 동일 시나리오를 재실행해 통과했다.
- 전체 갤러리를 동시에 마운트하던 접근은 선택한 preview만 마운트하도록 변경했다. Shiki 전체 언어 번들 대신 JavaScript 엔진과 명시적 언어 목록을 사용해 첫 컴파일 부담을 줄였다.
- 검토 중 단순 Table을 Data Table 지원으로 잘못 매핑한 부분을 발견하여 실제 TanStack DataTableBlock으로 보완했다.
- 최종 브라우저/빌드 검증은 진행 중이다.

## 상호작용 및 회귀 검증

- 기존 대화 7개 복원/전환/새로고침과 실제 Python 도구→Tabs/Table Chrome 회귀 2개 통과.
- 확장 컨트롤 Chrome 4개 통과: DataTable 정렬/필터/페이지/열 숨김, Combobox 폼 상태, Sheet 포커스 트랩/복귀, 메뉴 액션. Sheet는 controlled child와 명시적 포커스 복귀로 수정했다.
- Magic Chrome 11개 통과: 효과 정리, 지역 테마, 커서, 지역 스크롤, reduced-motion 콘텐츠 보존, 액션, offscreen canvas 정리, 실제 모델 생성 프로그램 3개 렌더링. 원본 controlled theme에서도 전역 document를 변경하던 부분을 수정했다.
- 사용자 요청으로 브라우저 검사를 단일 실행으로 변경했다. 완료된 task-owned MCP 탭 및 테스트 Chrome을 닫았고, 프로세스 cwd를 확인하여 형제 프로젝트의 브라우저는 보존했다.
- 로컬 영상 fixture를 생성했다: ffmpeg color source, 320x180, 2초, H.264 MP4. 외부 미디어 없이 VideoText/HeroVideo를 검증한다. 해당 media 검사는 후속 실행 예정.

## 최종 결과

- `pnpm build` 통과: Next.js 프로덕션 컴파일·TypeScript·정적 페이지 생성 완료, `/component-gallery` 포함.
- 최종 generate → sync:prompt → 계약 검사 통과: shadcn 66개, Magic 78개, OpenUI 175개, fixture 138개. 패키지 프롬프트 53,392바이트 동일.
- 전체 갤러리의 138개 렌더, 필터·키보드·폼, 혼합 desktop/mobile 검사 통과. 기존 Dialog Escape 실패를 controlled state로 수정한 후 해당 overlay 검사 통과.
- 로컬 영상 metadata·해상도·길이와 Hero iframe URL 및 외부 이미지/미디어 요청 없음 검사 통과.
- 검증 결과 경로: `frontend/output/catalog/results`, `output/catalog-overlay-fixed/results`, `output/catalog-media-fixed/results`, `output/expanded-controls/results`, `output/magic-controls/results`, `output/regression/results`. 기존 tracked regression snapshot은 새 결과를 `output/2026-11-10-regression`에 복사한 뒤 원래 상태로 보존했다.
- lint는 오류 0개와 경고 18개(원본 이미지/Hook 관련 등). 범위 내 변경의 whitespace 검사 통과.
- 테스트가 연 Chrome/MCP 탭 및 task-owned 서버 종료. 포트 3046/2038 해제 확인. 형제 프로젝트 브라우저와 사용자 세션은 종료하지 않았다.
- 환경 파일·기존 대화·사용자 Goal.md 보존. LangGraph 실행으로 갱신된 런타임 checkpoint 파일은 데이터 보존 원칙에 따라 유지한다. commit/push는 수행하지 않았다.
- 제품·시스템·출처 stock 문서와 README를 현재 동작에 맞게 동기화했다. 공식 페이지 전체 매핑을 제공하지만 모든 upstream 스타일 변형/props의 일대일 노출이나 향후 임의 모델 프로그램의 전수 검증을 의미하지 않는다.

## 배포 빌드 hydration 확인

개발 중 fixture 소스 변경 시 서버 로그에 `<pre>` hydration 경고가 보여 배포 빌드에서 별도로 확인했다. `pnpm start` 후 Chrome 단일 세션으로 초기 콘텐츠/소스, MagicAuroraText 실제 애니메이션 요소, 사용자 입력 혼합 프로그램을 검사했다. console.error와 pageerror 모두 빈 배열이며 hydration 오류가 재현되지 않았다. 근거: `frontend/output/production-hydration/console.json`. 검증 브라우저를 finally에서 닫고 임시 production 서버도 종료했다.
