# SEC 모델링 2 추출 단위 샘플 실험

- 날짜: 2026-11-15
- 요구: SEC-MODELING-102. 사용자가 즉석 스크립트로 기존 대비 노드 감소율 측정을 요청.
- 관련 stock: [SEC 모델링](../stock/us-corporate-filings/sec-modeling.md). 운영 구현·승인 계약은 변경하지 않았으며 stock 변경 대상 없음.
- 목적: Statement의 원인·결과·조건을 묶고, 분류성 Fact 및 열거 항목의 기계적 분해를 줄이는 후보 프롬프트 측정.

## 방법

활성 Apple·쿠팡 모델링 2에서 각각 Item 1, 1A, 7의 청크 하나씩, 총 6개를 사용했다. 각 Item에서 1,800자 이상 청크를 ID 순으로 정렬한 뒤 중간 청크를 선택했다. 무작위·대표성 보장 표본은 아니다.

기준값은 해당 청크와 연결된 기존 활성 그래프의 노드 ID 집합이다. 후보는 기존 청크 원문을 유지하고, OAuth proxy의 gpt-5.6-sol(reasoning low)로 두 단계 추출을 수행했다. 기존 결과의 실행 모델·시점·선호 topic/entity 문맥까지 동일하게 재현한 통제 A/B 실험은 아니다. 샘플별 원문과 기존 ID 목록을 보존했다.

후보 출력은 설치된 Toolkit 3.21.0의 parser와 NodeBuilders로 처리했다. Source/Chunk는 유지하며 Topic/Statement/Fact/Entity는 Toolkit ID 기준으로 중복 제거했다. Entity는 실제 그래프 생성 대상인 Fact의 subject/object만 집계하고 local complement는 제외했다. 회사별 집합을 합쳐 합계를 계산했다. 관계, SecRecord, SecVector, 임베딩 용량은 집계 대상이 아니다.

후보 응답에서 `proposition:` 뒤 본문이 다음 줄에 나온 9개 진술을 parser가 빈 value + details로 읽었다. 정확히 원래 추출문과 일치하는 details를 value로 복원한 후 집계했다. 따라서 아래 수치는 프롬프트 변경과 이 출력 형식 보정을 포함한다. 보정 후 추출된 진술 50개가 모두 Statement로 유지됨을 assert로 확인했다. 원문 전체에 대한 의미·수치 보존 및 검색 품질은 미검증이다.

## 결과

| 범위 | 기존 | 후보 | 감소율 |
| --- | ---: | ---: | ---: |
| Apple 3청크 | 288 | 150 | 47.92% |
| 쿠팡 3청크 | 244 | 115 | 52.87% |
| 전체 6청크 | 532 | 265 | 50.19% |

| 종류 | 기존 | 후보 | 변화 |
| --- | ---: | ---: | --- |
| Source | 6 | 6 | 유지 |
| Chunk | 6 | 6 | 유지 |
| Topic | 12 | 20 | 66.67% 증가 |
| Statement | 114 | 50 | 56.14% 감소 |
| Fact | 327 | 97 | 70.34% 감소 |
| Entity | 67 | 86 | 28.36% 증가 |

개별 청크: Apple Item 1은 58→62, Item 1A는 64→67로 증가했고 Item 7은 169→24로 감소했다. 쿠팡은 Item 1이 95→69, Item 1A가 79→27, Item 7이 71→21이다. 개별 청크 합계에는 공유 노드가 반복되므로 회사별 합계와 다르다.

전체 공시의 9,684/19,348개에 50.19%를 그대로 적용할 수 없다. 후보가 위험요인 등을 Entity로 승격하여 일부 청크는 증가했다. 숫자 감축의 가능성은 확인했지만 운영 적용·품질 검증 완료를 의미하지 않는다.

## 실행 증거 및 정리

- 스크립트: `3-langgraph-fast/.tmp/sec-granularity-experiment/run.py`
- 출력 형식 보정·재집계: 같은 디렉터리 `recount.py`
- 입력/프롬프트: `inputs.json`, `prompts.json`
- 원응답·파싱·ID 집합: `Apple-{1,1A,7}.json`, `Coupang-{1,1A,7}.json`
- 최종 집계: `summary.json` (recount.py 실행 후 결과가 최종)
- 실행: 패키지 디렉터리에서 `PYTHONPATH=src .venv/bin/python .tmp/sec-granularity-experiment/run.py`, 이어서 동일 방식으로 `recount.py` 실행.
- API/View/운영 비즈니스 코드 변경 없음. 사용자 요청 범위의 오프라인 추출 실험이며 브라우저·API E2E 대상 변경 없음.
- 신규 서버·브라우저 없음. 기존 Neo4j는 읽기만 수행하고 driver를 finally에서 닫음. 기존 OAuth proxy는 추출 호출에 사용하고 종료하지 않음. 그래프 쓰기·임베딩 호출 없음.
- 작업 프로세스 PID 19266 정상 종료, `ps -p 19266 -o pid,ppid,command`에서 잔존 없음 확인. 전용 작업 파일은 재현 증거로 보존하며 자격 증명은 저장하지 않음.

## 후속

프롬프트의 Entity/Topic 생성 범위를 더 제한하고, 파싱 형식을 명확히 해야 한다. 더 넓은 표본에서 의미·수치·조건 보존과 검색 품질을 확인한 뒤 운영 적용 여부를 결정한다.
