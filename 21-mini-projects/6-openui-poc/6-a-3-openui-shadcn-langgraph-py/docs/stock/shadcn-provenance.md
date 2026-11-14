# shadcn/ui 출처와 구현 범위

## SHADCN-CATALOG-001 공식 목록

2026-11-10에 [공식 Components 목록](https://ui.shadcn.com/docs/components)을 대조했다. 별도 AI Elements 목록은 포함하지 않는다. `frontend/src/lib/shadcn-genui/expanded-shadcn/coverage.json`에 공식 66개 slug, 대응 OpenUI 이름, 기존/추가 여부 및 범위 제한을 보관한다. 기존 대응 28개, 추가 대응 38개다. 이는 공식 페이지별 대응이며 모든 variant와 모든 하위 primitive를 별도 OpenUI 함수로 제공한다는 뜻은 아니다.

## SHADCN-CATALOG-002 복사한 코드

이번 추가의 `frontend/src/components/ui/` 파일 34개는 공식 shadcn 레지스트리 원본이다. 기본 출처는 `https://ui.shadcn.com/r/styles/new-york-v4/{slug}.json`이며 Trace와 Questionnaire는 해당 스타일에 없어서 `radix-nova` 스타일의 동명 항목을 사용했다. 정확한 항목과 의존성은 `expanded-shadcn/registry-dependencies.json`을 따른다.

로컬 import 경로, Lucide 아이콘, 기존 Button size API를 맞췄다. Sidebar skeleton의 무작위 너비는 hydration 및 React 순수성 검사를 위해 고정 너비로 바꿨다. Sidebar 모바일 판별 훅은 프로젝트 내부에 추가했다. `expanded-shadcn/index.tsx`는 프로젝트에서 작성한 OpenUI 스키마와 조합 래퍼다.

원본 라이선스는 [shadcn/ui MIT License](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md)이며 저작권은 `Copyright (c) 2023 shadcn`이다. 원본 라이선스 전문을 `frontend/src/components/ui/LICENSE.shadcn`에 포함한다. 런타임 npm 의존성의 라이선스는 각 배포 패키지에 따른다.

## SHADCN-CATALOG-003 대응의 경계

- Checkbox와 Switch는 기존 그룹 래퍼가 실제 Radix Checkbox/Switch를 한 개 이상 렌더링한다. Item 정의 자체는 데이터이며 단독 시각 컴포넌트가 아니다.
- 단순 Table과 TanStack DataTableBlock은 다르다. DataTableBlock에서 정렬, 필터, 페이지 이동 및 열 표시를 제공한다.
- Typography는 Heading/Blockquote/InlineCode의 등록 범위이며 공식 문서의 모든 예제 스타일을 의미하지 않는다. Chart도 등록된 Recharts 차트 7종의 범위다.
- Combobox는 현재 공식 레지스트리의 Base UI 구현이다. MessageScroller와 Questionnaire는 공식 `@shadcn/react`를 사용한다. 나머지 상호작용은 해당 Radix primitive 또는 공식 조합을 사용한다.
- 메뉴 선택과 사이드바 항목은 기존 OpenUI 대화 액션을 실행한다. 갤러리는 액션을 로컬에 기록하므로 모델을 호출하지 않는다. Toast는 로컬 알림이다.

DialogBlock과 Sheet는 안정적인 하위 React 컴포넌트에서 controlled open 상태와 Escape 처리를 소유한다. 닫힐 때 `onCloseAutoFocus`에서 trigger ref로 키보드 포커스를 명시적으로 복원한다. 갤러리에서 Escape 후 body에 포커스가 남는 현상을 상호작용 검사로 확인한 뒤 보완했다.

정적 검사, 실제 갤러리 렌더 및 상호작용 검증은 분리해서 보고한다. fixture가 존재한다는 사실만으로 브라우저 검증 완료를 주장하지 않는다.
