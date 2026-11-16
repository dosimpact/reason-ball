import { Gallery } from "./gallery/gallery";
import { GenerativeDemo } from "./Demo";
import { LibStory } from "./catalog/lib-story";
export function DynamicPage() { return <GenerativeDemo mode="dynamic" />; }
export function FixedPage() { return <GenerativeDemo mode="fixed" />; }
export async function CatalogPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  return <LibStory theme={theme === "dark" ? "dark" : "light"} />;
}

export async function GalleryPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme } = await searchParams;
  return <Gallery theme={theme === "dark" ? "dark" : "light"} />;
}
