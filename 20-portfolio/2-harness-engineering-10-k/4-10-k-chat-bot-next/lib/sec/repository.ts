/**
 * SEC data access layer.
 *
 * Reads collector Postgres tables (`companies`, `filings`) and exposes
 * query helpers used by both API routes and AI tools.
 */
import "server-only";

import postgres, { type Sql } from "postgres";
import { ChatSDKError } from "@/lib/errors";
import type { CompanyRecord, FilingListResult, FilingRecord } from "./types";

type CompanyRow = {
  cik: string;
  ticker: string | null;
  name: string;
  sic: number | null;
};

type FilingRow = {
  accessionNo: string;
  cik: string;
  formType: string;
  filingDate: string | Date | null;
  reportDate: string | Date | null;
  primaryDoc: string | null;
  filingUrl: string;
  status: string;
  filePath: string | null;
  parserStatus: string | null;
  errorMessage: string | null;
  retryCount: number;
  updatedAt: string | Date | null;
  companyName: string;
  ticker: string | null;
};

const DEFAULT_FILING_FETCH_LIMIT = 300;

function getCollectorDatabaseUrl() {
  return process.env.COLLECTOR_DATABASE_URL || process.env.POSTGRES_URL;
}

function getCollectorSqlClient(): Sql {
  const databaseUrl = getCollectorDatabaseUrl();

  if (!databaseUrl) {
    throw new ChatSDKError(
      "bad_request:api",
      "COLLECTOR_DATABASE_URL or POSTGRES_URL is required"
    );
  }

  const globalWithCollectorSql = globalThis as typeof globalThis & {
    __collectorSqlClient?: Sql;
  };

  if (!globalWithCollectorSql.__collectorSqlClient) {
    // Reuse one low-concurrency client per server process.
    globalWithCollectorSql.__collectorSqlClient = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      idle_timeout: 5,
      connect_timeout: 10,
    });
  }

  return globalWithCollectorSql.__collectorSqlClient;
}

function normalizeCompanyQuery(companyQuery: string) {
  return companyQuery.trim();
}

function normalizeForms(forms?: string[]) {
  if (!forms || forms.length === 0) {
    return null;
  }

  return forms.map((form) => form.trim().toUpperCase()).filter(Boolean);
}

function toCompanyRecord(row: CompanyRow): CompanyRecord {
  return {
    cik: row.cik,
    ticker: row.ticker,
    name: row.name,
    sic: row.sic,
  };
}

function toFilingRecord(row: FilingRow): FilingRecord {
  const filingDate = normalizeDateValue(row.filingDate);
  const reportDate = normalizeDateValue(row.reportDate);
  const updatedAt = normalizeDateValue(row.updatedAt);

  return {
    accessionNo: row.accessionNo,
    cik: row.cik,
    formType: row.formType,
    filingDate: filingDate || null,
    reportDate: reportDate || null,
    primaryDoc: row.primaryDoc,
    filingUrl: row.filingUrl,
    status: row.status,
    filePath: row.filePath,
    parserStatus: row.parserStatus ?? "",
    errorMessage: row.errorMessage,
    retryCount: row.retryCount,
    updatedAt: updatedAt || null,
    companyName: row.companyName,
    ticker: row.ticker,
  };
}

function getFormPriority(targetPeriod: "annual" | "quarterly" | "auto") {
  if (targetPeriod === "quarterly") {
    return ["10-Q", "10-Q/A", "10-K", "10-K/A", "20-F", "20-F/A"];
  }

  if (targetPeriod === "annual") {
    return ["10-K", "10-K/A", "20-F", "20-F/A", "10-Q", "10-Q/A"];
  }

  return ["10-K", "10-K/A", "10-Q", "10-Q/A", "20-F", "20-F/A"];
}

function normalizeDateValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return "";
    }
    return value.toISOString();
  }

  return String(value);
}

function compareFilingDateDescending(a: FilingRecord, b: FilingRecord) {
  const aDate = normalizeDateValue(a.filingDate || a.reportDate);
  const bDate = normalizeDateValue(b.filingDate || b.reportDate);
  return bDate.localeCompare(aDate);
}

export async function searchCompanies({
  companyQuery,
  limit = 8,
}: {
  companyQuery: string;
  limit?: number;
}): Promise<CompanyRecord[]> {
  const query = normalizeCompanyQuery(companyQuery);

  if (!query) {
    return [];
  }

  const sql = getCollectorSqlClient();

  const rows = await sql<CompanyRow[]>`
    SELECT
      c.cik,
      c.ticker,
      c.name,
      c.sic
    FROM companies c
    WHERE
      UPPER(COALESCE(c.ticker, '')) = UPPER(${query})
      OR c.name ILIKE ${`%${query}%`}
      OR c.ticker ILIKE ${`${query}%`}
      OR c.cik = ${query.replaceAll(/[^0-9]/g, "")}
    ORDER BY
      CASE
        WHEN UPPER(COALESCE(c.ticker, '')) = UPPER(${query}) THEN 0
        WHEN LOWER(c.name) = LOWER(${query}) THEN 1
        WHEN c.name ILIKE ${`${query}.%`} THEN 2
        WHEN c.name ILIKE ${`${query},%`} THEN 2
        WHEN c.name ILIKE ${`${query} %`} THEN 3
        WHEN c.ticker ILIKE ${`${query}%`} THEN 4
        ELSE 5
      END,
      char_length(c.name) ASC,
      c.name ASC
    LIMIT ${Math.max(1, Math.min(limit, 20))}
  `;

  return rows.map(toCompanyRecord);
}

export async function resolveCompany(companyQuery: string) {
  const candidates = await searchCompanies({ companyQuery, limit: 5 });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[0];
}

export async function listCompanyFilings({
  companyQuery,
  forms,
  limit = 10,
  cursor = 0,
}: {
  companyQuery: string;
  forms?: string[];
  limit?: number;
  cursor?: number;
}): Promise<FilingListResult | null> {
  // 1) resolve company; 2) pull recent filings; 3) apply form filter + paging.
  const company = await resolveCompany(companyQuery);

  if (!company) {
    return null;
  }

  const sql = getCollectorSqlClient();

  const rows = await sql<FilingRow[]>`
    SELECT
      f.accession_no AS "accessionNo",
      f.cik,
      f.form_type AS "formType",
      f.filing_date AS "filingDate",
      f.report_date AS "reportDate",
      f.primary_doc AS "primaryDoc",
      f.filing_url AS "filingUrl",
      f.status,
      f.file_path AS "filePath",
      f.parser_status AS "parserStatus",
      f.error_message AS "errorMessage",
      f.retry_count AS "retryCount",
      f.updated_at AS "updatedAt",
      c.name AS "companyName",
      c.ticker
    FROM filings f
    INNER JOIN companies c ON c.cik = f.cik
    WHERE f.cik = ${company.cik}
    ORDER BY f.filing_date DESC NULLS LAST, f.updated_at DESC
    LIMIT ${DEFAULT_FILING_FETCH_LIMIT}
  `;

  const normalizedForms = normalizeForms(forms);

  const filteredRows = normalizedForms
    ? rows.filter((row) => normalizedForms.includes(row.formType.toUpperCase()))
    : rows;

  const normalizedCursor = Math.max(0, cursor);
  const normalizedLimit = Math.max(1, Math.min(limit, 50));

  const pagedRows = filteredRows.slice(
    normalizedCursor,
    normalizedCursor + normalizedLimit
  );

  return {
    company,
    filings: pagedRows.map(toFilingRecord),
    nextCursor: normalizedCursor + pagedRows.length,
    hasMore: normalizedCursor + normalizedLimit < filteredRows.length,
  };
}

export async function getLatestFiling({
  companyQuery,
  targetPeriod,
  preferForm,
}: {
  companyQuery: string;
  targetPeriod: "annual" | "quarterly" | "auto";
  preferForm?: string;
}): Promise<FilingRecord | null> {
  const companyWithFilings = await listCompanyFilings({
    companyQuery,
    limit: 120,
    cursor: 0,
  });

  if (!companyWithFilings || companyWithFilings.filings.length === 0) {
    return null;
  }

  const filings = [...companyWithFilings.filings].sort(
    compareFilingDateDescending
  );

  const priority = getFormPriority(targetPeriod);
  const prefer = preferForm?.trim().toUpperCase();
  const priorityForms = prefer ? [prefer, ...priority] : priority;

  for (const formType of priorityForms) {
    const selected = filings.find(
      (filing) => filing.formType.toUpperCase() === formType
    );

    if (selected) {
      return selected;
    }
  }

  return filings[0] ?? null;
}

export async function getFilingByIdentity({
  cik,
  accessionNo,
}: {
  cik: string;
  accessionNo: string;
}): Promise<FilingRecord | null> {
  const sql = getCollectorSqlClient();

  const rows = await sql<FilingRow[]>`
    SELECT
      f.accession_no AS "accessionNo",
      f.cik,
      f.form_type AS "formType",
      f.filing_date AS "filingDate",
      f.report_date AS "reportDate",
      f.primary_doc AS "primaryDoc",
      f.filing_url AS "filingUrl",
      f.status,
      f.file_path AS "filePath",
      f.parser_status AS "parserStatus",
      f.error_message AS "errorMessage",
      f.retry_count AS "retryCount",
      f.updated_at AS "updatedAt",
      c.name AS "companyName",
      c.ticker
    FROM filings f
    INNER JOIN companies c ON c.cik = f.cik
    WHERE f.cik = ${cik} AND f.accession_no = ${accessionNo}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return null;
  }

  return toFilingRecord(rows[0]);
}
