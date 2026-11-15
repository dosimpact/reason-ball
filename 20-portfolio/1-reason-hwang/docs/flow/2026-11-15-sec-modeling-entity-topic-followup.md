# SEC 모델링 2 Entity·Topic 범위 후속 실험

- 날짜: 2026-11-15
- 관련: [1차 실험](2026-11-15-sec-modeling-granularity-sample-experiment.md), [현재 stock](../stock/us-corporate-filings/sec-modeling.md), SEC-MODELING-102.
- 사용자 요청: Entity·Topic 증가 원인 확인 및 함께 조정.
- 원인: 1차 프롬프트가 risk exposure, dependencies, markets를 관계 대상으로 허용하여 공급 제약·가격 상승·경쟁업체 집단·고객 등 일반명사/추상 개념도 Entity로 생성. Topic은 자유 분류로 소주제를 세분화. 예: Apple 위험요인 1청크의 Entity 1→26, 쿠팡 사업 소개 1청크의 Topic 4→6.

## 2차 실험

1차와 동일한 6청크 및 추출 진술 50개를 재사용하고 Topic/Fact 추출 단계만 재실행했다. 모델 gpt-5.6-sol, reasoning low. Entity는 이름이 명확한 회사·사업부·제품·서비스·프로그램·기관·지역 중 실제 관계에 필요한 대상만 허용. 일반명사·추상 위험·지표·자산 및 속성 Fact는 제외. Topic은 Item별 Business/Risk Factors/Management Discussion and Analysis 하나로 고정. 진술 텍스트는 그대로 보존.

| 종류 | 기존 저장 결과 | 1차 | 2차 |
| --- | ---: | ---: | ---: |
| Source | 6 | 6 | 6 |
| Chunk | 6 | 6 | 6 |
| Topic | 12 | 20 | 6 |
| Statement | 114 | 50 | 50 |
| Fact | 327 | 97 | 8 |
| Entity | 67 | 86 | 7 |
| 합계 | 532 | 265 | 83 |

기존 대비 84.40% 감소. 그러나 Apple 세 샘플의 Fact/Entity가 모두 0이므로 지나치게 엄격한 정책이다. 진술 50개가 동일하게 보존됨은 정규화된 문자열 집합 비교 assert로 확인했지만, 원문 전체 정보 보존과 검색 품질을 검증한 것은 아니다. 이 후보를 운영 개선안으로 채택하지 않는다.

후속 제안: Item별 한 Topic보다 경쟁·공급망·제품품질·재무성과 등의 승인된 주제 목록 사용. 일반 설명은 Statement로 유지하되, 명명된 실체 외에도 실제 분석에 필요한 핵심 의존 대상은 제한적으로 Entity로 허용. 양 끝 정책 사이에서 관계 탐색 능력을 보존해야 한다. 아직 승인·구현된 변경 없음.

## 증거·자원 정리

- `3-langgraph-fast/.tmp/sec-granularity-experiment-v2/`: `run.py`, `prompt.txt`, 샘플별 원응답/파싱 결과/ID 집합, `summary.json`.
- 실행: 패키지 디렉터리에서 `PYTHONPATH=src .venv/bin/python .tmp/sec-granularity-experiment-v2/run.py`.
- 운영 코드·그래프·임베딩 변경 없음. 1차 보존 결과를 입력으로 읽고 기존 OAuth proxy에 추출만 요청. 신규 서버·브라우저·DB 연결 없음. API/View/운영 비즈니스 동작 변경이 없어 해당 E2E 검증 대상 없음.
- 작업 프로세스 PID 24417 정상 종료 및 ps로 잔존 없음 확인. 실험 파일은 증거로 보존. 공유 서비스는 유지.
- 현재 stock 계약 변경 없음. 본 기록은 실험 결과이며 구현 완료 기록이 아니다.
