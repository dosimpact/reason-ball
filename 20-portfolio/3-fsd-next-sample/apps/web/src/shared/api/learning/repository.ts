import type { LearningRepository } from "./contracts";
import { httpLearningRepository } from "./http-repository";
import { mockLearningRepository } from "./mock-repository";

export function getLearningRepository(): LearningRepository {
  if (process.env.NEXT_PUBLIC_APP_RUNTIME_MODE === "mock") {
    return mockLearningRepository;
  }
  const provider = process.env.NEXT_PUBLIC_DATA_PROVIDER;
  if (provider === "supabase") {
    return httpLearningRepository;
  }
  if (provider === "mock" || process.env.NODE_ENV !== "production") {
    return mockLearningRepository;
  }
  throw new Error(
    "NEXT_PUBLIC_DATA_PROVIDER must be set to 'supabase' in production.",
  );
}
