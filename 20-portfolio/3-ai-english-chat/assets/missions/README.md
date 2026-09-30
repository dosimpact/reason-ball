# 실생활 영어 미션 카탈로그

영어 완전 입문부터 심화 의사소통까지 연습하는 **752개 저작 미션**이다. 일상·여행·관계·업무 4분류, 24개 세부 영역, pre-A1~C2 7수준에 걸쳐 영역·수준별 서로 다른 4개 과업 672개에 직무·비즈니스 문제 해결 80개를 더한다. 저작 검토 상태는 로컬 `draft`로 유지하며 원격 앱 게시 상태와 구분한다. 실제 학습자 효과 검증을 뜻하지 않는다.

## 먼저 볼 파일

- [`catalog.json`](catalog.json): 네 대분류 catalog를 연결하는 시작 목차.
- [`learning-paths.json`](learning-paths.json): 완전 초보용 첫 10개 과업과 관심 영역별 24개 단계 경로.
- [`curriculum.json`](curriculum.json): 난도, 진입 지원, 분기·진급·복습·평가 정책.
- [`research-sources.json`](research-sources.json): 논문·공식 방법론 7건의 출처, 확인 범위, 적용과 한계.
- [`../../docs/research/mission-learning-evidence.md`](../../docs/research/mission-learning-evidence.md): 리서치 결과와 설계 결정.
- [`../../docs/research/mission-curriculum-design.md`](../../docs/research/mission-curriculum-design.md): 교육과정과 기본672개·직무80개 수량의 근거.
- [`categories.json`](categories.json), [`levels.json`](levels.json): 분류와 작성용 CEFR 코드 기준.
- `daily/catalog.json`, `travel/catalog.json`, `social/catalog.json`, `work/catalog.json`: 일상·여행·관계 각 168개, 업무 248개 목록.
- `content/<categoryId>/<subcategoryId>/<key>.json`: 개별 미션 본문.
- [`authoring/README.md`](authoring/README.md)와 `authoring/<categoryId>.json`: 편집할 작가 원본과 작성 계약.
- `catalog.schema.json`, `category-catalog.schema.json`, `mission.schema.json`: 목차·목록·본문의 엄격한 형식 정의.

## 왜 752개인가

24개 생활 영역의 7개 수준에 공백이 없는지 확인하고, 각 셀에 서로 다른 목적·정보 차이·결과를 가진 과업 4개를 배치한 기본 교육과정이다. 사용자의 추가 요구에 따라 개발자·디자이너·IT 운영·비즈니스 미팅 4트랙에 A2~C2 각 4개, 총 80개를 추가했다. 이 수량은 논문이 정한 최적 학습량이 아니다. 같은 문장의 장소·이름만 바꿔 수천 개로 늘리지 않았다. 모든 사용자가 752개를 전부 끝내야 하는 것도 아니다. 실제 필요와 지연 전이 결과에서 발견한 공백을 기준으로 확장한다.

각 미션에는 한국어 상황과 실생활 결과, 상대 역할, 영어 첫 발화, 단계별 목표·예문·3단계 힌트, 관찰할 성공 기준이 있다. 지원된 연습→예문 없이 회상→조건 변경 전이→간격을 둔 재수행을 연결한다. 이 네 활동을 별도 미션 수로 중복 집계하지 않는다.

연구는 과업 중심 학습, 간격 연습, 회상, 교정 피드백을 함께 참고한다. 특정 방법이 모두에게 가장 효과적이라고 단정하지 않는다. 모든 본문에 연결된 연구 ID는 **공통 설계 원칙의 근거**이며 각 미션을 해당 논문이 직접 실험했다는 뜻이 아니다. 1·3·7·21일 간격과 수준별 예상 소요 시간은 조정 가능한 초기 운영값이다.

## 비즈니스·직무 문제 해결

개발자의 리뷰 지연·배포 범위·요구 변경, 디자이너의 전달 자료·접근성·사용성 충돌, IT 담당자의 장애·권한·변경 일정, 부서 간 예산·일정·책임 조율을 다룬다. 추가 80개 본문의 `caseBrief`는 **곤란한 상황을 먼저** 제시한다. 확인된 사실, 제약, 모르는 점, 학습자의 결정 권한, 상대 입장, 결과물, 해결 기준과 에스컬레이션 경로를 함께 담는다.

완료는 정해진 문장을 말하는 것이 아니라 문제를 확인하고 실행 가능한 다음 행동에 합의하는 것이다. 결정·담당자·기한을 남기며, 권한 밖 결정을 혼자 승인하거나 불확실한 기술 원인을 확정하는 것은 목표가 아니다. 합의할 수 없으면 미합의 쟁점과 확인 주체를 분명히 한다. `learning-paths.json`의 `professionalTracks`에서 네 직무 경로를 선택한다.

## 완전 초보부터 사용하는 방법

1. `learning-paths.json`의 진입 안내를 한국어로 읽고 첫 10개 짧은 과업을 시도한다. 영어를 읽지 못하면 단어 뜻과 모델을 보고 선택·복사할 수 있다. 가리키기는 사진 대신 `[가리키기: 물건 또는 번호]` 같은 보조 행동으로 표현할 수 있다.
2. 관심 있는 영역을 고르고 pre-A1부터 시작하되, 이미 할 수 있는 영역은 적합한 단계에서 시작한다. 한 영역의 어려움으로 다른 모든 영역을 잠그지 않는다.
3. 의도→핵심 표현→완성 문장 순서로 필요한 도움을 사용한다. 예문과 표현이 달라도 의미가 전달되면 인정한다.
4. 모델을 가리고 독립 수행한 뒤 바뀐 조건과 지연 복습에서도 수행되는지 확인한다. 다음 수준 제안은 운영 가설이며 공인 CEFR 진급 기준이 아니다.

`prerequisites: []`는 의도적인 선택이다. 경로는 추천이며 자동 서버 시작 잠금이 아니다. 공통 기능을 관심 영역에서 반복하되 다른 분야의 이수를 강제하지 않는다.

C2는 원어민 여부나 모든 상황의 숙달을 뜻하지 않는다. 현재 JSON은 텍스트 역할극 자료이며 문자·소리 기초 교육, 검증된 음성 자료, 실제 듣기·발음 측정을 완전히 대신하지 않는다. 미션 완료 수만으로 원어민 수준 도달을 보증하지 않는다.

## 수정과 검증

프로젝트 루트에서 실행한다.

```bash
pnpm missions:compile
pnpm missions:check
pnpm missions:test
```

- `compile`: 네 작가 원본을 검증한 뒤 본문·하위 catalog·추천 경로를 결정적으로 생성한다. 타임스탬프나 난수를 만들지 않는다. 기존 key가 원본에서 사라지면 삭제하지 않고 오류로 중단한다.
- `check`: 원본에서 동일 산출물이 재현되는지 확인하고 스키마, 분류·수준·출처·선수 참조, 경로, 본문 일치, 고유 key, 미참조 본문, 정확히 동일한 본문 중복, 752개(기본 672개+직무 80개)와 기본 168개 영역·수준 셀·직무별 20개 수준 셀, 추천 경로를 검사한다.
- `test`: 임시 fixture에서 누락·충돌·잘못된 참조·범위 불일치 등 validator 회귀를 검사하는 Node 테스트다. 브라우저 또는 Supabase E2E가 아니다.

검사기는 저장소 스키마에서 사용하는 키워드만 지원하는 제한된 검사기다. 지원하지 않는 스키마 키워드는 무시하지 않고 실패한다. 스키마 검사는 영어의 자연스러움, 실제 CEFR 등급, 의미상 근접 중복이나 학습 효과를 보증하지 않는다. 편집 교차 검토는 `docs/research/mission-*-audit.md`, 검증 기록은 `docs/flow/2026-09-21-research-based-mission-curriculum.md`에 남긴다.

## ID·경로·게시 경계

- key는 전체 목록에서 고유·불변이다. `hotel-check-in-001`은 기존 샘플 ID를 보존한다. 나머지는 대분류·세부 영역·수준·slug로 처음 발급한다. 이후 제목·분류를 변경한다고 ID를 재발급하지 않는다. 현재 generator는 초기 저작용이므로 발급 후 분류 이동·폐기는 별도의 ID 보존 변경을 먼저 설계한다.
- 모든 catalog의 `file`은 `assets/missions/` 기준이다. 본문의 `$schema`는 본문 파일 기준 상대 경로다. 본문에 복제된 제목·분류·난이도는 목록과 반드시 일치해야 한다.
- `planned → draft → review → ready`, `retired`는 로컬 저작 상태다. 이번 산출물은 AI 작성·AI 교차 검토를 거친 `draft`이며 사람 교사 검토·학습자 검증 완료로 승격하지 않는다. 재생성은 현재 초안 상태를 유지한다.
- DB 분류 기반은 `20260920154920_mission_category_catalog.sql`과 28개 분류다. 개인 배정·카탈로그 권한은 `20260921090000_profile_mission_provisioning.sql`을 추가로 사용한다.
- JSON의 `subcategoryId`는 importer가 DB `missions.category_id`로 매핑한다. 현재 앱 생성 API에 원문을 그대로 보내지 않고 전용 importer를 사용한다. 추천/복습 스케줄러는 별도다.
- 상대 역할과 지침은 저작 자료다. 웹 `public/`에 통째로 복사하지 않는다. 의료·금융·법률 상황은 확인·질문·담당자 연결을 위한 언어 연습이며 전문 판단을 제공하는 과업이 아니다.

## 원격 적재와 개인 배정

`pnpm missions:import --help`로 필수 옵션을 확인한다. `--apply`가 없으면 네트워크 없는 dry-run이고 `--keys hotel-check-in-001`로 일부를 검증할 수 있다. owner/character/reward-file/reward-prefix/reward-xp/visibility는 명시한다. 서버 자격 증명은 환경 파일에서만 읽고 명령 인자나 결과에 넣지 않는다.

```sh
pnpm missions:import --owner <작성자-UUID> --character <캐릭터-UUID> \
  --reward-file assets/missions/rewards/mission-complete.png \
  --reward-prefix <작성자-UUID>/mission-catalog --reward-xp 120 --visibility public
```

실행 시 이미 같은 원문·매핑으로 게시한 미션은 변경하지 않는다. 응답 유실은 같은 옵션으로 재실행하여 저장된 상태를 확인한다. 원문이나 게시 설정이 바뀌면 자동 덮어쓰기를 거절하며 새 버전 변경 절차가 필요하다. `catalogImport` 원문과 판정 지침은 서버 전용이며 공개 응답은 허용한 표시 정보만 사용한다. 보상은 `rewards/mission-complete.svg`에서 렌더링한 공통 PNG 배지다. 개별 AI 그림을 생성한 것으로 표시하지 않는다.

일반 학습자는 학습 프로필 저장 후 CEFR·관심 상황에 맞는 초기 5개만 배정받는다. 전체 적재 검증 후 `mission_catalog_state.is_ready`를 서비스 권한으로 활성화하며, 미완료 적재 중에는 배정하지 않는다. 재접속·재시도로 배정이 누적되지 않고 프로필을 바꿔도 기존 학습 기록은 유지한다. 카탈로그 관리 계정은 전체를 조회한다. DB의 `public` 게시 메타데이터만으로 미배정 사용자에게 공개되는 것은 아니며 RLS의 배정/관리 권한이 최종 기준이다.

실제 적용·검증 상태는 [원격 적재 유량](../../docs/flow/2026-09-21-mission-catalog-remote-upload.md)을 참조한다.
