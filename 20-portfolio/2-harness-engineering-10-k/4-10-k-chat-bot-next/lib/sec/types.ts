export type CompanyRecord = {
  cik: string;
  ticker: string | null;
  name: string;
  sic: number | null;
};

export type FilingRecord = {
  accessionNo: string;
  cik: string;
  formType: string;
  filingDate: string | null;
  reportDate: string | null;
  primaryDoc: string | null;
  filingUrl: string;
  status: string;
  filePath: string | null;
  parserStatus: string;
  errorMessage: string | null;
  retryCount: number;
  updatedAt: string | null;
  companyName: string;
  ticker: string | null;
};

export type FilingListResult = {
  company: CompanyRecord;
  filings: FilingRecord[];
  nextCursor: number;
  hasMore: boolean;
};

export type ItemSection = {
  itemCode: string;
  title: string;
  content: string;
  start: number;
  end: number;
};

export type ReaderTocItem = {
  itemCode: string;
  title: string;
};

export type ReasoningTraceStep = {
  title: string;
  detail: string;
  status: "used" | "missing" | "derived";
};

export type ReasoningTrace = {
  selectedOrder: string[];
  steps: ReasoningTraceStep[];
  toolLog: string[];
  uncertainties: string[];
};

export type FilingSummary = {
  executiveSummary: string;
  keyBullets: string[];
  keyRisks: string[];
  evidence: Array<{ itemCode: string; rationale: string }>;
  oneLiner: string;
};

export type InvestmentDecisionBrief = {
  stance: "positive" | "mixed" | "cautious";
  conclusion: string;
  bull: string[];
  bear: string[];
  unknowns: string[];
  nextChecks: string[];
  evidence: Array<{ itemCode: string; rationale: string }>;
};
