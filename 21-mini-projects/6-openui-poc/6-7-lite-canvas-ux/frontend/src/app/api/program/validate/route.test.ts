import { expect, it } from "vitest";
import { POST } from "./route";
const validate = async (program: string, mode?: string) => (await POST(new Request("http://local/api/program/validate", { method: "POST", body: JSON.stringify({ program, mode }) }))).json();
it("allows ordinary UI without weakening report quality rules", async () => {
  const program = 'root = Col([Title("Lisbon", "lg"), Text("Three stops")])';
  expect((await validate(program, "ui")).errors).toEqual([]);
  expect((await validate(program)).errors.length).toBeGreaterThan(0);
});
it("rejects unresolved UI references", async () => {
  expect((await validate("root = Col([missing])", "ui")).errors.join(" ")).toContain("Unresolved");
});

const staticReport = `root = Col([Chart("bar", rows, "label", ["value"]), Chart("line", rows, "label", ["value"]), Chart("bar", rows, "label", ["value"])])
rows = [{label: "W1", value: 10}, {label: "W2", value: 12}]`;
it("accepts a static PDF report while preserving interactive filter requirements", async () => {
  expect((await validate(staticReport, "pdf")).errors).toEqual([]);
  expect((await validate(staticReport, "interactive")).errors.join(" ")).toContain("state-bound");
});
it("rejects state and interactive components in PDF mode", async () => {
  const program = staticReport.replace("Col([", 'Col([Select($period, [{value: "all", label: "All"}]), ') + '\n$period = "all"';
  const errors = (await validate(program, "pdf")).errors.join(" ");
  expect(errors).toContain("state-dependent");
  expect(errors).toContain("static components only");
});
it("does not interpret prose mentioning controls as interactive code", async () => {
  expect((await validate(staticReport.replace("Col([", 'Col([Text("Select($period) is excluded"), '), "pdf")).errors).toEqual([]);
});
