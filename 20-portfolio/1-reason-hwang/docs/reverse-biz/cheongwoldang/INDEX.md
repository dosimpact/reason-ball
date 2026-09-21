# 청월당 사주·타로 역기획 문서 맵

이 디렉터리는 청월당의 사주·운세 및 타로 기능을 실제 화면에서 전수 조사하고, 확인한 사실을 기반으로 개발 가능한 수준의 역기획 명세를 만드는 작업 공간이다.

## 읽는 순서

1. [프로젝트 계약](00-project-contract.md)에서 범위, 증거 규칙, 완료 조건을 확인한다.
2. [팩트북](factbook/INDEX.md)을 읽고 실제 화면·동작 조사 결과를 확인한다.
3. 팩트북의 커버리지 게이트가 통과된 후 [역기획](analysis/INDEX.md)을 읽는다.
4. 도메인 상세는 사주와 타로의 INDEX에서 이어서 읽는다.
5. 화면·상품·여정·기능을 더 세분화할 때는 [개별 기록 템플릿](templates/INDEX.md)을 사용한다.

## 문서 구조

```text
cheongwoldang/
├── INDEX.md
├── 00-project-contract.md
├── factbook/
│   ├── INDEX.md
│   ├── 공통 사실 문서
│   ├── saju/
│   └── tarot/
├── analysis/
│   ├── INDEX.md
│   ├── business-design.md
│   ├── system-design.md
│   ├── 공통 비즈니스·제품 문서
│   ├── saju/
│   └── tarot/
├── templates/
│   └── 화면·상품·여정·기능별 기록 틀
└── assets/
    └── 화면 캡처와 관찰용 이미지
```

## 상태

| 영역 | 상태 | 완료 조건 |
| --- | --- | --- |
| 템플릿 구조 | 정의 완료 | 모든 INDEX와 하위 템플릿이 연결됨 |
| 팩트북 조사 | 조사 전 | 범위 내 화면·행동의 미조사 항목이 없음 |
| 역기획 분석 | 시작 전 | 팩트북 게이트 통과 후 작성 |
| 개발 명세 | 시작 전 | 요구사항, 계약, 인수 기준의 추적 연결 완료 |

현재 파일들은 질문·작성 기준·빈 기록표를 갖춘 골격이다. 실제 서비스 조사가 완료되었다는 뜻이 아니며, 관찰 FACT와 캡처는 아직 이 문서 묶음에 수집하지 않았다.

## 역할별 시작점

| 독자·목적 | 시작 문서 | 이어서 읽을 문서 |
| --- | --- | --- |
| 조사 진행 | [팩트북](factbook/INDEX.md) | [커버리지](factbook/07-coverage-gaps.md), [증거 원장](factbook/09-evidence-register.md) |
| 비즈니스 이해 | [통합 비즈니스 설계](analysis/business-design.md) | [공통·도메인 분석 목록](analysis/INDEX.md) |
| 개발 착수 | [통합 시스템 설계](analysis/system-design.md) | [요구사항·인수 기준](analysis/10-requirements-acceptance.md) |
| UI·이미지·캐릭터 | [트렌드 조사](analysis/08-visual-trends.md) | [시각·에셋 명세](analysis/09-design-system-assets.md), [캡처 보관](assets/INDEX.md) |

## 핵심 원칙

- 팩트북에는 관찰한 사실만 기록한다.
- 역기획에는 사실을 근거로 한 해석, 가설, 요구사항을 기록한다.
- 모든 분석 문장은 Fact ID 또는 근거 출처에 연결한다.
- 사주와 타로는 별도 도메인으로 분석하고 공통 플랫폼만 공유한다.
- UI·이미지·캐릭터 트렌드는 외부 출처와 조사 기준일을 기록한다.
