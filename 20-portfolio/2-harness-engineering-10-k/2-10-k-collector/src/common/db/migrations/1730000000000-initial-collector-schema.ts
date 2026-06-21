import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialCollectorSchema1730000000000 implements MigrationInterface {
  name = 'InitialCollectorSchema1730000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS companies (
        cik varchar(10) PRIMARY KEY,
        ticker varchar(32),
        name text NOT NULL,
        sic int,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS filings (
        accession_no varchar(32) NOT NULL,
        cik varchar(10) NOT NULL,
        form_type varchar(20) NOT NULL,
        filing_date date,
        report_date date,
        primary_doc text,
        filing_url text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        file_path text,
        checksum varchar(64),
        parser_status varchar(255) NOT NULL DEFAULT '',
        error_message text,
        retry_count int NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT filings_pkey PRIMARY KEY (accession_no, cik)
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'filings_status_check'
        ) THEN
          ALTER TABLE filings
          ADD CONSTRAINT filings_status_check
          CHECK (status IN ('pending', 'downloaded', 'failed'));
        END IF;
      END
      $$;
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies (ticker)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_companies_updated_at ON companies (updated_at DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_status_filing_date_updated_at ON filings (status, filing_date DESC, updated_at DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_cik_filing_date ON filings (cik, filing_date DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_parser_status ON filings (parser_status)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_form_type ON filings (form_type)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_filings_form_type');
    await queryRunner.query('DROP INDEX IF EXISTS idx_filings_parser_status');
    await queryRunner.query('DROP INDEX IF EXISTS idx_filings_cik_filing_date');
    await queryRunner.query(
      'DROP INDEX IF EXISTS idx_filings_status_filing_date_updated_at',
    );
    await queryRunner.query('DROP INDEX IF EXISTS idx_companies_updated_at');
    await queryRunner.query('DROP INDEX IF EXISTS idx_companies_ticker');
    await queryRunner.query('DROP TABLE IF EXISTS filings');
    await queryRunner.query('DROP TABLE IF EXISTS companies');
  }
}
