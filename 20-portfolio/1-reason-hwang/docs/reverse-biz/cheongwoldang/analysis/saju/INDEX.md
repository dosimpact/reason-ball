# 사주·운세 도메인 분석

> 상태: 작성 대기. [사주 팩트](../../factbook/saju/INDEX.md)와 전체 조사 게이트를 먼저 확인한다.

| 문서 | 소유 내용 |
| --- | --- |
| [입력·프로필 정책](01-input-profile-policy.md) | 생년월일시·달력·인물·수정·재사용 |
| [계산·생성 구조](02-calculation-generation.md) | 입력 정규화, 명리 정보, 상품·기간별 생성 가설 |
| [결과·오늘의 운세](03-results-daily-fortune.md) | 결과 목차, 공개 범위, 반복 이용과 날짜 정책 |

## 공통 정책 연결

[상품·결제·권리](../02-commerce-entitlements-library.md), [공통 생성·콘텐츠](../05-generation-content-operations.md), [데이터·서비스 계약](../06-data-service-contracts.md), [개발 착수](../10-requirements-acceptance.md)를 참조한다.

## 작성 완료 기준

사주 입력이 어떤 처리와 결과를 만드는지, 입력 수정·시간 모름·다중 인물·기간 변경이 어떤 영향을 주는지 설명할 수 있어야 한다. 계산 방법을 외부 화면에서 확인하지 못했다면 신규 구현에 필요한 정책 결정으로 남긴다.
