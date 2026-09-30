/** Pure display policy; rendering text must never implicitly fetch private or remote assets. */
export function safeMarkdownUrl(value: string): string | undefined {
  if (!value || /[\u0000-\u0020\u007f\\]/.test(value)) return undefined;
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value)) return value;
  if (value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//"))) return value;
  return undefined;
}
