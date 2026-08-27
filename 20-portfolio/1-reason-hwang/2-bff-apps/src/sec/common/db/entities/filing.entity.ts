import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export type FilingStatus = 'pending' | 'downloaded' | 'failed';

@Entity({ name: 'filings' })
export class Filing {
  // SEC 접수번호(Accession Number). CIK와 함께 복합 PK.
  @PrimaryColumn({ name: 'accession_no', type: 'varchar', length: 32 })
  accessionNo!: string;

  // 제출 회사의 CIK. accessionNo와 함께 복합 PK.
  @PrimaryColumn({ name: 'cik', type: 'varchar', length: 10 })
  cik!: string;

  // 공시 폼 타입(예: 10-K, 10-Q, 20-F, 6-K).
  @Column({ name: 'form_type', type: 'varchar', length: 20 })
  formType!: string;

  // SEC filing date. 원본에 없을 수 있어 null 허용.
  @Column({ name: 'filing_date', type: 'date', nullable: true })
  filingDate!: string | null;

  // 보고 대상 기간 기준일(report date). 없으면 null.
  @Column({ name: 'report_date', type: 'date', nullable: true })
  reportDate!: string | null;

  // 원본 제출 문서 파일명(예: xxx10k.htm). 없을 수 있음.
  @Column({ name: 'primary_doc', type: 'text', nullable: true })
  primaryDoc!: string | null;

  @Column({ name: 'primary_doc_description', type: 'text', nullable: true })
  primaryDocDescription!: string | null;

  // SEC 아카이브 원문 URL.
  @Column({ name: 'filing_url', type: 'text' })
  filingUrl!: string;

  @Column({ name: 'full_submission_url', type: 'text', nullable: true })
  fullSubmissionUrl!: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'items', type: 'text', nullable: true })
  items!: string | null;

  @Column({ name: 'file_number', type: 'varchar', length: 64, nullable: true })
  fileNumber!: string | null;

  @Column({ name: 'film_number', type: 'varchar', length: 64, nullable: true })
  filmNumber!: string | null;

  @Column({ name: 'file_size', type: 'bigint', nullable: true })
  fileSize!: string | null;

  @Column({ name: 'is_xbrl', type: 'boolean', nullable: true })
  isXbrl!: boolean | null;

  @Column({ name: 'is_inline_xbrl', type: 'boolean', nullable: true })
  isInlineXbrl!: boolean | null;

  // 수집/다운로드 파이프라인 상태.
  @Column({ name: 'status', type: 'varchar', length: 16, default: 'pending' })
  status!: FilingStatus;

  // 로컬 저장 파일 경로(DATA_DIR 기준 상대/절대 경로).
  @Column({ name: 'file_path', type: 'text', nullable: true })
  filePath!: string | null;

  // 다운로드 파일 무결성 확인용 SHA-256 해시.
  @Column({ name: 'checksum', type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  // parser/LLM 후처리 상태. 초기값은 빈 문자열.
  @Column({ name: 'parser_status', type: 'varchar', length: 255, default: '' })
  parserStatus!: string;

  // 마지막 처리 실패 원인 메시지.
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  // 재시도 누적 횟수.
  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount!: number;

  @Column({ name: 'source_kind', type: 'varchar', length: 32, default: 'submissions-api' })
  sourceKind!: string;

  @Column({ name: 'document_content', type: 'text', nullable: true, select: false })
  documentContent!: string | null;

  @Column({ name: 'document_content_type', type: 'varchar', length: 128, nullable: true })
  documentContentType!: string | null;

  @Column({ name: 'document_downloaded_at', type: 'timestamptz', nullable: true })
  documentDownloadedAt!: Date | null;

  // 레코드 마지막 갱신 시각. update 시 자동 갱신.
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
