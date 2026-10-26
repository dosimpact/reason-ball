# OpenUI 통합 판단표

## MERGE-001 우선순위

6-2의 84개 등록을 유지한다. 기능이 일부 겹쳐도 추가 표현/입력/상태 계약이 있으면 별도 이름으로 보존한다. 단순 외형 유사성만으로 삭제하지 않는다. Card.children 확장은 기존 계약의 허용 범위를 넓히기만 한다.

| 6-3 등록 | 처리/통합 이름 | 판단 근거 |
|---|---|---|
| Col | 이름 변경 → VStack | 세로 레이아웃; 기존 Col은 표의 열 |
| Row | 추가 → Row | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Box | 추가 → Box | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Grid | 추가 → Grid | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Card | 이름 변경 → IuiCard | 패널 variant/padding/gap 제공; 기존 Card sources와 별도 계약 |
| Carousel | 이름 변경 → IuiCarousel | 개별 Node와 itemWidth/gap; 기존 Carousel은 중첩 콘텐츠 배열 |
| Popover | 추가 → Popover | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Divider | 제외 → Separator | 인자 없는 수평 구분선은 기존 Separator()로 충족 |
| Spacer | 추가 → Spacer | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Title | 추가 → Title | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Text | 이름 변경 → IuiText | 인라인 Node 배열과 color/weight/장식; 기존 Text의 variant/value 계약과 다름 |
| Caption | 추가 → Caption | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Label | 제외 → Label | Label(text) 동일 역할/호출; 6-2 채택 |
| Badge | 추가 → Badge | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Link | 추가 → Link | 6-2에 동일 등록이 없는 추가 UI 계약 |
| List | 추가 → List | 6-2에 동일 등록이 없는 추가 UI 계약 |
| ListItem | 이름 변경 → IuiListItem | marker와 children; 기존 ListItem은 image/action |
| Markdown | 추가 → Markdown | 커스텀 마크다운 렌더러/표현 계약; 기존 MarkDownRenderer의 variant 계약과 다름 |
| Quote | 추가 → Quote | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Code | 추가 → Code | 자체 코드 렌더러 계약; 기존 CodeBlock의 인자와 다름 |
| Math | 추가 → Math | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Button | 이름 변경 → IuiButton | 아이콘/disabled/block/color 옵션; 기존 Button 계약 보존 |
| IconButton | 이름 변경 → IuiIconButton | icon 문자열 첫 인자; 기존 IconButton은 name과 Icon 노드 |
| Pressable | 추가 → Pressable | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Input | 이름 변경 → IuiInput | 첫 인자 상태 바인딩 및 숫자 변환; 기존 Input은 name/validation 규칙 |
| TextArea | 이름 변경 → IuiTextArea | 첫 인자 상태 바인딩; 기존 name/rules 계약과 다름 |
| Select | 이름 변경 → IuiSelect | 직접 string/object 옵션; 기존 SelectItem/rules 구성과 다름 |
| SegmentedControl | 추가 → SegmentedControl | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Slider | 이름 변경 → IuiSlider | 단일 숫자 바인딩/unit/marks; 기존 Slider는 배열 바인딩 |
| Checkbox | 추가 → Checkbox | 6-2에 동일 등록이 없는 추가 UI 계약 |
| RadioGroup | 이름 변경 → IuiRadioGroup | 직접 옵션 및 pills/cards 변형; 기존 RadioItem 구성과 다름 |
| DatePicker | 이름 변경 → IuiDatePicker | 날짜 문자열 바인딩/min/max; 기존 DatePicker는 name/mode/rules |
| Timer | 추가 → Timer | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Form | 이름 변경 → IuiForm | 임의 Node 자식과 로컬 FormNameContext; 기존 Form은 name/buttons/fields |
| SearchImage | 추가 → SearchImage | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Image | 이름 변경 → IuiImage | src/alt 순서와 aspectRatio/radius/fit 및 이미지 검색 fallback |
| Icon | 이름 변경 → IuiIcon | size/color 옵션; 기존 Icon은 category 옵션 |
| Table | 이름 변경 → IuiTable | 행 단위 데이터와 컴포넌트 셀; 기존 Table은 열 단위 데이터 |
| Chart | 추가 → Chart | 행 객체 데이터의 범용 차트 계약; 기존 타입별 차트와 입력 구조가 다름 |
| Map | 추가 → Map | 6-2에 동일 등록이 없는 추가 UI 계약 |
| MapMarker | 추가 → MapMarker | 6-2에 동일 등록이 없는 추가 UI 계약 |
| YouTube | 추가 → YouTube | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Flashcard | 추가 → Flashcard | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Celebration | 추가 → Celebration | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Svg | 추가 → Svg | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Circle | 추가 → Circle | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Ellipse | 추가 → Ellipse | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Rect | 추가 → Rect | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Line | 추가 → Line | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Path | 추가 → Path | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Polyline | 추가 → Polyline | 6-2에 동일 등록이 없는 추가 UI 계약 |
| Polygon | 추가 → Polygon | 6-2에 동일 등록이 없는 추가 UI 계약 |
| G | 추가 → G | 6-2에 동일 등록이 없는 추가 UI 계약 |
| SvgText | 추가 → SvgText | 6-2에 동일 등록이 없는 추가 UI 계약 |
| HtmlView | 추가 → HtmlView | 6-2에 동일 등록이 없는 추가 UI 계약 |

## 함수와 액션

59개 함수는 보존하되 Slice → IuiSlice로 등록한다. 6-2의 파이 차트 Slice를 우선한다. CopyToClipboard를 추가하고 호스트 onAction과 연결한다. 내장 @Set/@Reset/@ToAssistant는 OpenUI 런타임이 처리한다.

## 검증 기준

- 기존 84개 명세 회귀 검사; Card의 기존 자식/출처 인자는 모두 유지.
- 추가 컴포넌트 53개(17개 이름 변경 + 36개 고유 이름), 최종 137개.
- 45개 상속 예제 변환/파싱/브라우저 양쪽 테마 검증.
- 혼합 Card 안에서 표/출처와 상태/함수/액션/SVG의 동시 동작 검증.
