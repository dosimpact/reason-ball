# 실생활 미션 저작 원본

각 `<categoryId>.json`은 `{ "schemaVersion": 1, "categoryId": "daily", "missions": [...] }`다. 이 원본에서 `pnpm missions:compile`로 본문과 하위 catalog를 재현한다. 문장 내용은 원본에서 수정하고 재생성한다. 생성기는 교육 내용을 대신 기획하거나 장소명만 바꿔 미션을 증식하지 않는다.

각 미션은 다음 필드를 모두 작성한다.

```json
{
  "subcategoryId": "food-drink",
  "difficulty": "pre-A1",
  "slug": "ask-for-water",
  "title": "물 한 잔 부탁하기",
  "scenario": "카페에서 목이 마릅니다. 계산대 직원에게 물을 부탁하고 받은 뒤 감사 인사를 합니다.",
  "learnerRole": "카페 손님",
  "interlocutorRole": "주문을 기다리는 직원. 처음에는 한 번에 한 질문만 하고 물을 주기 전에 수량을 확인한다.",
  "opening": "Hello!",
  "steps": [
    { "goal": "물을 달라고 요청하기", "example": "Water, please.", "cue": "water = 물; please = 부탁해요" },
    { "goal": "한 잔이라고 답하기", "example": "One, please.", "cue": "one = 하나" },
    { "goal": "받은 뒤 감사하기", "example": "Thank you.", "cue": "thank you = 고마워요" }
  ],
  "outcome": "원하는 물 한 잔을 요청하고 수량을 전달한다.",
  "transfer": "다음에는 물 대신 차를, 한 잔 대신 두 잔을 주문한다. tea와 two만 새 낱말로 제공하고 완성 문장은 가린다."
}
```

## 품질 기준

- 24개 세부 영역에서 pre-A1/A1/A2/B1/B2/C1/C2마다 서로 다른 실제 과업 4개를 작성한다. 제목·장소·이름만 바뀐 문장은 별도 과업으로 세지 않는다.
- `slug`는 같은 영역·수준 안에서 고유한 영어 kebab-case다. 기존 `hotel-check-in-001`은 여행 호텔 A2 `check-in`에 보존한다.
- 한국어 상황에 목표, 실제 제약과 의사결정할 정보를 명시한다. 상대 역할에 응답할 사실이나 진행 규칙을 제공한다. 개인정보는 모두 가상이다.
- `opening`은 상대방의 영어 첫 발화다. 입문은 인사/한 질문, 고급은 상충하는 정보·이해관계·불확실성이 있는 발화로 시작한다.
- 단계 3개 이상을 구체적으로 쓴다. `goal`은 한국어 관찰 가능한 의사소통 행동, `example`은 학습자 영어 발화, `cue`는 한국어 설명을 포함한 핵심 표현이다. 정답 문자열 외의 적절한 표현도 인정한다.
- pre-A1은 한 단어·2~4단어 청크를 허용하고 한국어 뜻을 제공한다. A1은 단순 문장, A2는 연결된 일상 거래, B1은 경험/이유/문제 해결, B2는 비교·근거·조율, C1은 복합 목적/어조 조정, C2는 모호함 해소·관점 재구성·미묘한 함의의 조율을 요구한다.
- C1/C2에는 실제 입력과 의견 차이가 있어야 한다. 단지 긴 단어, 관용구 암기, 정중한 표현을 사용했다고 고급으로 분류하지 않는다. 고급 예시도 현실적으로 말할 수 있는 영어를 쓴다.
- `transfer`는 이 과업의 바뀐 조건과 새 의사소통 행동을 구체적으로 제시한다. 모든 미션에 같은 '다른 상황에서 연습하세요' 문구를 붙이지 않는다.
- 건강·은행·계약 관련 과업은 전문가에게 정보를 확인하고 질문하는 언어 연습이다. 진단, 투자 조언, 법률 결론을 만들지 않는다.
- 문화·장애·소득·성별을 고정관념으로 설정하지 않는다. 선택적 가상 역할을 사용한다.

연구 근거: `../research-sources.json`, 교육과정: `../curriculum.json`. 작성된 JSON은 로컬 교육 콘텐츠이며 원격 게시 또는 학습 효과 실증을 뜻하지 않는다.

## 직무·비즈니스 문제 해결 확장

`work-developer.json`, `work-designer.json`, `work-it-operations.json`, `work-business-meetings.json`은 `categoryId: work`인 추가 원본이다. 각 파일은 A2/B1/B2/C1/C2마다 4개, 총 20개씩 작성한다. 기존 672개와 별개의 구체적인 사례 80개를 추가하며 기존 세부 분류에 배치한다. root catalog를 늘리거나 직업을 DB 카테고리로 추가하지 않는다.

추가 미션은 다음 `caseBrief`를 필수로 작성한다.

- `professionalRole`: `developer`, `designer`, `it-operations`, `cross-functional`
- `situation`: 먼저 제시할 곤란한 문제
- `facts`: 대화 시작 시 확인된 구체적 정보
- `constraints`: 시간·자원·품질·업무상 제한
- `learnerAuthority`: 학습자 역할이 결정할 수 있는 범위
- `counterpartPosition`: 상대의 이해관계와 현재 입장
- `unresolvedQuestions`: 질문으로 해소할 정보 공백
- `deliverable`: 합의문·행동 계획·현황 공유 등 대화 결과물
- `resolutionCriteria`: 관찰할 해결 기준 2개 이상
- `escalationPath`: 합의 불가 또는 권한 밖 사항의 확인·승인 경로

이 미션은 인사 후 대화를 길게 이어가는 것이 목적이 아니다. 곤란한 문제를 받고, 사실과 가정을 나누고, 대안을 비교·협의한 뒤 결정·담당자·기한을 정한다. 즉시 합의할 수 없다면 미합의 쟁점과 다음 확인 주체·시점을 남기는 것도 타당한 결과다. 영어 능력과 특정 기술 해결안의 일치를 혼동하지 않는다. 실제 시스템 명령, 자격 증명, 사용자 소유 기술 환경을 요구하지 않는 가상 역할극으로 작성한다.
