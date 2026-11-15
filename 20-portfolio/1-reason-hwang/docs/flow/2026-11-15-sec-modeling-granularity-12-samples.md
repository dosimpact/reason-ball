# SEC 모델링 2 공통 Topic·제한적 Entity: 12개 샘플 실험

- 날짜: 2026-11-15
- 요구: SEC-MODELING-102. 사용자가 재조정 및 human-docs/1-sec-분석에 최소 10개 샘플 테스트를 명시적으로 요청했다. 이 요청 범위에서 신규 샘플 문서만 생성했다.
- 관련 stock: [SEC 모델링](../stock/us-corporate-filings/sec-modeling.md). 운영 코드·계약 변경이 없으므로 stock은 유지한다.
- 이전 기록: [1차](2026-11-15-sec-modeling-granularity-sample-experiment.md), [2차](2026-11-15-sec-modeling-entity-topic-followup.md).
- 결과 문서: [12개 샘플 상세](../human-docs/1-sec-분석/2.모델링2-개선-12개샘플-실험.md). 각 샘플의 원문 전체, 기존 Statement/Fact, 후보 Statement/Fact, 노드 수를 수록했다.

## 방법

기존 Apple·쿠팡 Item 1/1A/7의 6개 청크(A)에 각 Item의 다른 청크 6개(B)를 추가했다. 1,800자 이상 청크의 ID 정렬 중간 위치를 사용한 결정적 선택이며 대표성을 보장하지 않는다. 12개 고유 chunk ID 확인.

A는 기존 실험의 추출 진술을 재사용, B는 동일한 의미 단위 추출 프롬프트로 새로 추출했다. 두 번째 단계에서는 8개 공통 Topic 중 청크당 주요 1~2개를 선택하고, 이름 있는 실체 외에 중요한 자원·의존 대상·위험 메커니즘만 제한적으로 허용했다. 중요한 지표·운영 특성은 새 Entity 대신 간결한 attribute Fact로 표현할 수 있게 했다.

모델 gpt-5.6-sol, reasoning low, 동시 작업 3개. 설치 Toolkit 3.21.0 parser/NodeBuilders의 고유 ID로 집계하며 DB 쓰기와 임베딩 호출은 하지 않았다. 기준값은 기존 활성 그래프의 연결 노드로, 기존 모델·실행 시점·선호 문맥까지 통제한 실험은 아니다.

## 결과

| 범위 | 기존 | 후보 | 감소율 |
| --- | ---: | ---: | ---: |
| Apple 6청크 | 647 | 208 | 67.85% |
| 쿠팡 6청크 | 566 | 157 | 72.26% |
| 전체 12청크 | 1,213 | 365 | 69.91% |
| 이전 동일 6청크 | 532 | 168 | 68.42% |

| 종류 | 기존 | 후보 | 감소율 |
| --- | ---: | ---: | ---: |
| Source | 6 | 6 | 0% |
| Chunk | 12 | 12 | 0% |
| Topic | 24 | 16 | 33.33% |
| Statement | 236 | 119 | 49.58% |
| Fact | 771 | 139 | 81.97% |
| Entity | 164 | 73 | 55.49% |

- 12/12 샘플 성공. 모두 기존 대비 노드 감소, 모두 Fact가 1개 이상 남음.
- 두 번째 추출 단계에서 입력 진술 119개와 파싱 결과의 정규화 텍스트 집합 동일성 확인. parser garbage와 빈 진술 보정 각각 0.
- 샘플별 노드 감소율 43.10~83.43%. 공유 노드 때문에 샘플별 합계와 전체 고유 집계는 다름.
- 수동 확인에서 공급 의존성·품질 위험·규제 관계와 일부 MAY/EXPECTS 조건 표현이 남는 것을 확인. 원문 전체 정보·수치 보존이나 검색 품질에 대한 완전한 검증은 수행하지 않음.
- Components 등 넓은 Entity와 간략한 관계 표현은 후속 검토 대상. 전체 공시 감소율로 일반화하거나 자동 운영 적용하지 않음.

## 실행·정리

- `3-langgraph-fast/.tmp/sec-granularity-experiment-v3/`: `run.py`, `prompt.txt`, `inputs.json`, 샘플 원응답/파싱/ID JSON, `summary.json`, `report.py` 보존.
- 실행: 패키지 디렉터리에서 `PYTHONPATH=src .venv/bin/python .tmp/sec-granularity-experiment-v3/run.py`; `report.py`로 상세 문서 생성.
- 추가 확인: 12개 고유 ID, 진술 보존, 모든 샘플 Fact 존재, parser garbage 없음 assert 통과. 문서 샘플 섹션 12개와 링크·형식 확인.
- 새 서버·브라우저 없음. 기존 Neo4j는 읽기만 수행하고 finally에서 연결 종료. 기존 OAuth proxy는 유지. 작업 프로세스 PID 27317 정상 종료 후 ps에 잔존 없음 확인.
- 실험 파일은 재현 증거로 보존. 운영 API/View/비즈니스 코드 변경이 없으므로 해당 E2E 실행 대상 변경 없음.
