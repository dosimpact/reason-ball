# 공통 설계 원칙

> Scope: `shared`. 이 워크스페이스의 TypeScript 및 Python 코드 설계·구현·리뷰에 적용한다. 도메인별 업무 규칙과 런타임 구조는 해당 도메인의 설계 문서에서 관리한다.

## 언어와 코드 작성 규칙

- JavaScript 애플리케이션은 TypeScript, Python 서비스는 Python을 사용한다.
- 프레임워크가 생성한 포맷과 각 패키지의 기존 스타일을 유지한다.
- TypeScript 변수·함수는 `camelCase`, 컴포넌트·클래스는 `PascalCase`, Python 모듈·함수·변수는 `snake_case`를 사용한다.
- 핵심 변환은 가능한 한 순수 함수로 유지하고 공개 동작과 회귀 사례를 검증한다.
- 요청 범위 안에서 작게 변경하고 관련 없는 패키지를 리팩터링하지 않는다.

## DESIGN-SLAP-001: 단일 추상화 수준 원칙

**SLAP(Single Level of Abstraction Principle)**은 하나의 함수가 일관된 추상화 수준의 작업을 다루도록 하는 원칙이다. 상위 함수는 작업의 목적과 흐름을 드러내고, 하위 함수는 각 작업을 수행하는 구체적인 방법을 담당한다.

### 적용 기준

- 업무 흐름을 조율하는 함수에 SQL 구성, HTTP 요청 옵션, 응답 필드 파싱 등 세부 구현을 섞지 않는다.
- 세부 구현을 분리할 때는 수행 의도가 드러나는 이름을 사용한다. `processData`처럼 의미가 모호한 이름으로 복잡성을 숨기지 않는다.
- 함수 분리는 줄 수나 호출 개수가 아니라 의미와 추상화 수준을 기준으로 판단한다. 같은 수준의 반복문·조건문·계산은 한 함수에 둘 수 있다.
- 단순한 표현을 기계적으로 감싸거나, 한 번 더 따라가야만 의미를 알 수 있는 불필요한 함수를 만들지 않는다.
- 분리 과정에서 실행 순서, 반환값, 오류 전파, 트랜잭션 경계, 부수 효과를 보존한다. 리소스 정리와 오류 처리는 해당 자원의 수명과 실패 정책을 책임지는 수준에 둔다.
- 신규 코드와 변경 대상 코드에 적용한다. 원칙 도입만을 이유로 관련 없는 기존 코드를 일괄 리팩터링하지 않는다.

### 적용 예시

다음은 구조를 설명하는 TypeScript 예시이며 실제 API 계약은 아니다. 업무 흐름을 읽다가 응답 바이트를 처리하는 세부 단계로 내려가는 경우다.

```ts
async function collectFiling(input: FilingInput) {
  const filing = validateFiling(input);
  const response = await fetch(filing.url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const content = new TextDecoder().decode(await response.arrayBuffer());
  return saveFilingContent(filing, content);
}
```

다운로드 세부 구현을 의미 있는 작업으로 분리하면 상위 함수에서 검증 → 다운로드 → 저장 흐름을 같은 수준으로 읽을 수 있다.

```ts
async function collectFiling(input: FilingInput) {
  const filing = validateFiling(input);
  const content = await downloadFilingText(filing.url);
  return saveFilingContent(filing, content);
}

async function downloadFilingText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  return new TextDecoder().decode(await response.arrayBuffer());
}
```

Python에도 동일하게 적용하며 함수 이름은 기존 규칙대로 `snake_case`를 사용한다. 함수 분리가 새 클래스·패키지·아키텍처 계층의 추가를 요구하지는 않는다.

### 리뷰 기준

1. 함수의 주요 단계들을 비슷한 수준의 문장으로 설명할 수 있는가?
2. 업무 흐름 중간에 저장·통신·파싱의 세부 구현이 끼어들지 않는가?
3. 추출한 함수 이름만 읽어도 역할을 이해할 수 있는가?
4. 분리 후에도 기존 동작과 실패 시의 처리 방식이 유지되는가?

SLAP은 코드 리뷰로 판단한다. 함수 길이 제한이나 린터 통과만으로 준수 여부를 판정하지 않는다. 코드가 바뀌면 영향받는 공개 동작과 회귀 사례를 검증하며, 세부 함수 호출 순서만 고정하는 테스트는 피한다. 공통 검증 정책은 [Test and Validation Design](test-design.md)을 따른다.

### 다른 원칙과의 구분

단일 책임 원칙(SRP)은 책임과 변경 이유에, SLAP은 함수 내부의 추상화 수준에 초점을 둔다. 한 가지 업무만 수행하는 함수도 업무 흐름과 세부 구현을 섞을 수 있으므로 두 기준은 별도로 검토한다.
