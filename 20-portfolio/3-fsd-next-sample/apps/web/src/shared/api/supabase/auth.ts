import "server-only";

import type { User } from "@supabase/supabase-js";
import { z } from "zod";

export const anonymousSignInSchema = z
  .object({
    captchaToken: z.string().trim().min(1).max(8_192).optional(),
  })
  .strict();

const emailSchema = z.email().trim().max(320);
const passwordSchema = z.string().min(8).max(1_024);
const safeNextPathSchema = z
  .string()
  .trim()
  .max(1_024)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//"),
    "The next path must be an application-relative path.",
  )
  .optional();

export const emailAuthSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("sign-in"),
      email: emailSchema,
      password: passwordSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("sign-up"),
      email: emailSchema,
      password: passwordSchema,
      captchaToken: z.string().trim().min(1).max(8_192).optional(),
      next: safeNextPathSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("link-email"),
      email: emailSchema,
      next: safeNextPathSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("set-password"),
      password: passwordSchema,
      nonce: z.string().trim().min(1).max(2_048).optional(),
    })
    .strict(),
]);

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
    isAnonymous: user.is_anonymous === true,
    createdAt: user.created_at,
  };
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export function authCallbackUrl(request: Request, next?: string) {
  const url = new URL("/api/auth/callback", request.url);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}
