import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LearningSnapshot } from "@/shared/api/learning/contracts";

import {
  historyFromConversation,
  resolveResource,
  type ConversationRow,
  type MessageRow,
} from "./domain";
import { assertDatabaseSuccess } from "./http";

type ProfileProgressRow = {
  experience_points: number;
  current_streak: number;
};

type CharacterFavoriteRow = {
  character_id: string;
};

type CompletedMissionRow = {
  mission_id: string;
};

type RewardUnlockRow = {
  mission_id: string;
};

type DailyLearningRow = {
  active_minutes: number;
};

function unique(values: string[]) {
  return [...new Set(values)];
}

function startOfTrailingWeek() {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}

// Keep Data API requests bounded without treating its configured row cap as EOF.
async function collectHistoryPages<T>(
  page: (offset: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
  identity: (row: T) => string,
  operation: string,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (;;) {
    const result = await page(rows.length);
    assertDatabaseSuccess(result.error, operation);
    const batch = result.data ?? [];
    if (batch.length === 0) return rows;
    for (const row of batch) {
      const key = identity(row);
      if (seen.has(key)) throw new Error(`${operation}: repeated history page`);
      seen.add(key);
      rows.push(row);
    }
  }
}

async function allHistoryConversations(client: SupabaseClient, userId: string) {
  const rows = await collectHistoryPages<ConversationRow>(
    (offset) => client.from("conversations")
      .select("id, character_id, mission_id, title, metadata, last_message_at, created_at")
      .eq("owner_id", userId).neq("status", "deleted")
      .order("id", { ascending: true }).range(offset, offset + 199),
    (row) => row.id,
    "conversations.history",
  );
  // Retrieval order is immutable; presentation follows the latest activity.
  return rows.sort((left, right) =>
    (right.last_message_at ?? right.created_at).localeCompare(left.last_message_at ?? left.created_at)
    || left.id.localeCompare(right.id));
}

export async function getLearningSnapshot(
  client: SupabaseClient,
  userId: string,
): Promise<LearningSnapshot> {
  const [
    profileResult,
    favoritesResult,
    completedResult,
    unlocksResult,
    conversations,
    dailyResult,
  ] = await Promise.all([
    client
      .from("profiles")
      .select("experience_points, current_streak")
      .eq("id", userId)
      .limit(1),
    client
      .from("character_favorites")
      .select("character_id")
      .eq("user_id", userId),
    client
      .from("mission_runs")
      .select("mission_id")
      .eq("owner_id", userId)
      .eq("status", "passed"),
    client
      .from("reward_unlocks")
      .select("mission_id")
      .eq("user_id", userId),
    allHistoryConversations(client, userId),
    client
      .from("daily_learning_stats")
      .select("active_minutes")
      .eq("user_id", userId)
      .gte("learning_date", startOfTrailingWeek()),
  ]);

  assertDatabaseSuccess(profileResult.error, "profiles.learning_progress");
  assertDatabaseSuccess(favoritesResult.error, "character_favorites.select");
  assertDatabaseSuccess(completedResult.error, "mission_runs.completed");
  assertDatabaseSuccess(unlocksResult.error, "reward_unlocks.select");
  assertDatabaseSuccess(dailyResult.error, "daily_learning_stats.select");

  const profiles = (profileResult.data ?? []) as ProfileProgressRow[];
  const favorites = (favoritesResult.data ?? []) as CharacterFavoriteRow[];
  const completed = (completedResult.data ?? []) as CompletedMissionRow[];
  const unlocks = (unlocksResult.data ?? []) as RewardUnlockRow[];
  const daily = (dailyResult.data ?? []) as DailyLearningRow[];
  const conversationIds = conversations.map((conversation) => conversation.id);

  const messages: MessageRow[] = [];
  for (let index = 0; index < conversationIds.length; index += 50) {
    const ids = conversationIds.slice(index, index + 50);
    messages.push(...await collectHistoryPages<MessageRow>(
      (offset) => client.from("messages")
        .select("conversation_id, plain_text, sequence_number")
        .in("conversation_id", ids).neq("role", "system")
        .order("conversation_id", { ascending: true })
        .order("sequence_number", { ascending: false })
        .range(offset, offset + 199),
      (row) => `${row.conversation_id}:${row.sequence_number}`,
      "messages.history_preview",
    ));
  }

  const latestMessageByConversation = new Map<string, MessageRow>();
  const messageCountByConversation = new Map<string, number>();
  for (const message of messages) {
    latestMessageByConversation.set(
      message.conversation_id,
      latestMessageByConversation.get(message.conversation_id) ?? message,
    );
    messageCountByConversation.set(
      message.conversation_id,
      (messageCountByConversation.get(message.conversation_id) ?? 0) + 1,
    );
  }

  const profile = profiles[0];
  return {
    favoriteCharacterIds: unique(
      favorites.map((favorite) => favorite.character_id),
    ),
    completedMissionIds: unique(completed.map((run) => run.mission_id)),
    // The UI unlocks a mission reward card by mission id. The database still
    // retains the exact mission_reward_id and character_asset_id associations.
    unlockedRewardIds: unique(unlocks.map((unlock) => unlock.mission_id)),
    histories: conversations.map((conversation) =>
      historyFromConversation(
        conversation,
        latestMessageByConversation.get(conversation.id),
        messageCountByConversation.get(conversation.id) ?? 0,
      ),
    ),
    streak: profile?.current_streak ?? 0,
    xp: profile?.experience_points ?? 0,
    weeklyMinutes: daily.reduce(
      (total, day) => total + day.active_minutes,
      0,
    ),
  };
}

export async function toggleCharacterFavorite(
  client: SupabaseClient,
  userId: string,
  characterIdentifier: string,
) {
  const character = await resolveResource(
    client,
    "characters",
    characterIdentifier,
  );
  const existingResult = await client
    .from("character_favorites")
    .select("character_id")
    .eq("user_id", userId)
    .eq("character_id", character.id)
    .limit(1);
  assertDatabaseSuccess(existingResult.error, "character_favorites.find");

  if ((existingResult.data ?? []).length > 0) {
    const deleteResult = await client
      .from("character_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("character_id", character.id);
    assertDatabaseSuccess(deleteResult.error, "character_favorites.delete");
  } else {
    const insertResult = await client.from("character_favorites").insert({
      user_id: userId,
      character_id: character.id,
    });

    if (insertResult.error?.code !== "23505") {
      assertDatabaseSuccess(insertResult.error, "character_favorites.insert");
    }
  }

  const listResult = await client
    .from("character_favorites")
    .select("character_id")
    .eq("user_id", userId);
  assertDatabaseSuccess(listResult.error, "character_favorites.select_after_toggle");

  return unique(
    ((listResult.data ?? []) as CharacterFavoriteRow[]).map(
      (favorite) => favorite.character_id,
    ),
  );
}
