import { BadRequestException } from '@nestjs/common';
import {
  formatCik,
  hasDateFormat,
  hasDateValue,
  tryNormalizeCik,
  tryNormalizeTicker,
} from '../../lib/sec/sec.utils';
import { FilingStatus } from './filing.entity';

type RawBody = Record<string, unknown>;
const VALID_STATUSES: FilingStatus[] = ['pending', 'downloaded', 'failed'];

export function readCompanyPageNumber(raw: unknown, field: string, fallback: number): number {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive safe integer.`);
  }
  return value;
}

export function readBody(rawBody: unknown): RawBody {
  if (rawBody === undefined || rawBody === null) {
    return {};
  }

  if (typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    throw new BadRequestException('Request body must be a JSON object.');
  }

  return rawBody as RawBody;
}

export function readOptionalDate(raw: unknown, fieldName: string): string | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a date string in YYYY-MM-DD format.`);
  }

  const trimmed = value.trim();
  if (!hasDateFormat(trimmed)) {
    throw new BadRequestException(`${fieldName} must match YYYY-MM-DD.`);
  }

  if (!hasDateValue(trimmed)) {
    throw new BadRequestException(`${fieldName} is not a valid date.`);
  }

  return trimmed;
}

export function readOptionalStatus(raw: unknown, fieldName: string): FilingStatus | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase() as FilingStatus;
  if (!VALID_STATUSES.includes(normalized)) {
    throw new BadRequestException(
      `${fieldName} must be one of: ${VALID_STATUSES.join(', ')}.`,
    );
  }

  return normalized;
}

export function readOptionalCik(raw: unknown, fieldName: string): string | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const trimmed = String(value).trim();
  if (!tryNormalizeCik(trimmed)) {
    throw new BadRequestException(`${fieldName} must contain 1 to 10 digits.`);
  }

  return formatCik(trimmed);
}

export function readOptionalTicker(raw: unknown, fieldName: string): string | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const trimmed = String(value).trim().toUpperCase();
  if (!tryNormalizeTicker(trimmed)) {
    throw new BadRequestException(
      `${fieldName} must be 1 to 32 chars and use only A-Z, 0-9, dot(.), hyphen(-).`,
    );
  }

  return trimmed;
}

export function readOptionalText(raw: unknown, _fieldName: string): string | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readOptionalTextAllowEmpty(raw: unknown): string | undefined {
  const value = firstValue(raw);
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

export function readOptionalCikList(raw: unknown, fieldName: string): string[] | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  if (values.length === 0) {
    return undefined;
  }

  const ciks = Array.from(
    new Set(
      values
        .map((item) => readOptionalCik(item, fieldName))
        .filter((item): item is string => Boolean(item)),
    ),
  );

  return ciks.length > 0 ? ciks : undefined;
}

export function readOptionalTickerList(raw: unknown, fieldName: string): string[] | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const values = Array.isArray(raw) ? raw : String(raw).split(',');
  if (values.length === 0) {
    return undefined;
  }

  const tickers = Array.from(
    new Set(
      values
        .map((item) => readOptionalTicker(item, fieldName))
        .filter((item): item is string => Boolean(item)),
    ),
  );

  return tickers.length > 0 ? tickers : undefined;
}

export function readOptionalBoolean(
  raw: unknown,
  fieldName: string,
  fallback: boolean,
): boolean {
  const value = firstValue(raw);
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  throw new BadRequestException(`${fieldName} must be a boolean.`);
}

export function firstValue(raw: unknown): unknown {
  return Array.isArray(raw) ? raw[0] : raw;
}
