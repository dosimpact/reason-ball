# 입력·출력·API 계약 v1

> 모두 신규 제안 API다. 원 서비스 API나 현재 저장소의 구현 사실이 아니다. camelCase JSON, UTF-8, 시간은 UTC RFC3339, 날짜는 YYYY-MM-DD, UUID 식별자. 문자열 길이는 NFC 정규화·양끝 공백 제거 후 Unicode code point 기준이다.

## 1. 입력 계약

모든 입력 객체는 알 수 없는 필드를 거절한다. 사용자 원문은 텍스트이며 HTML/명령으로 실행하지 않는다.

| 필드 | 타입 / 조건 | 기본값·규칙 |
| --- | --- | --- |
| domain | saju 또는 tarot | 생성 후 불변 |
| nickname | string 또는 null, 1–20자 | null이면 “당신”; 로그/모델에 전달하지 않음 |
| topic | general, relationship, work, self | 명시 선택 |
| question | string, 10–500자 | 필수; 기본 질문 버튼도 수정 가능 |
| context | string 또는 null, 최대 1000자 | 이름·연락처 입력하지 않도록 안내 |
| relationship | single, crush, dating, separated, other 또는 null | topic=relationship이면 필수, 그 외 null |
| consent | 객체 | adultSelf=true, interpretationNotice=true, temporaryStorage=true 필수; 기본 체크 없음 |
| birth | 사주만 객체 | 아래 정의; 타로에는 필드 자체 없음 |

사주의 `birth`: `{calendar:"solar"|"lunar", date:string, leapMonth:boolean|null, time:"HH:mm"|null, timeUnknown:boolean, timezone:"Asia/Seoul", country:"KR"}`. solar면 leapMonth=null, lunar면 true/false 명시. timeUnknown=true iff time=null. 날짜 범위/성인/시간대 예외는 [BR-S 정책](business-design.md)으로 서버 판정한다. UI의 1차 검사로 서버 검사를 대체하지 않는다.

`consent`는 v1 제품 확인 절차다. 실제 배포 개인정보 고지/처리 약관의 법률 검토를 대신하지 않으며 고지 버전은 서버가 `consentVersion`으로 기록한다.

## 2. 계산·해석 근거 계약

### SajuFacts

`{engineVersion, ruleVersion, calendarVersion, timezoneVersion, normalizedSolarDate, timeKnown, pillars, dayMaster, elementCounts, evidence, limitations}`.

- pillars: year/month/day와 hour(객체 또는 null). 각 객체 `{stem, branch}`; stem은 갑·을·병·정·무·기·경·신·임·계, branch는 자·축·인·묘·진·사·오·미·신·유·술·해.
- dayMaster: day.stem과 동일.
- elementCounts: `{wood,fire,earth,metal,water,total}`, 모두 0 이상 정수. 합계=total=6 또는 8.
- 천간 매핑: 갑을=wood, 병정=fire, 무기=earth, 경신=metal, 임계=water.
- 지지 대표 매핑: 인묘=wood, 사오=fire, 진술축미=earth, 신유=metal, 해자=water. 다른 가중치를 숨겨 적용하지 않는다.
- evidence: `{id, kind, label, value, interpretationRuleIds:string[]}` 배열. id는 `saju.day_master`, `saju.element.wood`처럼 서버 발급; kind는 pillar/day_master/element_count. 존재하지 않는 hour 근거는 발급하지 않는다.
- 계산 근거와 전통적 의미는 별개. `interpretationRuleIds`는 검수한 사주 해석 카탈로그를 가리킨다. 규칙은 `{id,version,appliesWhen,traditionalMeaning,caveat,forbiddenClaims,reviewStatus}`. reviewStatus=approved만 사용하며 단순 최다 오행을 신강으로 해석하지 않는다.
- limitations: 서버 발급 코드 배열 `TIME_UNKNOWN / SIMPLE_ELEMENT_COUNT / NO_FUTURE_PREDICTION` 중 해당 값. 시간 모름 경계일은 억지 facts 대신 입력 오류다.
- 필수 계산 기능을 제공하지 못하는 엔진은 `ENGINE_UNAVAILABLE`; 모델 대체 계산 금지.

### TarotDeck / TarotDraw

덱 카탈로그: `{deckVersion,meaningVersion,cards:[{cardId,nameKo,keywords,coreMeaning,caution,byPosition:{situation,caution,action},allowedTensions,assetId,reviewStatus}]}`.

- 총 78개 고유 ID: major_00..major_21, 각 suit `wands/cups/swords/pentacles`의 `ace/02/03/04/05/06/07/08/09/10/page/knight/queen/king`.
- major 순서: 바보, 마법사, 여사제, 여황제, 황제, 교황, 연인, 전차, 힘, 은둔자, 운명의 수레바퀴, 정의, 매달린 사람, 죽음, 절제, 악마, 탑, 별, 달, 태양, 심판, 세계. 번역명은 nameKo가 단일 원본.
- 정방향 의미만. 카드 이름에 부정적 단어가 있어도 질병·죽음·재난의 실제 예언으로 치환하지 않는다.
- meanings는 생성 때 인터넷에서 가져오지 않고 검수·버전 고정한 로컬 콘텐츠를 조회한다. 카드/규칙 원문 제작과 이용권 확인은 출시 게이트다.

브라우저에 전달하는 draw 초안: `{revision,backs:[{token,ordinal}],selectedTokens:string[],locked:boolean}`. 78개의 token은 카드ID와 무관한 불투명 난수. ordinal은 표시 순서 1..78. 선택 중에는 앞면/의미/셔플 seed를 전송하지 않는다.

확정 후 서버 소유 `TarotDraw`: `{deckVersion,meaningVersion,revision,cards:[{position,cardId,orientation:"upright",evidenceId}]}`. position은 situation/caution/action 순서. 3장 고유, evidenceId는 `tarot.position.situation` 등이며 카탈로그 스냅샷과 연결된다. 생성 요청 수락 후 앞면 공개 가능하나, 검수 전 해석 텍스트는 공개하지 않는다.

## 3. 모델 출력과 최종 결과

모델은 **InterpretationBody만** 작성한다. readingId·카드·원국·시간·버전·고정 안내는 서버가 결합한다. 모델에 전체 API 결과 객체를 자유 생성시키지 않는다.

InterpretationBody의 모든 필드는 필수, extra 금지:

| 필드 | 타입 / 길이 | 의미 |
| --- | --- | --- |
| headline | string 10–60자 | 질문에 대한 절제된 한 줄 요약 |
| summary | string 80–240자 | 사용자 상황 + 핵심 관점 |
| sections | Section 정확히 3개 | 사주와 타로의 순서 규칙은 아래 |
| synthesis | 객체 | text 120–350자, evidenceRefs 최소 2개 |
| actions | Action 정확히 2개 | 서로 다른, 관찰 가능한 작은 행동 |
| limits | string 배열 1–3개, 각각 20–150자 | 입력 부족/해석의 불확실성; 서버 고정 안내와 별개 |

Section: `{key,title,body,evidenceRefs}`. title 2–30자, body 100–300자, evidenceRefs 1개 이상 중복 없는 유효 ID.
사주 key 순서는 `tendency / question / caution`, 타로는 `situation / caution / action`. 타로 각 section은 해당 위치 evidenceId를 반드시 포함, synthesis는 3장 ID 모두 포함. 사주 synthesis는 최소 2개 상이한 근거를 연결한다.

Action: `{title,detail,evidenceRefs}`. title 5–40자, detail 40–160자, evidenceRefs 1개 이상. “좋은 기운을 기다리세요”만 쓰면 품질 실패.

최종 `ReadingResult`:
`{schemaVersion:"1.0",readingId,domain,inputSummary,facts,interpretation,notice,versions,createdAt,expiresAt}`.
inputSummary는 닉네임·주제·질문·정규화된 생일/시간 유무(사주)를 사용자 본인에게만 반환한다. facts는 SajuFacts 또는 TarotDraw와 공개 카드 이름/에셋/의미 요약. interpretation은 검수된 InterpretationBody. notice는 고정 안내. versions는 graph/prompt/model/schema/engine 또는 deck/meaning을 저장한다. model은 실제 실행 모델 식별자이지 별칭만이 아니다.

## 4. 엔드포인트

베이스 `/api/fortune/v1`. 모두 익명 세션 소유권 확인. API 담당은 FastAPI; 새 Nest 비즈니스 모듈은 만들지 않는다.

| 메서드·경로 | 요청 | 응답 / 전이 |
| --- | --- | --- |
| POST /session | 빈 객체, Origin 검사 | 204 + HttpOnly 익명 세션 쿠키 |
| GET /capabilities | 없음 | 200: schemaVersion, 지원 범위/주제/덱, 각 도메인 available와 reason |
| POST /readings | 위 입력 | 201 ReadingSnapshot; 사주 ready, 타로 draft |
| PATCH /readings/:id | {revision,input:전체 입력} | 200 새 revision; draft/ready에서만. 타로 입력 수정은 덱·선택 초기화 |
| PUT /readings/:id/selection | {revision,selectedTokens:[순서]} | 200; 타로 0–3개, 3개면 ready, 나머지 draft |
| POST /readings/:id/reset | {revision} | 200; 새 셔플·토큰, 빈 선택, revision 증가; 생성 전만 |
| POST /readings/:id/generate | {revision}, Idempotency-Key 헤더 | 202 Snapshot + Location; ready → generating |
| GET /readings/:id | 없음 | 200 ReadingSnapshot; 완료 시 result 포함 |
| POST /readings/:id/retry | {revision}, Idempotency-Key | 202; 재시도 가능한 failed만. 입력·facts·cards 유지 |
| DELETE /readings/:id | 없음 | 204; 즉시 접근 차단, 실행 취소 표시 |
| PUT /readings/:id/feedback | {value: helpful 또는 neutral 또는 unhelpful} | 204; 완료·소유자만, 값 덮어쓰기 |

ReadingSnapshot: `{readingId,domain,status,stage,revision,input,facts,draw,result,error,createdAt,expiresAt}`. nullable 필드는 null. saju에서는 facts=SajuFacts, draw=null이다. tarot에서는 facts=null로 유지하고 draw가 카드 상태를 소유한다. result는 completed만 존재. generating/validating 타로 draw는 확정 카드도 포함할 수 있으나 숨겨진 나머지 75장은 공개하지 않는다. stage는 null/prepare/compose/check/persist. status는 draft/ready/generating/validating/completed/failed/expired. expired는 UI 로컬 상태로도 사용하며 서버 접근 시에는 아래 410 오류를 반환한다.

사주 facts 계산/검증은 POST/PATCH에서 결정적으로 실행하고 ready 응답의 facts.normalizedSolarDate와 timeKnown으로 입력 확인 화면을 구성한다. 그래프는 생성 때 동결된 facts의 해시·버전을 확인하고 그대로 사용한다. 준비 실패를 읽을 수 없는 반쪽 초안으로 저장하지 않는다.

## 5. 오류·동시성·전송

오류 형식: `{error:{code,message,fieldErrors:[{path,code,message}],retryable},requestId}`. 내부 프롬프트·스택·원문 로그는 응답에 넣지 않는다.

| HTTP | 코드 예 | UI 처리 |
| --- | --- | --- |
| 422 | INVALID_DATE, INVALID_LUNAR_DATE, INVALID_TIME, BIRTH_TIME_REQUIRED, UNSUPPORTED_BIRTH, ADULT_REQUIRED, INVALID_QUESTION | 해당 필드에 오류·초점, 입력 보존 |
| 409 | REVISION_CONFLICT, DRAW_LOCKED, IDEMPOTENCY_CONFLICT, INVALID_STATE | 최신 Snapshot 조회; 자동 재추첨/수정 금지 |
| 401 | SESSION_REQUIRED | 새 세션 안내; 기존 ID를 새 세션에 양도하지 않음 |
| 404 | READING_NOT_FOUND | 타인의 ID/삭제한 ID/없는 ID 구분하지 않음 |
| 410 | READING_EXPIRED | 현재 소유자에게 만료; 새 풀이 CTA |
| 429 | RATE_LIMITED | Retry-After; 자동 반복 생성하지 않음 |
| 503 | ENGINE_UNAVAILABLE, CONTENT_UNAVAILABLE, MODEL_UNAVAILABLE | 입력 유지·재시도 또는 이용 불가 |
| 작업 실패 | MODEL_TIMEOUT, CONTENT_INVALID, SAFETY_REFUSAL, GENERATION_INTERRUPTED | GET은 200 failed + error; retryable만 재시도 |

만료 후 purge까지는 소유자에게 410, purge 후에는 행이 없어 404다. UI는 로컬 expiresAt으로 만료 안내를 유지할 수 있지만 서버에 삭제된 개인정보를 만료 화면용으로 남기지 않는다.

모든 생성/초안/선택 변경 POST·PUT·PATCH에 UUID `Idempotency-Key`를 적용한다(session·feedback 제외). 범위는 owner+메서드+경로+키. 같은 키·정규화 요청 hash는 기존 응답/작업을 반환하며, 다른 요청은 409. 중복 조회를 revision 검사보다 먼저 수행한다. 동시 요청은 DB의 unique 제약과 비교-교환으로 하나만 수락한다. 키 보존은 reading 만료/삭제 시까지. DELETE는 반복 204이며 소유 여부를 추가 노출하지 않는다.

revision은 입력·선택·초기화·생성 수락·명시적 재시도 수락 때만 증가, 상태 polling은 증가시키지 않는다. 생성 중에는 PATCH/selection/reset 불가. 같은 키로 통신 재전송은 같은 reading/작업, 새로운 키의 completed generate도 기존 결과 Snapshot 200을 반환하며 재생성하지 않는다.

UI는 생성 수락 후 GET을 1초 간격, 10초 이후 3초 간격으로 polling한다. 탭 숨김 시 중단, 돌아오면 즉시 조회. 60초 뒤에는 “진행 상태 다시 확인”을 제공하되 새 작업을 만들지 않는다. v1은 토큰 스트리밍/SSE를 도입하지 않는다. 미검수 문장의 잠깐 노출도 금지한다.
