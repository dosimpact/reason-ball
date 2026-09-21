import { A2UIDemo } from "@/features/a2ui-demo/demo";

export default function FixedPage() {
  return <><aside className="mx-auto max-w-5xl px-6 pt-6 text-sm" aria-label="기내식과 좌석 데모 안내">추가 데모: “도쿄에서 인천 항공편의 기내식과 좌석을 선택하고 싶어”라고 입력하세요. 기내식과 좌석을 함께 고르고 확정할 수 있습니다.</aside><A2UIDemo mode="fixed" /></>;
}
