# ckit-mcp-server 구현 계획 및 검증 방법

## 1. 목적

`/Users/dodo/workspace/projects/harness-engineering-3/.bkit-codex/packages/mcp-server`를 기준으로, 다음 조건을 만족하는 distill 버전의 MCP 서버를 새로 구현한다.

- 출력 디렉터리: `/Users/dodo/workspace/projects/harness-engineering-3/ckit-mcp-server`
- 리브랜딩: `bkit` -> `ckit`
- 구현 언어: JavaScript 기반 코드를 TypeScript로 전환
- 제거 대상 도구 제외
  - `bkit_classify_task`
  - `bkit_detect_level`
  - `bkit_check_deliverables`

최종 목표는 원본 서버의 핵심 PDCA 기능을 유지하면서, 더 단순한 13개 도구 구성의 TypeScript MCP 서버를 제공하는 것이다.

## 2. 현재 기준점

원본 서버 구조는 이미 비교적 명확하게 분리되어 있다.

- 엔트리포인트: `index.js`
- 서버 구현: `src/server.js`
- 도구 등록: `src/tools/index.js`
- 개별 도구: `src/tools/*.js`
- 공통 라이브러리: `src/lib/**`
- 테스트: `tests/**/*.test.js`

특히 `src/tools/index.js` 기준으로 현재 도구 등록은 16개이며, 여기서 3개를 제거하면 최종 대상은 13개다.

## 3. 최종 도구 범위

### 포함 도구

- `ckit_init`
- `ckit_analyze_prompt`
- `ckit_get_status`
- `ckit_pre_write_check`
- `ckit_post_write`
- `ckit_complete_phase`
- `ckit_pdca_plan`
- `ckit_pdca_design`
- `ckit_pdca_analyze`
- `ckit_pdca_next`
- `ckit_select_template`
- `ckit_memory_read`
- `ckit_memory_write`

### 제거 도구

- `bkit_classify_task`
- `bkit_detect_level`
- `bkit_check_deliverables`

### 리브랜딩 대상

- 도구 이름 prefix: `bkit_` -> `ckit_`
- 서버 이름: `bkit-codex-mcp` 계열 문자열 -> `ckit-mcp` 계열 문자열
- 패키지 이름, 설명, README 예시, 로그 문구, 테스트 문자열

## 4. 구현 원칙

- 원본과 동작 호환성을 최대한 유지하되, 불필요한 도구는 제거한다.
- 단순 복붙 이식이 아니라 TypeScript 타입 구조를 도입한다.
- 외부 API 동작은 기존 JSON-RPC 2.0 over STDIO 패턴을 유지한다.
- 제거된 도구를 참조하는 내부 코드가 남지 않도록 의존 관계를 함께 정리한다.
- 템플릿과 상태 파일 처리 방식은 원본 의미를 바꾸지 않는다.

## 5. 구현 단계

### Phase 1. 원본 서버 분석

목표:
- 각 도구의 입력 스키마, 출력 형식, 내부 의존성을 파악한다.
- 제거 대상 3개가 다른 도구에서 간접 참조되는지 확인한다.

작업:
- `src/tools/index.js` 기준으로 도구 등록 맵 정리
- 각 `src/tools/*.js`의 `definition`, `handler` 인터페이스 확인
- `src/lib/**`에서 제거 대상 도구 관련 함수 사용처 검색
- 테스트 케이스 중 제거 대상에 직접 연결된 파일 분류

산출물:
- 도구별 매핑표
- 제거 영향도 목록

### Phase 2. TypeScript 프로젝트 스캐폴딩

목표:
- `ckit-mcp-server`를 독립 실행 가능한 TypeScript 패키지로 만든다.

작업:
- `package.json` 작성
- `tsconfig.json` 작성
- `src/` 디렉터리 구조 설계
- 빌드 산출물 디렉터리 결정 (`dist/` 권장)
- 실행 스크립트 정의
  - `build`
  - `start`
  - `test`

권장 구조:

```text
ckit-mcp-server/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts
    server.ts
    tools/
    lib/
  tests/
  dist/
```

### Phase 3. 서버 코어 포팅

목표:
- `src/server.js`와 `index.js`를 TypeScript로 이관한다.

작업:
- JSON-RPC 요청/응답 타입 정의
- 서버 상태 타입 정의
  - `initialized`
  - `projectDir`
- `initialize`, `tools/list`, `tools/call` 처리 로직 이식
- 서버 정보 문자열을 `ckit` 기준으로 교체

검토 포인트:
- 기존 에러 처리 방식 유지 여부
- `tools/call` 결과를 MCP content 형식으로 감싸는 구조 유지 여부

### Phase 4. 도구 레이어 포팅 및 리브랜딩

목표:
- 남길 13개 도구만 TypeScript로 포팅하고 이름을 `ckit_*`으로 바꾼다.

작업:
- 각 도구 파일을 `.ts`로 변환
- 공통 타입 도입
  - `ToolDefinition`
  - `ToolHandler`
  - `ToolContext`
- `src/tools/index.ts`에서 최종 13개만 등록
- definition 내부의 tool name도 모두 `ckit_*`으로 변경

주의:
- 입력 파라미터 이름은 기존 사용자 사용성을 고려해 유지할지 검토 필요
- 출력 JSON 내부 key까지 모두 `ckit`로 바꿀지는 명확한 기준이 필요
  - 권장: 도구명/서버명만 리브랜딩하고, 데이터 구조 key는 의미 변경이 없는 한 최소 수정

### Phase 5. 공통 라이브러리 정리

목표:
- 도구가 사용하는 `src/lib/**`를 TypeScript로 포팅하고, 제거 도구 관련 코드나 불필요한 분기를 정리한다.

작업:
- `src/lib/core/**` 포팅
- `src/lib/pdca/**` 포팅
- `src/lib/intent/**` 포팅
- `src/lib/task/classification.js`처럼 제거 도구 전용으로 보이는 모듈은 삭제 또는 제외
- 템플릿 로딩 로직과 파일 경로 처리 검증

주의:
- `detect-level` 제거 시에도 `init` 또는 다른 PDCA 로직이 레벨 판별 함수를 내부적으로 쓰는지 확인 필요
- 만약 내부 레벨 판별이 필요하면, 공개 도구는 제거하되 내부 유틸은 유지해야 한다

### Phase 6. 템플릿 및 문서 이관

목표:
- 템플릿 파일과 README를 `ckit` 기준으로 정리한다.

작업:
- `src/lib/templates/*.md` 이관
- README 사용 예시의 도구명 변경
- 제거 도구 관련 설명 삭제
- 설치 및 실행 예시를 TypeScript 빌드 흐름에 맞게 갱신

### Phase 7. 테스트 포팅 및 정리

목표:
- 기존 테스트 자산을 최대한 재사용하되, 제거 범위와 리브랜딩을 반영한다.

작업:
- 서버 테스트: `initialize`, `tools/list`, `tools/call`
- 도구 테스트: 남은 13개만 유지
- 제거 도구 테스트 삭제 또는 비활성화
- 문자열 기대값을 `ckit_*` 기준으로 갱신
- TypeScript 환경에서 테스트 실행되도록 설정

## 6. 주요 리스크와 대응

### 1. 제거 도구의 내부 의존성 누락

위험:
- 공개 도구만 삭제하고 내부 참조를 남기면 런타임 오류가 발생한다.

대응:
- `rg "classify|detect-level|deliverables|bkit_detect_level|bkit_check_deliverables|bkit_classify_task"`로 전체 참조 검색
- 삭제 전후 `tools/list`와 핵심 호출 테스트를 모두 수행

### 2. TypeScript 전환 중 런타임 의미 변화

위험:
- 경로 처리, JSON 직렬화, undefined 처리 차이로 동작이 달라질 수 있다.

대응:
- 함수 시그니처만 타입화하고 초기에는 로직 변경을 최소화
- 원본 테스트를 기준으로 회귀 확인

### 3. 리브랜딩 범위 과확장

위험:
- 사용자 메시지, 상태 파일 key, 내부 구조까지 무리하게 바꾸면 호환성이 깨질 수 있다.

대응:
- 1차 버전은 외부 식별자 중심 리브랜딩 수행
- 내부 데이터 구조는 요구사항에 꼭 필요한 부분만 수정

### 4. 템플릿/파일 경로 문제

위험:
- 템플릿 파일 위치 변경으로 런타임에 파일을 찾지 못할 수 있다.

대응:
- 상대경로 사용처 점검
- 빌드 후 `dist` 기준 실행 테스트 포함

## 7. 검증 방법

검증은 `정적 검증 -> 단위 검증 -> 통합 검증 -> 회귀 검증` 순서로 진행한다.

### A. 정적 검증

목적:
- TypeScript 전환이 완료되었고 기본 구조가 올바른지 확인

항목:
- `tsc --noEmit` 통과
- 빌드 성공
- `tools/index.ts`에 정확히 13개 도구만 등록되었는지 확인
- `tools/list` 결과에 제거 대상이 포함되지 않는지 확인

성공 기준:
- 타입 오류 0건
- 빌드 오류 0건
- 도구 수 13개

### B. 단위 검증

목적:
- 개별 도구와 라이브러리 함수의 로직 보존 확인

항목:
- `ckit_init`
- `ckit_get_status`
- `ckit_pre_write_check`
- `ckit_post_write`
- `ckit_complete_phase`
- `ckit_pdca_plan`
- `ckit_pdca_design`
- `ckit_pdca_analyze`
- `ckit_pdca_next`
- `ckit_analyze_prompt`
- `ckit_select_template`
- `ckit_memory_read`
- `ckit_memory_write`

성공 기준:
- 각 도구의 정상 입력 케이스 통과
- 필수 에러 케이스 통과

### C. 통합 검증

목적:
- MCP 서버로 실제 요청을 보냈을 때 프로토콜 레벨에서 정상 동작하는지 확인

시나리오:
1. `initialize` 호출
2. `notifications/initialized` 전송
3. `tools/list` 호출
4. `tools/call`로 핵심 도구 실행

핵심 확인:
- `serverInfo.name`이 `ckit` 기준인지
- `tools/list`에 13개 도구만 노출되는지
- `tools/call` 응답이 MCP `content` 배열 형식을 유지하는지
- 에러 시 `isError: true` 동작이 유지되는지

### D. 회귀 검증

목적:
- 원본 bkit 서버와 비교했을 때 제거 대상 외 기능이 의도치 않게 깨지지 않았는지 확인

방법:
- 동일 입력에 대해 원본과 `ckit` 결과를 비교
- 비교 대상은 제거되지 않은 13개 도구만 한정
- 문자열 전체 일치보다 구조와 핵심 의미 일치 여부를 우선 확인

우선 비교 대상:
- `init`
- `get_status`
- `pdca_plan`
- `pdca_design`
- `pdca_next`
- `memory_read`
- `memory_write`

## 8. 권장 테스트 케이스

### 서버 레벨

- 정상 `initialize`
- 존재하지 않는 method 호출
- 존재하지 않는 tool 호출
- `tools/call`에서 name 누락

### 도구 레벨

- 세션 초기화 전 `get_status`
- 잘못된 feature 이름 입력
- 파일이 없는 상태에서 `memory_read`
- 쓰기 후 `memory_read` 일관성
- 템플릿 생성 시 level별 분기

### 제거 검증

- `tools/list`에 다음 이름이 없어야 한다
  - `bkit_classify_task`
  - `bkit_detect_level`
  - `bkit_check_deliverables`
- `tools/call`로 위 세 이름 호출 시 실패해야 한다

## 9. 완료 기준

다음 조건을 모두 만족하면 1차 구현 완료로 본다.

- `ckit-mcp-server` 디렉터리가 생성되어 있다
- TypeScript 빌드가 성공한다
- 최종 MCP 도구가 정확히 13개다
- 제거 대상 3개가 외부 인터페이스에서 완전히 사라진다
- 핵심 통합 테스트가 통과한다
- README에 설치, 빌드, 실행, 도구 목록이 반영되어 있다

## 10. 권장 작업 순서

1. 원본 서버의 도구/라이브러리 의존 관계를 표로 정리한다.
2. `ckit-mcp-server` TypeScript 패키지 뼈대를 만든다.
3. 서버 코어를 먼저 포팅한다.
4. 남길 13개 도구를 순차적으로 포팅한다.
5. 제거 대상 관련 코드를 정리한다.
6. 템플릿과 README를 이관한다.
7. 테스트를 포팅하고 회귀 검증을 수행한다.
8. 최종적으로 `tools/list` 결과와 실제 호출 결과를 확인한다.

## 11. 구현 착수 전 확인사항

- `ckit` 리브랜딩 범위를 어디까지 볼지 확정 필요
  - 도구명만 변경할지
  - 응답 내부 텍스트와 로그까지 전면 변경할지
- TypeScript 실행 방식 확정 필요
  - 빌드 후 Node 실행
  - 런타임 TS 실행 도구 사용 여부
- 테스트 러너 확정 필요
  - Node 내장 테스트 유지
  - 다른 테스트 프레임워크 도입 여부

현재 요구사항 기준으로는 다음 선택이 가장 안전하다.

- 빌드 후 Node 실행 방식
- Node 내장 테스트 유지
- 외부 인터페이스 중심의 최소 리브랜딩
