# 관계 미션 교차 편집 검토

검토일: 2026-09-21. 검토 원본: `assets/missions/authoring/social.json`. 연구 기준: [교육 근거](mission-learning-evidence.md).

## 실제 검토 범위

관계 미션 168개 전체를 원본 배열 0~167 순서로 읽었다. introductions, small-talk, invitations, friends-family, feelings-opinions, conflict-resolution 각각 28개이며 각 영역의 pre-A1~C2 각 4개를 포함한다. 상황·학습자 역할·상대 역할과 사실·첫 발화·504개 단계의 goal/example/cue·결과·전이 조건을 함께 검토했다. 출력이 잘린 16~27 구간은 별도로 다시 읽어 누락을 보완했다.

검토 기준은 입력에 없는 사실을 학습자가 만들어야 하는지, 상대가 필요한 정보를 응답할 수 있는지, 위치·시각·조건이 서로 맞는지, 영어 예시가 자연스럽고 단계 목표와 힌트가 연결되는지, 수준이 단순 문장 길이가 아닌 과업 복잡성으로 구분되는지, 제목만 다른 중복인지였다.

## 편집 결과

**73개 미션을 수정**했다. 한 미션에 여러 수정 유형이 겹치므로 아래 필드별 개수의 합은 73보다 크다.

- `steps` 변경: 40개 미션
- `scenario` 변경: 42개 미션
- `interlocutorRole` 변경: 7개 미션
- `opening` 변경: 1개 미션
- `transfer` 변경: 1개 미션

주요 수정:

- `check-friend-location`: 학습자와 친구가 이미 같은 벤치에 있는데 상대를 다시 부르던 모순을 제거했다. 학습자는 정문, 친구는 큰 나무 옆 벤치로 구분하고 위치 확인 후 학습자가 이동한다.
- `ask-before-borrow`: 소파 옆 반환 요청을 소파 위로 바꿔 말하던 예시를 바로잡았다.
- `mediate-competing-traditions`: 상대가 제안한 식후 산책과 오후 산책 예시의 불일치를 수정했다.
- `separate-home-current`, `share-local-tip`, `check-location`, `discuss-money-between-friends`, `set-conversation-pause` 등: 예시에만 있던 거주 이력·시설 시간·약속 시각·상환일·재개 시각의 근거를 가상 상황에 제공했다.
- `introduce-with-pronunciation`: 실제 연습 이름 없이 두 부분으로 나누라는 과제에 가상 이름 Jiyun을 제공했다. 텍스트로 실제 음성 발음 정확도를 검증하지 않는다는 범위를 명시했다.
- `revise-conviction-publicly`: 무엇인지 없는 수치 오류를 200명→80명 정정과 별도 접근성 기록 6건으로 구체화했다. 숫자 정정·영향 범위·축소 시범안이 실제 입력에 연결된다.
- `distinguish-explanation-endorsement`, `create-fair-repair-process` 등: 추상적 갈등에 실제 판단할 사건과 불확실한 기록을 추가했다.
- `greet-morning`, `recognize-pet`, `choose-family-meal`: 목표 달성에 필요한 상대의 후속 질문·안내를 역할에 넣었다.
- `ask-repeat-please`: help 한 단어만으로 한국어 요청이 전달된다고 보던 전이 지시를 `Korean, please`로 바꿨다.
- 일부 cue가 다른 단계의 영어를 설명하던 문제를 해당 단계에서 실제 쓰는 표현으로 정렬했다. `invite-lunch`와 `ask-space`의 요청도 자연스럽게 조정했다.

## 수준·중복 판단과 검증 한계

수준과 기존 168개 키는 유지했다. 관계 유지·거절·동의 범위·사생활 보호는 여러 영역에 반복되지만, 호칭 사용, 초대 비용, 사진 공개, 가족 연락, 집단 중재 등 상대·목적·제약·요구 결과가 달라 동일 텍스트를 제목만 바꾼 미션으로 판단하지 않았다. 고급 영역은 갈등·경계·함의 해석 비중이 높으므로 전체 교육과정에서 창작·협력·축하 등 긍정적 과업도 함께 선택할 수 있어야 한다. 본 검토를 모든 수준의 외부 CEFR 보정이나 원어민 편집 인증으로 취급하지 않는다.

편집 후 JSON 파싱, 168개 유지, 42개 영역-수준 조합 각 4개, 키 고유성, 504단계 필수값 검사는 PASS다. 본문/catalog는 부모 작업의 재생성 대상으로 남겼으며 이 원본 검토만으로 생성 파일 동기화·실제 학습자 효능·오디오 평가·원격 게시가 완료됐다고 표시하지 않는다.

## 변경 키

- `say-your-name`
- `spell-short-name`
- `choose-call-name`
- `separate-home-current`
- `adapt-personal-intro`
- `reframe-low-status-role`
- `introduce-with-pronunciation`
- `bridge-disciplinary-intro`
- `revise-self-narrative`
- `greet-morning`
- `name-weather`
- `recognize-pet`
- `weekend-plan-short`
- `follow-up-hobby`
- `share-local-tip`
- `repair-one-upmanship`
- `defuse-loaded-banter`
- `question-rumor-politely`
- `bridge-language-speed`
- `untangle-ironic-consensus`
- `respond-double-bind`
- `invite-lunch`
- `check-location`
- `bring-friend`
- `ask-what-bring`
- `confirm-food-needs`
- `invite-low-pressure`
- `set-event-boundary`
- `repair-excluded-invite`
- `mediate-competing-traditions`
- `handle-symbolic-guest`
- `negotiate-public-private-event`
- `name-family-member`
- `choose-family-meal`
- `check-friend-location`
- `ask-before-borrow`
- `arrange-check-in`
- `thank-specific-support`
- `negotiate-visit-duration`
- `renegotiate-household-task`
- `set-family-update-boundary`
- `discuss-money-between-friends`
- `handle-unsolicited-advice`
- `share-care-responsibility`
- `agree-simple-reason`
- `share-proud-moment`
- `separate-feeling-fact`
- `weigh-hobby-choice`
- `disagree-movie-view`
- `name-mixed-feelings`
- `qualify-generalization`
- `explain-value-tradeoff`
- `respond-invalidated-feeling`
- `express-regret-without-self-erasure`
- `interpret-ambivalence`
- `distinguish-explanation-endorsement`
- `challenge-neutral-framing`
- `revise-conviction-publicly`
- `mediate-incommensurable-values`
- `ask-repeat-please`
- `ask-space`
- `apologize-late-arrival`
- `refuse-small-favor`
- `correct-group-credit`
- `negotiate-apology-impact`
- `respond-unfair-accusation`
- `set-conversation-pause`
- `reframe-intent-impact-dispute`
- `respond-conditional-apology`
- `restore-after-public-argument`
- `separate-forgiveness-reconciliation`
- `resolve-competing-harms`
- `create-fair-repair-process`
