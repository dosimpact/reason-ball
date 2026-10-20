import { expect, it } from "vitest";
import { sourceNumber, sourceHours } from "./vendor-report";

it("distinguishes explicit zero, missing values and signed source amounts", () => {
  expect(sourceNumber("—")).toBeNull();
  expect(sourceNumber("확인 불가")).toBeNull();
  expect(sourceNumber("0시간")).toBe(0);
  expect(sourceNumber("−600,000원")).toBe(-600_000);
  expect(sourceHours("최근 2주간 137시간 우선순위 문제")).toBe(137);
  expect(sourceHours("최근 2주간 근거 있는 문제 시간 없음")).toBeNull();
  expect(sourceHours("W1 27시간 / W2 88시간")).toBeNull();
});
