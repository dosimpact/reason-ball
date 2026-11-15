# DART 핵심 API Testing 구현

날짜: 2026-11-15. 결정 ID: `DART-TESTING-001`.

## 요청과 제약

사용자는 Open DART 핵심 5개 API를 NestJS 독립 모듈과 SEC Collector API Testing과 유사한 Host 화면으로 구현하도록 요청했다. 실행 검증은 사용자가 직접 수행한다. 이번 작업에서 테스트·typecheck·lint·build·브라우저·실제 API 호출은 모두 실행하지 않는다. 기존 flow와 human-docs는 수정하지 않으며 커밋하지 않는다.

## 설계와 소유 범위

backend는 BFF 독립 모듈·외부 provider client·설정 및 BFF 패키지 stock을, frontend는 독립 FSD slice·라우트·사이드바 및 Host 패키지 stock을 소유한다. 문서 담당은 [DART 도메인 문서](../stock/dart-api-testing/INDEX.md)와 docs/INDEX 연결을 소유한다. 기존 SEC API와 DB 수집 경로를 변경하거나 DART 전체85개 API로 범위를 넓히지 않는다.

## 진행 상태

문서와 코드의 읽기 전용 현황을 확인하고 패키지 담당자에게 식별자·키 분리, 기존 same-origin proxy, provider와 업무 모듈 분리, ZIP/본문 status 처리 고려사항을 공유했다. 핵심5의 실제 endpoint와 UI 동작은 구현 담당 확인 후 이 기록과 stock에 반영한다. 현재 구현 진행 중이며 실행 검증 완료로 간주하지 않는다.

## 검증과 정리

사용자 요청에 따른 미실행: unit/API E2E/Storybook/브라우저/typecheck/lint/build/실제 인증 API 요청. 실행 성공·PASS를 주장하지 않는다. 수동 확인 절차는 [시스템 설계](../stock/dart-api-testing/system-design.md#사용자-수동-확인-절차)에 둔다. 검증 서버·브라우저·임시 프로필을 생성하지 않았으며 기존 사용자 서비스와 파일은 유지한다.

## BFF 구현 담당 확인

독립 `OpenDartModule`(`src/open-dart`)과 외부 client(`src/lib/dart`), GET `/api/dart/{corpCode.xml,list.json,document.xml,company.json,fnlttSinglAcntAll.json}`을 구현한다. 기존 SEC prefix는 유지하고5개 exact route만 제외한다. 설정 snapshot에서 `API_K_DART`를 읽는 코드를 추가하며 실제 `.env`나 인증키는 열람하지 않는다. JSON DART본문 status 보존, ZIP signature·크기·timeout 제한과 오류XML의502변환을 포함한다. DB/jobs/parsing/viewer는 추가하지 않는다. 이 내용은 담당자의 코드 구현 보고이며 실행 검증 결과가 아니다.

## BFF 최종 반영

담당자 확인으로 BFF 코드·패키지 stock 작성이 완료되었다. 신규 파일은 `src/open-dart/{open-dart.module,open-dart.controller,open-dart.dto}.ts`, `src/lib/dart/dart.client.ts`이며 AppModule/main/중앙 설정에 연결했다. JSON·ZIP 모두 cache no-store, process-local 요청 시작250ms 간격, 자동 retry 없음, 브라우저 abort와 upstream fetch 취소는 연결하지 않는다. 기존 SEC 업무와 DB schema는 변경하지 않았다. 실행 검증은 수행하지 않았다.

## Host 최종 반영과 종료 상태

frontend 담당자 확인으로 `/dart-collector`, `_pages/dart-collector`의 api/model/ui 및 index, Operations 메뉴, Host 패키지 stock의 DART-FE-001 반영이 완료되었다. 고정5GET·키 없는 same-origin 요청, 전송 체크한 query 원문값, 예정 요청/실제 전송 snapshot/응답 복사, HTTP와 DART 업무 status 분리, ZIP64MiB·텍스트1MiB 제한과 object URL 정리를 포함한다. ZIP preset의200 non-ZIP은 body를 보존하면서 형식 오류로 표시하고 서버502 오류는 HTTP 오류로 유지한다.

최종 상태는 **구현 작성 완료·실행 검증 미실행**이다. 사용자 지시대로 테스트·typecheck·lint·build·브라우저·실제 API 호출을 한 번도 실행하지 않았다. 검증 성공을 주장하지 않으며 사용자가 stock의 수동 절차에 따라 확인한다. 검증 자원을 만들지 않았고 커밋하지 않았다. 관련 도메인 stock과 docs/INDEX를 현재 구현 보고에 맞춰 동기화했으며 기존 flow와 human-docs는 수정하지 않았다.
