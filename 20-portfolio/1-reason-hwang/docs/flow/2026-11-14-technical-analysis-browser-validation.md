# 기술적 분석 실제 브라우저·PNG 검증

- 날짜: 2026-11-14
- 요구사항: TA-001~005, TA-VAL-20261114
- 요청: 가능한 사용 사례를 실제 브라우저에서 실행하고 `docs/human-docs/2.기술적분석/`에 PNG로 보고.
- 사용자의 이번 명시 요청을 해당 폴더의 신규 보고서·PNG 생성 권한으로 적용했다. 기존 human-docs 문서는 수정하지 않았다.
- 보고서: [상세 검증보고서](../human-docs/2.기술적분석/2026-11-14-browser-validation/검증보고서.md)
- [요약 PNG](../human-docs/2.기술적분석/2026-11-14-browser-validation/00-validation-summary.png), 원본 화면 18장 포함 총 PNG 19장.

## 범위와 결과

실제 Chromium에서 Yahoo Finance·실제 모델(OAuth proxy)·TA-Lib·OpenUI validator를 사용했다. fixture/mock 응답으로 UI를 대체하지 않았다. MCP로 직접 화면을 탐색·입력·확인하고 PNG를 촬영했다. 요약 PNG는 결과 표와 원본 캡처를 배치한 summary.html을 브라우저로 캡처했다. 원본 화면 이미지 자체를 편집하지 않았다.

12개 시나리오: PASS 10 / WARN 1 / FAIL 1. 기본 일봉, 주봉, 후속 설정 변경, 국내 ticker, 미지원 EMA, 잘못된 ticker, 200봉, 모바일, 그래프/대화 격리, 5분봉 제한은 PASS. 잘못된 기간은 경고 후 기본값 계산으로 WARN. 최초 환경 프록시 2981 연결 거부는 FAIL이며, 검증 FE 프로세스만 2982로 연결한 뒤 실제 분석을 계속했다. 실패를 성공으로 바꾸어 집계하지 않았다.

별도 `pnpm -C 3-langgraph-fast test:technical-analysis`: fixture/mock 회귀 46/46 PASS (2.40s). 실제 브라우저 검증과 구분한다. VAL-BROWSER-001 증거는 상세 보고서와 PNG에 있다. 애플리케이션 코드와 API 계약을 변경하지 않아 VAL-API-001 대상 변경은 없다. apb-playwright-e2e 스킬의 Inspect/MCP Explore/Review 절차를 적용했고 사용자가 요청한 관찰·PNG 보고가 산출물이다. 새 자동화 spec은 작성하지 않았다.

## stock 동기화와 후속

[기술적 분석 시스템 설계](../stock/technical-analysis/system-design.md)의 오래된 포트 설명을 현재 프로필 2982/2983으로 동기화하고, 프록시 연결·본문 Markdown·잘못된 지표 기간 보정 동작을 현재 제한으로 기록했다. 환경파일·동작 코드 수정은 이번 보고 범위에 포함하지 않았다.

## VAL-CLEANUP-001

소유 서버 2982(PID 36255/36266), 2983(PID 36790) 정상 종료. 공식 browser_close 후 작업 Chrome PID 36305 종료. ps 및 lsof로 PID·2982/2983 리스닝 잔존 없음 확인. 기존 SSH proxy 2890과 공유 MCP 서버 유지. 브라우저/서비스 정리 완료.
