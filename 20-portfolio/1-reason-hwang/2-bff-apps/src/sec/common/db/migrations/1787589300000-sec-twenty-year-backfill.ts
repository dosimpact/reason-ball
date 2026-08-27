import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecTwentyYearBackfill1787589300000 implements MigrationInterface {
  name = 'SecTwentyYearBackfill1787589300000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE filings
        ADD COLUMN IF NOT EXISTS primary_doc_description text,
        ADD COLUMN IF NOT EXISTS full_submission_url text,
        ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
        ADD COLUMN IF NOT EXISTS items text,
        ADD COLUMN IF NOT EXISTS file_number varchar(64),
        ADD COLUMN IF NOT EXISTS film_number varchar(64),
        ADD COLUMN IF NOT EXISTS file_size bigint,
        ADD COLUMN IF NOT EXISTS is_xbrl boolean,
        ADD COLUMN IF NOT EXISTS is_inline_xbrl boolean,
        ADD COLUMN IF NOT EXISTS source_kind varchar(32) NOT NULL DEFAULT 'submissions-api',
        ADD COLUMN IF NOT EXISTS document_content text,
        ADD COLUMN IF NOT EXISTS document_content_type varchar(128),
        ADD COLUMN IF NOT EXISTS document_downloaded_at timestamptz
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sec_backfill_runs (
        run_id uuid PRIMARY KEY,
        status varchar(24) NOT NULL,
        requested_at timestamptz NOT NULL DEFAULT now(),
        started_at timestamptz,
        completed_at timestamptz,
        heartbeat_at timestamptz,
        cutoff_date date NOT NULL,
        target_forms text[] NOT NULL,
        archive_url text NOT NULL,
        archive_path text,
        archive_bytes bigint NOT NULL DEFAULT 0,
        processed_entries bigint NOT NULL DEFAULT 0,
        companies_upserted bigint NOT NULL DEFAULT 0,
        filings_seen bigint NOT NULL DEFAULT 0,
        filings_upserted bigint NOT NULL DEFAULT 0,
        last_entry text,
        error_message text,
        CONSTRAINT sec_backfill_runs_status_check
          CHECK (status IN ('queued', 'downloading', 'running', 'completed', 'failed'))
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_sec_backfill_one_active_run
      ON sec_backfill_runs ((1))
      WHERE status IN ('queued', 'downloading', 'running')
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_sec_backfill_runs_requested_at ON sec_backfill_runs (requested_at DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_form_filing_date ON filings (form_type, filing_date DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS idx_filings_document_pending ON filings (filing_date DESC) WHERE document_content IS NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_filings_document_pending');
    await queryRunner.query('DROP INDEX IF EXISTS idx_filings_form_filing_date');
    await queryRunner.query('DROP INDEX IF EXISTS idx_sec_backfill_runs_requested_at');
    await queryRunner.query('DROP INDEX IF EXISTS uq_sec_backfill_one_active_run');
    await queryRunner.query('DROP TABLE IF EXISTS sec_backfill_runs');
    await queryRunner.query(`
      ALTER TABLE filings
        DROP COLUMN IF EXISTS document_downloaded_at,
        DROP COLUMN IF EXISTS document_content_type,
        DROP COLUMN IF EXISTS document_content,
        DROP COLUMN IF EXISTS source_kind,
        DROP COLUMN IF EXISTS is_inline_xbrl,
        DROP COLUMN IF EXISTS is_xbrl,
        DROP COLUMN IF EXISTS file_size,
        DROP COLUMN IF EXISTS film_number,
        DROP COLUMN IF EXISTS file_number,
        DROP COLUMN IF EXISTS items,
        DROP COLUMN IF EXISTS accepted_at,
        DROP COLUMN IF EXISTS full_submission_url,
        DROP COLUMN IF EXISTS primary_doc_description
    `);
  }
}
