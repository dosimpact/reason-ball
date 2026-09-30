import { resourceIdSchema } from "@/shared/api/supabase/domain";
import {
  createRequestClient,
  createRequestId,
  jsonSuccessResponse,
  requireAuthenticatedUser,
  safeSupabaseErrorResponse,
  SupabaseHttpError,
} from "@/shared/api/supabase/http";
import { toggleCharacterFavorite } from "@/shared/api/supabase/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FavoriteRouteContext = {
  params: Promise<{ characterId: string }>;
};

export async function POST(_request: Request, context: FavoriteRouteContext) {
  const requestId = createRequestId();

  try {
    const parsedId = resourceIdSchema.safeParse(
      (await context.params).characterId,
    );
    if (!parsedId.success) {
      throw new SupabaseHttpError(
        400,
        "INVALID_CHARACTER_ID",
        "The character id is invalid.",
      );
    }

    const client = await createRequestClient();
    const user = await requireAuthenticatedUser(client);
    const favoriteCharacterIds = await toggleCharacterFavorite(
      client,
      user.id,
      parsedId.data,
    );
    return jsonSuccessResponse(requestId, { favoriteCharacterIds });
  } catch (error) {
    return safeSupabaseErrorResponse(error, requestId);
  }
}
