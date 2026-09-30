/** Copy on both HTTPS and remote HTTP, reporting failure instead of false success. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; }
    catch { /* Fall through to the user-initiated legacy copy command. */ }
  }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange()) : [];
  const input = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : undefined;
  const start = input?.selectionStart;
  const end = input?.selectionEnd;
  const direction = input?.selectionDirection;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-10000px;top:0;";
  document.body.append(field);
  try {
    field.focus();
    field.select();
    if (!document.execCommand("copy")) throw new Error("복사하지 못했어요. 텍스트를 선택해 직접 복사해 주세요.");
  } finally {
    field.remove();
    active?.focus({ preventScroll: true });
    if (input && start != null && end != null) input.setSelectionRange(start, end, direction ?? undefined);
    else if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) if (range.commonAncestorContainer.isConnected) selection.addRange(range);
    }
  }
}
