# LEARN-05 / NFR-10 범위 교정 감사

읽기 전용 감사. root 전체89 실행70603 진행 중 저장소/서버/DB/브라우저 변경 없음. graph에 web generation/coverage가 없어 지정 파일 소스 읽기로 대조함.

## LEARN-05

- `docs/stock/business-design.md:231`: **턴 평가 | 의미 전달, 문법, 어휘, 자연스러움을 근거와 함께 평가**. '자동', '매 턴', '4축을 매번'이라는 실행 빈도/방식 명세는 없다.
- `docs/stock/system-design.md:764-768`: 두 층의 평가를 구분한다. 턴 평가는 '학습 흐름을 위한 저비용 힌트와 objective evidence 후보', 종료 평가는 저장 transcript/objective state를 바탕으로 rubric 점수·근거 생성이다. 따라서 자동 턴별4축이 없다는 이유만으로 전체 LEARN05를 구현 없음으로 판정하면 과도하다.
- `docs/flow/2026-09-11-business-case-inventory.md:124`의 '자동 턴별4축 미검증'은 원문보다 강한 해석이며 분리/정정이 필요하다.
- `apps/web/src/app/api/ai/evaluate/route.ts:57-79`: 모델 axis마다 score와 evidence(messageId,rationale)를 요구한다. :128-133 레이블은 과업완수(taskCompletion), 상황적절성(appropriateness), 문법·명료성(grammar), 어휘(vocabulary). 원문의 의미전달·자연스러움에 대한 근접 운영화이지 독립적인 의미전달/자연스러움 척도가 정확히 같다는 증명은 아니다.
- 같은 route :294-303에서 근거 ID를 저장된 사용자 transcript에 매칭하고 quote를 실제 message.text 앞500자로 만든다. 잘못된 ID는 제거되므로 변환 후 빈 evidence가 되지 않는지도 검사해야 한다. :322는 `{axes}`를 rubric_scores에 저장한다.
- `features/mission-reward/ui/mission-result-panel.tsx:58-73`은 모든 axis 점수와 첫 evidence quote/rationale를 표시한다.
- `tests/e2e/live/mission-ai.spec.ts:83`, reward-preservation:85는 axes.length=4만 검사한다. mission-evaluation-recovery는 STEP evidence를 사용자 DB ID와 비교하므로 AXIS별 evidence의 충분성/화면/복원을 대신하지 않는다.

**최소 충실한 다음 회귀**: 실제 게시 미션에서 저장된 사용자2턴/실제AI2답변 뒤 명시 평가. 각 정확한 axis key, 0..100 점수, 비어 있지 않은 근거, 소유자 user row ID, 실제 본문 앞500자와 동일 quote, 비어 있지 않은 rationale를 확인한다. DB rubric_scores와 HTTP axes가 같고 UI 각axis의 점수/첫 인용/이유가 표시되며 reload에서 그대로 복원되는지 검사한다. 정상 evaluator의 pass/fail 점수를 테스트가 임의로 강제하지 않는다.

**남는 한계**: 수동 whole-mission rubric에 연결된 사용자턴 근거를 검사한다. 사용자 선택한 한 턴의 독립적4축 평가 UX/저비용 턴 힌트·근거 후보 갱신은 별도 범위이며 이 테스트로 구현됐다고 주장하지 않는다. 의미적 평가 정확도 또한 점수스키마와 근거의 출처 무결성만으로 확증할 수 없다. 분류는 MISSING→PARTIAL 검토가 타당하며 자동평가 의무를 추가해서는 안 된다.

## NFR-10

- `docs/stock/business-design.md:467`: **UI 문자열과 학습 언어/설명 언어를 분리 가능하게 설계**. 사용자 locale switch UI, 모든 언어 번역, 영문UI 완성은 명시하지 않는다.
- 같은 문서 :545의 초기 대상은 한국어 설명을 사용하는 Pre-A1~A2 성인이다.
- `entities/learning-assistance/model/assistance.ts:11`은 suggestion/brief/explanation을 별도 필드로 두고 :37은 suggestion 영어, brief/explanation 한국어와 영어예시를 요구한다. 이미 학습내용/설명내용의 구조적 분리가 일부 존재한다.
- `shared/api/ai/instructions.ts:24`는 영어회화/필요시한국어지원을 구분한다. UI레이블과 이 AI언어정책이 같은 값에 종속되어 있지는 않다.
- 반면 `features/mission-reward/ui/mission-result-panel.tsx:35-36,62,80,95`와 여러기존UI에서 한국어 문자열이 직접 내장되어 중앙UI문구resource 경계는 해당화면에 없다. 따라서 '완전히미구현'보다 '학습/설명 필드는 분리됐고 UI resource 경계 미완성'이 정확하다.

**최소 충실한 구현/검증**: UI문구catalog/typed accessor를 학습언어/설명언어 설정과 구분하고 주요화면이 그것을 사용하도록 설계한다. 계약검사로 UI문구resource를 다른 테스트resource로 주입해도 원래 영어메시지/미션본문/AI언어설정이 변하지 않는지 확인한다. 실제두번째locale제품·언어전환메뉴·모든번역완성을 임의완료조건으로 추가하지 않는다. 선택한몇개화면만이관하면 PARTIAL로 범위를 표시한다.
