import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const test = base.extend({
  page: async ({ page }, runFixture) => {
    const createdUsers = new Set<string>();
    const captures: Promise<void>[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname !== "/api/auth/anonymous" || !response.ok()) return;
      captures.push(response.json().then((body) => {
        // Only clean up accounts created by this isolated browser context.
        if (body.created === true && body.user?.isAnonymous === true) createdUsers.add(body.user.id);
      }));
    });
    try {
      await runFixture(page);
    } finally {
      await Promise.all(captures);
      if (createdUsers.size) {
        await page.context().request.post("/api/auth/logout");
        const admin = adminClient();
        for (const id of createdUsers) {
          // Remove owned conversations first: message authors cannot be NULL,
          // while auth.users deletion would otherwise SET NULL before cascading.
          const conversations = await admin.from("conversations").delete().eq("owner_id", id);
          expect(conversations.error, "Remove this test guest's conversations").toBeNull();
          const { error } = await admin.auth.admin.deleteUser(id);
          expect(error, "Delete only this test's temporary guest").toBeNull();
        }
      }
    }
  },
});

export { expect };
