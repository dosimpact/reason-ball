import { test, expect } from "@playwright/test";

test("specialized View/API/E2E templates create independent verification documents", async ({
  page,
  request,
}) => {
  const project = await (
    await request.post("/api/projects", {
      data: { title: "Verification templates" },
    })
  ).json();
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    for (const [type, keyword] of [
      ["View", "Storybook"],
      ["API", "Bruno"],
      ["E2E", "Chrome CDP"],
    ]) {
      await page.getByRole("button", { name: "새 문서", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "하위 문서 만들기",
        exact: true,
      });
      await dialog.getByLabel("새 문서 제목").fill(`${type} specification`);
      await dialog
        .getByLabel("사용할 템플릿")
        .selectOption({ label: `설계-검증 ${type}` });
      await dialog
        .getByRole("button", { name: "문서 만들기", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: `${type} specification`,
          exact: true,
        }),
      ).toBeVisible();
      const documents = await (
        await request.get(`/api/documents?projectId=${project.id}`)
      ).json();
      const doc = documents.find(
        (d: { title: string }) => d.title === `${type} specification`,
      );
      expect(doc.body).toContain(keyword);
      expect(doc.templateSnapshot.title).toBe(`설계-검증 ${type}`);
      expect(doc.checklist).toHaveLength(3);
      expect(
        doc.checklist.every(
          (c: { aiResult: string; humanConfirmed: boolean }) =>
            c.aiResult === "pending" && !c.humanConfirmed,
        ),
      ).toBeTruthy();
    }
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});
