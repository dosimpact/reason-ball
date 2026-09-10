import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { safeMarkdownUrl } from "../model/markdown-policy";
import styles from "./rich-text.module.css";

// Sanitize user-controlled markup BEFORE generating trusted KaTeX markup.
// Do not add rehype-raw or permit arbitrary style/class attributes here.
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./, "math-inline", "math-display"]],
  },
};
const components: Components = {
  a: ({ href, children }) => href
    ? <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>
    : <span>{children}</span>,
  img: ({ alt }) => <span className={styles.imageNotice}>[이미지: {alt || "외부 이미지"} · 자동 로딩 안 함]</span>,
  pre: ({ children }) => <pre tabIndex={0} aria-label="코드 블록">{children}</pre>,
  table: ({ children }) => <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="메시지 표"><table>{children}</table></div>,
};

export const RichText = memo(function RichText({ text }: { text: string }) {
  return (
    <div className={styles.content} data-testid="rich-text">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[
          [rehypeSanitize, sanitizeSchema],
          [rehypeKatex, { trust: false, strict: "error", maxExpand: 100, maxSize: 10 }],
        ]}
        urlTransform={safeMarkdownUrl}
        components={components}
      >
        {text}
      </Markdown>
    </div>
  );
});
