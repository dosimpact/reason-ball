import { test, expect } from "@playwright/test";

test("stage document subtrees show nested children and update after creation/deletion", async ({
  page,
  request,
}) => {
  const project = await (
    await request.post("/api/projects", {
      data: { title: "Document tree test" },
    })
  ).json();
  try {
    const indexes = await (
      await request.get(`/api/documents?projectId=${project.id}`)
    ).json();
    const created = [];
    for (const phase of ["design", "implementation", "verification"]) {
      const parent = indexes.find((d: { phase: string }) => d.phase === phase);
      const response = await request.post("/api/documents", {
        data: {
          projectId: project.id,
          parentId: parent.id,
          phase,
          title: `${phase} document`,
          templateName: "view",
        },
      });
      expect(response.ok()).toBeTruthy();
      created.push(await response.json());
    }
    const child = await (
      await request.post("/api/documents", {
        data: {
          projectId: project.id,
          parentId: created[0].id,
          phase: "design",
          title: "Nested document",
          templateName: "view",
        },
      })
    ).json();
    await page.goto("/");
    await page
      .getByRole("button", { name: project.title, exact: true })
      .click();
    await expect(page.locator(".flow-document-node")).toHaveCount(4);
    await expect(
      page.locator(".react-flow__edge.flow-document-edge"),
    ).toHaveCount(4);
    const nested = page.locator(`[data-id="document:${child.id}"]`);
    await expect(nested).toBeVisible();
    await nested.click();
    await expect(
      page.getByRole("heading", { name: "Nested document", exact: true }),
    ).toBeVisible();
    const edge = page.locator(`[data-id="child:${child.id}"]`);
    await expect(edge).toHaveAttribute(
      "aria-label",
      `Edge from document:${created[0].id} to document:${child.id}`,
    );
    await request.delete(`/api/documents/${child.id}`, {
      data: { expectedRevision: child.revision },
    });
    await expect(page.locator(".flow-document-node")).toHaveCount(3);
    await request.post("/api/documents", {
      data: {
        projectId: project.id,
        parentId: created[1].id,
        phase: "implementation",
        title: "New nested document",
        templateName: "view",
      },
    });
    await expect(page.locator(".flow-document-node")).toHaveCount(4);
    await page.screenshot({ path: "test-results/document-subtrees.png" });
  } finally {
    await request.delete(`/api/projects/${project.id}`, { data: {} });
  }
});
