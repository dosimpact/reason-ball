import { createParser } from "@openuidev/lang-core";
import { describe, expect, it } from "vitest";
import spec from "@/generated/spec.json";
import { exampleVendorReport } from "./prompt-options";
import { buildReportMessage } from "./report-prompt";
import { insightExpression, reportProblems } from "./validate-report";
import { continuousVendorReport } from "./continuous-report";

describe("source-grounded interactive reports", () => {
  it("teaches a complete program that actually matches the catalog", () => {
    const result = createParser(spec.schema, spec.root).parse(exampleVendorReport);
    expect(result.meta.errors).toEqual([]);
    expect(result.meta.unresolved).toEqual([]);
    expect(result.meta.orphaned).toEqual([]);
    expect(reportProblems(exampleVendorReport)).toEqual([]);
  });

  it("keeps the exact source and leaves free-form follow-ups to normal chat", () => {
    const text = "광고 매출 | 8,000,000원 | 9,000,000원 | +800,000원";
    const message = buildReportMessage("vendor.md", text);
    expect(message).toContain(`<report-source>\n${text}\n</report-source>`);
    expect(() => buildReportMessage("empty.md", "  ")).toThrow("본문");
  });

  it("rejects table-only reports and unresolved component references", () => {
    expect(reportProblems('root = Col([Table(["값"], [[1]])])')).toContain("Report requires at least 3 Chart call(s)");
    expect(reportProblems(exampleVendorReport.replace("heading = Col", "other = Col")).some((issue) => issue.includes("heading"))).toBe(true);
  });

  it("catches multiline ternaries that silently discard branches", () => {
    const broken = exampleVendorReport.replace('? campaigns : @Filter', '? campaigns :\n@Filter');
    expect(reportProblems(broken).some((issue) => issue.includes("one physical line"))).toBe(true);
  });

  it("upgrades only the legacy vendor scaffold and preserves commentary and source facts", () => {
    const legacy = exampleVendorReport.replace(/^root = .*\n/, 'root = Col([heading, quality, navigation, body])\n$section = "개요"\n')
      + '\nnavigation = SegmentedControl($section, ["개요", "캠페인", "재고", "조치", "근거"])\nbody = $section == "개요" ? overview : $section == "캠페인" ? campaignView : $section == "재고" ? inventoryView : $section == "조치" ? actionView : evidenceView';
    const upgraded = continuousVendorReport(legacy);
    expect(reportProblems(upgraded)).toEqual([]);
    expect(upgraded).toContain('Title("성과 개요"');
    expect(upgraded).not.toContain("SegmentedControl(");
    expect(continuousVendorReport(upgraded)).toBe(upgraded);
    expect(continuousVendorReport('root = Col([Text("일반 대화")])')).toBe('root = Col([Text("일반 대화")])');
    for (const line of exampleVendorReport.split("\n").slice(1).filter((line) => !line.startsWith("overview ="))) expect(upgraded).toContain(line);
  });

  it("blocks conflicting equal-budget increase advice and preserves literal IDs", () => {
    const generated = 'root = Col([Card([Title("다음 조치", "md"), Text("CAMP_003은 예산 증액을 권장합니다. VID_0022를 확인하세요.", "sm")])])';
    const guarded = insightExpression(generated, true)!;
    expect(guarded).toContain("원문 수치 확인이 필요");
    expect(guarded).not.toContain("예산 증액을 권장합니다");
    expect(insightExpression(generated, false)).toContain("`CAMP_003`");
    expect(insightExpression('root = Col([HtmlView("<script>alert(1)</script>")])')).toBeNull();
  });
});
