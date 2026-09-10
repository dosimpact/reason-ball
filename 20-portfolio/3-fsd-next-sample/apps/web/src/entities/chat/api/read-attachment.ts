/** Browser effect, deliberately separate from attachment validation policy. */
export function readAttachmentDataUrl(file: Blob, signal: AbortSignal, createReader: () => FileReader = () => new FileReader()): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('File read cancelled', 'AbortError')); return; }
    const reader = createReader();
    let settled = false;
    function finish(value: string | Error) {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      reader.onload = null; reader.onerror = null; reader.onabort = null;
      if (typeof value === 'string') resolve(value); else reject(value);
    }
    function abort() {
      try { reader.abort(); }
      finally { finish(new DOMException('File read cancelled', 'AbortError')); }
    }
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:')) finish(new Error('Invalid file read result'));
      else finish(reader.result);
    };
    reader.onerror = () => finish(reader.error ?? new Error('File read failed'));
    reader.onabort = () => finish(new DOMException('File read cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    try { reader.readAsDataURL(file); }
    catch (error) { finish(error instanceof Error ? error : new Error('File read failed')); }
  });
}
