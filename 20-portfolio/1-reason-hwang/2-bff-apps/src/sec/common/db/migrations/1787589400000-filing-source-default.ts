import { MigrationInterface, QueryRunner } from 'typeorm';

export class FilingSourceDefault1787589400000 implements MigrationInterface {
  name = 'FilingSourceDefault1787589400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE filings ALTER COLUMN source_kind SET DEFAULT 'submissions-api'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE filings ALTER COLUMN source_kind SET DEFAULT 'submissions-bulk'",
    );
  }
}
