import { BadRequestException } from '@nestjs/common';

import type { DartEndpoint } from '../lib/dart/dart.client';

const LIST_KEYS = ['corp_code', 'bgn_de', 'end_de', 'last_reprt_at', 'pblntf_ty', 'pblntf_detail_ty', 'corp_cls', 'sort', 'sort_mth', 'page_no', 'page_count'];
const allowed: Record<DartEndpoint, string[]> = {
  'corpCode.xml': [], 'list.json': LIST_KEYS, 'document.xml': ['rcept_no'],
  'company.json': ['corp_code'], 'fnlttSinglAcntAll.json': ['corp_code', 'bsns_year', 'reprt_code', 'fs_div'],
};
const required: Record<DartEndpoint, string[]> = {
  'corpCode.xml': [], 'list.json': [], 'document.xml': ['rcept_no'],
  'company.json': ['corp_code'], 'fnlttSinglAcntAll.json': ['corp_code', 'bsns_year', 'reprt_code', 'fs_div'],
};
const patterns: Record<string, RegExp> = {
  corp_code: /^\d{8}$/, rcept_no: /^\d{14}$/, bsns_year: /^(19|20)\d{2}$/,
  reprt_code: /^(11011|11012|11013|11014)$/, fs_div: /^(CFS|OFS)$/,
  last_reprt_at: /^[YN]$/, pblntf_ty: /^[A-J]$/, pblntf_detail_ty: /^[A-J]\d{3}$/,
  corp_cls: /^[YKNE]$/, sort: /^(date|crp|rpt)$/, sort_mth: /^(asc|desc)$/,
};

export function validateDartQuery(endpoint: DartEndpoint, query: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!allowed[endpoint].includes(key)) throw new BadRequestException(`Unsupported DART parameter: ${key}`);
    if (typeof value !== 'string' || value.length > 100) throw new BadRequestException(`Invalid DART parameter: ${key}`);
    if (value === '') { if (required[endpoint].includes(key)) throw new BadRequestException(`Required DART parameter: ${key}`); continue; }
    if (patterns[key] && !patterns[key].test(value)) throw new BadRequestException(`Invalid DART parameter: ${key}`);
    if (key === 'bgn_de' || key === 'end_de') {
      const iso = /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : '';
      const time = Date.parse(iso);
      if (!iso || !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== iso) throw new BadRequestException(`Invalid DART date: ${key}`);
    }
    if (key === 'page_no' || key === 'page_count') {
      const max = key === 'page_count' ? 100 : 99999;
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new BadRequestException(`Invalid DART pagination: ${key}`);
    }
    result[key] = value;
  }
  for (const key of required[endpoint]) if (!result[key]) throw new BadRequestException(`Required DART parameter: ${key}`);
  if (result.bgn_de && result.end_de && result.bgn_de > result.end_de) throw new BadRequestException('DART bgn_de must not be after end_de.');
  return result;
}
