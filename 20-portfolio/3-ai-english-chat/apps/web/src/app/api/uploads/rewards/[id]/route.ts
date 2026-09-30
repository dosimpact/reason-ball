import {
  resourceIdSchema,
  uuidSchema,
} from "@/shared/api/supabase/domain";
import {
  assertDatabaseSuccess,
  createPrivilegedClient,
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";

import {
  getMockSession,
  listMockRuns,
  withMockSession,
} from "../../../mission-runs/_lib/mock-store";
import {
  isMockRuntime,
  routeError,
  routeSuccess,
} from "../../../mission-runs/_lib/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = createRequestId();

  try {
    const parsed = resourceIdSchema.safeParse((await context.params).id);
    if (!parsed.success) {
      throw new SupabaseHttpError(
        400,
        "INVALID_MISSION_ID",
        "The reward mission id is invalid.",
      );
    }

    if (isMockRuntime()) {
      const { session, sessionId } = getMockSession(request);
      const passedRun = listMockRuns(session).find(
        (run) => run.missionId === parsed.data && run.status === "passed",
      );
      if (!passedRun) {
        return withMockSession(
          routeError(
            404,
            "REWARD_NOT_UNLOCKED",
            "No unlocked reward is available for this mission.",
            requestId,
          ),
          sessionId,
        );
      }

      const mockSvg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">',
        '<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#342a70"/><stop offset="1" stop-color="#fa8c73"/></linearGradient></defs>',
        '<rect width="1200" height="800" fill="url(#sky)"/>',
        '<circle cx="910" cy="180" r="88" fill="#fff" opacity=".78"/>',
        '<path d="M0 650L180 470l120 96 150-210 170 190 170-120 210 224z" fill="#17152f" opacity=".82"/>',
        '<text x="70" y="110" fill="#fff" font-family="sans-serif" font-size="42" font-weight="700">Unlocked English memory</text>',
        "</svg>",
      ].join("");
      const mockUrl = `data:image/svg+xml;base64,${Buffer.from(mockSvg).toString("base64")}`;

      return withMockSession(
        routeSuccess(
          {
            reward: {
              unlockId: `mock-unlock-${passedRun.id}`,
              missionId: parsed.data,
              assetId: `mock-reward-${parsed.data}`,
              url: mockUrl,
              mimeType: "image/svg+xml",
              altText: "Unlocked English mission memory",
              unlockedAt: passedRun.completedAt ?? passedRun.startedAt,
              expiresIn: 300,
            },
          },
          requestId,
        ),
        sessionId,
      );
    }

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const admin = createPrivilegedClient();

    let missionId = parsed.data;
    if (!uuidSchema.safeParse(missionId).success) {
      const missionResult = await admin
        .from("missions")
        .select("id")
        .eq("slug", missionId)
        .limit(1);
      assertDatabaseSuccess(missionResult.error, "missions.resolve_reward");
      missionId = (missionResult.data ?? [])[0]?.id ?? "";
    }

    const unlockResult = await client
      .from("reward_unlocks")
      .select("id, character_asset_id, unlocked_at")
      .eq("user_id", user.id)
      .eq("mission_id", missionId)
      .order("unlocked_at", { ascending: false })
      .limit(1);
    assertDatabaseSuccess(unlockResult.error, "reward_unlocks.signed_asset");
    const unlock = (unlockResult.data ?? [])[0] as
      | { id: string; character_asset_id: string; unlocked_at: string }
      | undefined;
    if (!unlock) {
      throw new SupabaseHttpError(
        404,
        "REWARD_NOT_UNLOCKED",
        "No unlocked reward is available for this mission.",
      );
    }

    const assetResult = await admin
      .from("character_assets")
      .select("id, storage_bucket, storage_path, mime_type, alt_text")
      .eq("id", unlock.character_asset_id)
      .eq("access_level", "reward")
      .limit(1);
    assertDatabaseSuccess(assetResult.error, "character_assets.signed_reward");
    const asset = (assetResult.data ?? [])[0] as
      | {
          id: string;
          storage_bucket: string;
          storage_path: string;
          mime_type: string;
          alt_text: string;
        }
      | undefined;
    if (!asset) {
      throw new SupabaseHttpError(
        404,
        "REWARD_ASSET_NOT_FOUND",
        "The unlocked reward image is unavailable.",
      );
    }

    const configuredExpiry = Number(process.env.REWARD_SIGNED_URL_TTL_SECONDS);
    const expiresIn = Number.isFinite(configuredExpiry)
      ? Math.min(600, Math.max(60, Math.trunc(configuredExpiry)))
      : 300;
    const signed = await admin.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, expiresIn);
    if (signed.error || !signed.data.signedUrl) {
      throw new SupabaseHttpError(
        502,
        "REWARD_URL_FAILED",
        "The private reward link could not be created.",
        true,
        `storage.sign:${signed.error?.name ?? "missing_url"}`,
      );
    }

    return jsonSuccessResponse(requestId, {
      reward: {
        unlockId: unlock.id,
        missionId,
        assetId: asset.id,
        url: signed.data.signedUrl,
        mimeType: asset.mime_type,
        altText: asset.alt_text,
        unlockedAt: unlock.unlocked_at,
        expiresIn,
      },
    });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
