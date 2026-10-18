# 2026-10-18 Intelligent UI Python 확장

## 배경 및 변경
사용자 요청에 따라 6을 6-3으로 복사하고 B의 UI를 가져왔다. 설치 산출물(node_modules/.venv/.next), 실행 캐시 및 기존 검증 산출물은 복사하지 않고 새로 만들었다. 로컬 환경은 소유 프로젝트 내에서 복사하고 포트를 2036/3044로 분리했다. 키 값은 출력하지 않았다.

## 결정
- IUI-101: Python protocol v2/AG-UI 프록시 유지. B의 모델 route 대신 기존 Python 그래프 사용.
- IUI-102: B src/lib를 그대로 복사하고 카탈로그 교체. 프롬프트를 생성 후 Python 자산에 복사.
- IUI-103: B 채팅/테마/localStorage, gallery/preview, 미디어 API/public 복사. analytics는 제외.
- IUI-104: B의 vitest alias/UTC 설정도 이관. 원본 보존을 위한 파일별 lint 예외는 system stock에 기록.

## 중간 검증
Python 13 tests/Ruff PASS. Frontend 318 tests/typecheck/build PASS. Lint 0 errors/5 inherited warnings.
첫 provider smoke는 Python 서버가 프롬프트 복사 전의 Stack 자산을 메모리에 로드한 상태여서 새 카탈로그 파싱에 실패했다. 소유 Python 서버를 재시작하고 재검증 중이다. txt 변경만으로 그래프 재로드를 가정하지 않는다.

## 영향 stock
business IUI-001~004, system IUI-101~104. 최종 실행 증거는 아래에 추가한다.

## Provider 및 브라우저 검증
- 첫 재실행에서 모델이 $stockData 선언을 stockData로 참조했다. Python 보완 지침에 tool 결과는 일반 literal 데이터로 선언, $state 참조는 접두사 유지, tool 호출 전후 중간 텍스트 금지 및 정확한 Text size 규칙을 추가했다. 카탈로그 자체는 변경하지 않았다.
- 최종 smoke PASS: get_stock_price + search_web 호출, 후속 대화, interactive-counter, 잘못된 요청 400. 각 응답을 새 카탈로그로 파싱하고 unresolved/errors가 없음을 검사했다. frontend/output/validation/smoke-result.json 및 *.sse.
- 실제 브라우저에서 모델이 만든 Increment 클릭으로 0→1 확인. 새로고침 후 History에서 대화를 다시 열었을 때 값 1 복원 확인. frontend/output/playwright/counter-restored.png.
- 첫 브라우저 모델 출력은 Text에 3xl을 사용한 경고가 있었지만 카운터 동작/복원은 정상. 이 실패도 위 지침 보강 근거다. 프롬프트 보강은 모든 향후 모델 출력을 보장하지 않는다.
- B src/lib 43개 파일 byte 비교: 차이 0개. Python 프롬프트와 프런트엔드 생성 프롬프트 byte 일치.

## 지정 키로 최종 재검증
사용자 추가 지시에 따라 open-intelligent-ui/.env의 OPENAI_API_KEY를 새 backend/.env에 값 출력 없이 반영하고 Python 서버를 재시작했다. 소스 파일에는 모델/endpoint override가 없었다. 이 키로 도구 호출과 후속 대화는 통과했으나 첫 counter 생성은 Text size xl 때문에 계약 검사 실패. 해당 응답은 output/validation/interactive-counter-source-key-failed.sse로 보존했다. smoke 카운터 요청에 지원되는 lg 크기를 명시한 제어된 검증은 전체 PASS. 이는 자연어 요청의 모든 생성 결과가 오류 없다는 의미가 아니다.

최종 frontend/output/validation/smoke-result.json: stock-research, follow-up, interactive-counter, invalid requests PASS. 소스 키 값은 문서/로그에 기록하지 않았다.

## 갤러리 및 외부 API
/gallery에서 45개 예제, .gallery-errors 0개 확인. 자전거 예제의 inseam 입력을 56→65로 변경했다. wiki(Lisbon), image-search(Lisbon), street-route(Lisbon 좌표)는 HTTP 200과 실제 사진/위치/경로 데이터를 반환했다. 외부 이미지/타일 등 모든 공급자 리소스의 지속적 가용성을 보장하는 검증은 아니다.

## 최종 상태
소유 dev 서버 frontend 3044/Python 2036을 실행해 둔다. 원본 프로젝트 및 기존 다른 서버는 변경/종료하지 않았다. node_modules/venv/cache는 새 프로젝트에서 재설치했다. src/lib 43개 파일은 B와 바이트 동일하고 MIT 라이선스는 frontend/INTELLIGENT-UI-LICENSE에 보존했다. 타입 검사·프로덕션 빌드는 최종 레이아웃 변경 후 재통과했다. CLI 생성은 map worker import.meta에 CJS 정적 분석 경고를 내지만 생성/Next 빌드는 성공한다.
