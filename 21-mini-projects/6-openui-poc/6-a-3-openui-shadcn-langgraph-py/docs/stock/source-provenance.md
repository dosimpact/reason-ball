# 복사 출처와 변경 범위

출처: `original-reference/openui/examples/design-systems/shadcn`. 원본 폴더는 변경하지 않았다. 아래 경로는 frontend 기준이다.

페이지·스타터·레이아웃·CSS·library 진입점·Tailwind 설정도 복사했다. 페이지는 AG-UI 전환 및 에이전트 이름만 변경했다. package.json은 참조 의존성에 LangChain 프록시·검증 스크립트를 통합하고 직접 OpenAI 의존성을 제외했다.

| 파일 | 현재 상태 |
| --- | --- |
| `src/components/ui/accordion.tsx` | 원본 동일 |
| `src/components/ui/alert-dialog.tsx` | 원본 동일 |
| `src/components/ui/alert.tsx` | 원본 동일 |
| `src/components/ui/avatar.tsx` | 원본 동일 |
| `src/components/ui/badge.tsx` | 원본 동일 |
| `src/components/ui/button.tsx` | 원본 동일 |
| `src/components/ui/calendar.tsx` | 원본 동일 |
| `src/components/ui/card.tsx` | 원본 동일 |
| `src/components/ui/carousel.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/components/ui/chart.tsx` | 원본 동일 |
| `src/components/ui/checkbox.tsx` | 원본 동일 |
| `src/components/ui/data-table.tsx` | 원본 동일 |
| `src/components/ui/dialog.tsx` | 원본 동일 |
| `src/components/ui/drawer.tsx` | 원본 동일 |
| `src/components/ui/dropdown-menu.tsx` | 원본 동일 |
| `src/components/ui/input.tsx` | 원본 동일 |
| `src/components/ui/label.tsx` | 원본 동일 |
| `src/components/ui/pagination.tsx` | 원본 동일 |
| `src/components/ui/popover.tsx` | 원본 동일 |
| `src/components/ui/progress.tsx` | 원본 동일 |
| `src/components/ui/radio-group.tsx` | 원본 동일 |
| `src/components/ui/select.tsx` | 원본 동일 |
| `src/components/ui/separator.tsx` | 원본 동일 |
| `src/components/ui/slider.tsx` | 원본 동일 |
| `src/components/ui/switch.tsx` | 원본 동일 |
| `src/components/ui/table.tsx` | 원본 동일 |
| `src/components/ui/tabs.tsx` | 원본 동일 |
| `src/components/ui/textarea.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/action.ts` | 원본 동일 |
| `src/lib/shadcn-genui/components/accordion.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/alert-dialog-block.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/alert.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/avatar.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/badge.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/button.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/buttons.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/calendar-block.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/card-header.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/carousel.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/charts.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/checkbox-group.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/code-block.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/date-picker.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/dialog-block.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/drawer-block.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/follow-up-block.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/form-control.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/form.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/image.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/input.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/label.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/markdown-renderer.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/pagination-block.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/progress.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/radio-group.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/select.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/separator.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/slider.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/switch-group.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/table.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/tabs.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/tag.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/text-content.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/components/textarea.tsx` | Hook 명명 / Carousel 구독 정리 |
| `src/lib/shadcn-genui/components/typography.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/helpers.ts` | 원본 동일 |
| `src/lib/shadcn-genui/index.tsx` | 원본 동일 |
| `src/lib/shadcn-genui/rules.ts` | 원본 동일 |
| `src/lib/shadcn-genui/unions.ts` | 원본 동일 |

원본 OpenAI API route, app-tools.ts, tool-loop.ts, model-prompt.ts, env.ts는 가져오지 않았다. Python graph/streaming/tools는 기반 6-a-1에서 유지했다. graph에는 예제 수치를 sample data로 표시하는 지시를 추가했다. 테스트·프롬프트 동기화 스크립트·stock/flow 문서는 이 통합을 위해 추가했다. 라이선스는 frontend/OPENUI-LICENSE에 보존했다.
