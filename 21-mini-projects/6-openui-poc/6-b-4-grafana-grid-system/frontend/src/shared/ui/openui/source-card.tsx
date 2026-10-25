import { defineComponent } from "@openuidev/react-lang";
import { Card, CardSourceProvider, ListedSourceItem, getFaviconUrl, type CardSource } from "@openuidev/react-ui";
import type { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";

// Preserve citation order/indices: distinct claims may cite the same page URL.
export function withRepeatedSourceSupport(definition: (typeof openuiChatLibrary.components)[string]) {
  const Original = definition.component;
  return defineComponent({
    ...definition,
    component: (context) => {
      const sources = context.props.sources as CardSource[] | undefined;
      const urls = sources?.flatMap(source => source.url ? [source.url] : []) ?? [];
      if (new Set(urls).size === urls.length) return <Original {...context} />;
      return (
        <CardSourceProvider sources={sources}>
          <Card width="full" style={{ display: "flex", flexDirection: "column", gap: "var(--openui-space-m)" }}>
            {context.renderNode(context.props.children)}
            <div aria-label="출처" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {sources?.map((source, index) => (
                <div key={index} style={{ minWidth: 180 }}>
                  <ListedSourceItem {...source} sourceId={index} faviconUrl={getFaviconUrl(source.url)} />
                </div>
              ))}
            </div>
          </Card>
        </CardSourceProvider>
      );
    },
  });
}
