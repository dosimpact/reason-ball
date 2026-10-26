# 변경 이력 요약

현재 제품·구현 기준은 [제품 설계](../stock/business.md)와 [시스템 설계](../stock/system.md)다. 아래 검증 수치는 각 작업 당시의 결과이며 현재 버전이나 이후 교체한 합성 데이터의 재검증을 뜻하지 않는다. 검증 산출물은 Git 제외 로컬 파일이다.

## 원본 프로젝트에서 복사된 이력

당시 포트·컴포넌트명·PY/CODE 설계 ID는 이전 Python/문서 비교 프로젝트 기준이다.

| 기록 | 남긴 핵심 |
|---|---|
| [Python 전환](2026-10-18-python-migration.md) | protocol v2/AG-UI, 이벤트 변환, 초기 검증 |
| [프로젝트 분리](2026-10-18-project-split.md) | Python/Next.js 소유권, HTTP 경계, 프롬프트 자산 |
| [이관 재검토](2026-10-18-openui-port-recheck.md) | JS/Python 비교 범위와 차이 |
| [Markdown 설명](2026-10-18-openui-markdown-clarification.md) | UI 문법과 표시 콘텐츠의 구분 |
| [한국어 주석](2026-10-18-korean-code-comments.md) | 주석 변경과 동작 동일성 검증 |

## 이 프로젝트의 이력

| 기록 | 남긴 핵심 |
|---|---|
| [Intelligent UI 이관](2026-10-18-intelligent-ui-python.md) | 원본 카탈로그 보존, 2036/3044, 실제 연동 |
| [캐시 복구](2026-10-20-dev-cache-recovery.md) | 청크 오류·이동된 venv 복구 |
| [벤더 보고서](2026-10-20-interactive-vendor-reports.md) | 원문 데이터 구성과 AI 해설의 역할 분리 |
| [히스토리 전달](2026-10-20-report-chat-history.md) | 실제 사용자 Chrome에 대화 추가·복원 |
| [연속 보고서](2026-10-20-continuous-reports.md) | 탭 제거, 한글 키 평가 문제, PDF |
| [모델 의도 분류](2026-10-20-model-intent-routing.md) | chat/report 분류와 전용 프롬프트 |
| [파일/ID 정리](2026-10-20-test-set-anonymization.md) | Markdown만 유지, 익명 ID·짧은 파일명 |
| [공개용 합성 데이터](2026-10-20-public-sample-data.md) | 가상 데이터·링크, 시크릿 검사 범위 |

| [샘플 의존 검사 제거](2026-10-20-sample-test-removal.md) | docs/vendors 수동 샘플 유지, 파일 기반 테스트/배치 제거 |

## 2026-10-20 이력 압축

사용자가 flow 전체 압축을 명시적으로 요청해 기존 13개 파일을 요약했다. 파일명과 결정·근거·최종 검증·한계를 유지하고 반복 진행 로그, 중간 결과, 문서별 중복 표와 상세 화면 경로를 줄였다. 이 요청에 한해 기존 append-only 기록을 편집했으며, 이후 새 결정은 날짜가 있는 flow에 기록한다. 실행 코드·데이터·서비스는 변경하지 않았다. 상대 링크/앵커 42개와 Git diff 검사를 통과했고 문서 외 파일 불변을 확인했다. 문서 편집이므로 실행 테스트는 반복하지 않았다.

- [2026-10-26 정식 경로 복구](2026-10-26-path-recovery.md) — IUI-PATH-001.
