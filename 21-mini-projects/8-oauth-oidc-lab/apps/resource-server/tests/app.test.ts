import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AccessPrincipal } from "../src/auth.js";

const principal: AccessPrincipal = {
  subject: "user-123",
  username: "learner",
  scopes: ["openid", "resource.read"],
  roles: ["lab-user"],
  claims: {},
};

describe("resource authorization", () => {
  it("returns 401 when authentication is missing", async () => {
    const app = createApp({ verifyAccessToken: () => Promise.resolve(principal), logger: false });
    const response = await app.inject({ method: "GET", url: "/api/profile" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "invalid_token" });
    await app.close();
  });

  it("returns 200 for a valid user scope", async () => {
    const app = createApp({ verifyAccessToken: () => Promise.resolve(principal), logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/profile",
      headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ username: "learner" });
    await app.close();
  });

  it("returns 403 when an authenticated user lacks the admin role", async () => {
    const app = createApp({ verifyAccessToken: () => Promise.resolve(principal), logger: false });
    const response = await app.inject({
      method: "GET",
      url: "/api/admin",
      headers: { authorization: "Bearer valid" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "insufficient_scope" });
    await app.close();
  });
});
