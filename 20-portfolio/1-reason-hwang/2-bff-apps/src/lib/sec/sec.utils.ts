import { createHash } from 'node:crypto';

export function documentFromBytes(bytes: Buffer, contentType: string | null) {
  if (!bytes.length) throw new Error('SEC_DOCUMENT_EMPTY');
  const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (content.includes('\u0000')) throw new Error('SEC_DOCUMENT_NUL');
  return {
    documentContent: content,
    documentContentType: (contentType ?? 'application/octet-stream').slice(0, 128),
    documentSizeBytes: String(bytes.length),
    checksum: createHash('sha256').update(bytes).digest('hex'),
  };
}

export function formatCorrelation(options: { correlationId?: string; }): string {
  return options.correlationId ? ` correlationId=${options.correlationId}` : '';
}

export function formatCik(value: string | number): string {
  return String(value).trim().padStart(10, '0');
}

export function tryNormalizeCik(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  return value && /^\d{1,10}$/.test(value) ? formatCik(value) : undefined;
}

export function tryNormalizeTicker(raw: string | undefined): string | undefined {
  const value = raw?.trim().toUpperCase();
  return value && /^[A-Z0-9.-]{1,32}$/.test(value) ? value : undefined;
}

export function hasDateFormat(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function hasDateValue(value: string): boolean {
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function buildArchiveBase(cik: string, accessionNo: string): string {
  return 'https://www.sec.gov/Archives/edgar/data/' + String(Number.parseInt(cik, 10)) + '/' + accessionNo.replaceAll('-', '');
}

export const SEC_CORE_REPORT_FORMS = ['10-K', '10-K/A', '10-Q', '10-Q/A', '8-K', '8-K/A'] as const;
