import { MigrationInterface, QueryRunner } from 'typeorm';

export class FilingDatabaseContent1790000000000 implements MigrationInterface {
  name = 'FilingDatabaseContent1790000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE filings ADD COLUMN document_size_bytes bigint');
    // Keep legacy paths/files intact. Missing bodies become eligible for download again.
    await queryRunner.query(`UPDATE filings SET status = 'pending'
      WHERE status = 'downloaded' AND document_content IS NULL`);
    await queryRunner.query(`UPDATE filings SET
      document_size_bytes = octet_length(document_content),
      checksum = encode(sha256(convert_to(document_content, 'UTF8')), 'hex'),
      document_downloaded_at = coalesce(document_downloaded_at, updated_at)
      WHERE document_content IS NOT NULL`);
    await queryRunner.query(`ALTER TABLE filings ADD CONSTRAINT filings_downloaded_content_check
      CHECK (status <> 'downloaded' OR (
        document_content IS NOT NULL AND octet_length(document_content) > 0
        AND document_downloaded_at IS NOT NULL
        AND document_size_bytes IS NOT NULL
        AND document_size_bytes = octet_length(document_content)
        AND checksum IS NOT NULL AND checksum ~ '^[0-9a-f]{64}$'
      ))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE filings DROP CONSTRAINT filings_downloaded_content_check');
    await queryRunner.query('ALTER TABLE filings DROP COLUMN document_size_bytes');
    // Preserve document_content and original files on rollback.
  }
}
