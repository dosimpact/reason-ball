import { SubmissionPayload } from './sec.client';
import * as yauzl from 'yauzl';
import { SEC_CORE_REPORT_FORMS } from './sec.utils';
import { buildArchiveBase } from './sec.utils';

export function openZip(archivePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: true }, (error, zipFile) => {
      if (error || !zipFile) {
        reject(error ?? new Error(`Unable to open ZIP archive: ${archivePath}`));
        return;
      }
      resolve(zipFile);
    });
  });
}

export function readZipEntry(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<string> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error || !stream) {
        reject(error ?? new Error(`Unable to read ZIP entry: ${entry.fileName}`));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });
}

export type CompanyRow = {
  cik: string;
  ticker: string | null;
  name: string;
  sic: number | null;
};

export type FilingRow = {
  accessionNo: string;
  cik: string;
  formType: string;
  filingDate: string;
  reportDate: string | null;
  acceptedAt: string | null;
  primaryDoc: string | null;
  primaryDocDescription: string | null;
  filingUrl: string;
  fullSubmissionUrl: string;
  items: string | null;
  fileNumber: string | null;
  filmNumber: string | null;
  fileSize: number | null;
  isXbrl: boolean | null;
  isInlineXbrl: boolean | null;
};
const targetForms = new Set<string>(SEC_CORE_REPORT_FORMS);

export function parseBulkSubmission(cik: string, payload: SubmissionPayload, cutoffDate: string) {
  const companies: CompanyRow[] = [];
  const filings: FilingRow[] = [];
  if (payload.name) {
    const parsedSic = Number.parseInt(String(payload.sic ?? ''), 10);
    companies.push({
      cik,
      ticker: payload.tickers?.[0]?.trim().toUpperCase() || null,
      name: payload.name.trim(),
      sic: Number.isFinite(parsedSic) ? parsedSic : null,
    });
  }

  const columns = payload.filings?.recent ?? payload;
  const accessionNumbers = columns.accessionNumber ?? [];
  for (let index = 0; index < accessionNumbers.length; index += 1) {
    const formType = stringAt(columns.form, index)?.toUpperCase();
    const filingDate = stringAt(columns.filingDate, index);
    if (!formType || !targetForms.has(formType) || !filingDate || filingDate < cutoffDate) {
      continue;
    }
    const accessionNo = stringAt(accessionNumbers, index);
    if (!accessionNo) {
      continue;
    }
    const primaryDoc = stringAt(columns.primaryDocument, index);
    const archiveBase = buildArchiveBase(cik, accessionNo);
    filings.push({
      accessionNo,
      cik,
      formType,
      filingDate,
      reportDate: stringAt(columns.reportDate, index),
      acceptedAt: normalizeAcceptedAt(stringAt(columns.acceptanceDateTime, index)),
      primaryDoc,
      primaryDocDescription: stringAt(columns.primaryDocDescription, index),
      filingUrl: primaryDoc ? `${archiveBase}/${encodeURIComponent(primaryDoc)}` : `${archiveBase}/${accessionNo}.txt`,
      fullSubmissionUrl: `${archiveBase}/${accessionNo}.txt`,
      items: stringAt(columns.items, index),
      fileNumber: stringAt(columns.fileNumber, index),
      filmNumber: stringAt(columns.filmNumber, index),
      fileSize: numberAt(columns.size, index),
      isXbrl: booleanAt(columns.isXBRL, index),
      isInlineXbrl: booleanAt(columns.isInlineXBRL, index),
    });

  }
  return { companies, filings };
}

function stringAt(values: unknown[] | undefined, index: number): string | null {
  const value = values?.[index];
  if (value === undefined || value === null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function numberAt(values: unknown[] | undefined, index: number): number | null {
  const parsed = Number(values?.[index]);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanAt(values: unknown[] | undefined, index: number): boolean | null {
  const value = values?.[index];
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return value === true || value === 1 || value === '1';
}

function normalizeAcceptedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  if (/^\d{14}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
