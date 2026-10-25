import { notFound } from "next/navigation";
import { LibStory } from "./lib-story";

export default async function LibStoryPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { theme } = await searchParams;
  return <LibStory theme={theme === "dark" ? "dark" : "light"} />;
}
