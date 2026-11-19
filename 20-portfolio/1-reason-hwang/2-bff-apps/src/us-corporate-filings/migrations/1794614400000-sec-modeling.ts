import { MigrationInterface, QueryRunner } from 'typeorm';

export class SecModeling1794614400000 implements MigrationInterface {
  name = 'SecModeling1794614400000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE SCHEMA IF NOT EXISTS sec_modeling;
      CREATE TABLE sec_modeling.jobs (
        id uuid PRIMARY KEY, cik varchar(10) NOT NULL, accession_no varchar(32) NOT NULL,
        stage smallint NOT NULL CHECK (stage BETWEEN 1 AND 3), latest_run_id uuid,
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(cik, accession_no, stage),
        FOREIGN KEY(cik, accession_no) REFERENCES public.filings(cik, accession_no));
      CREATE TABLE sec_modeling.runs (
        id uuid PRIMARY KEY, job_id uuid NOT NULL REFERENCES sec_modeling.jobs(id),
        status text NOT NULL CHECK(status IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
        config jsonb NOT NULL, source_hash text, input_generation_id text, output_generation_id text,
        execution_token uuid, lease_until timestamptz, cancel_requested boolean NOT NULL DEFAULT false,
        error jsonb, counts jsonb, retry_of uuid REFERENCES sec_modeling.runs(id),
        created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz);
      ALTER TABLE sec_modeling.jobs ADD CONSTRAINT jobs_latest_run_fk FOREIGN KEY(latest_run_id) REFERENCES sec_modeling.runs(id);
      CREATE UNIQUE INDEX runs_one_active_job ON sec_modeling.runs(job_id) WHERE status IN ('QUEUED','RUNNING');
      CREATE INDEX runs_queue ON sec_modeling.runs(created_at) WHERE status='QUEUED';
      CREATE INDEX runs_lease ON sec_modeling.runs(lease_until) WHERE status='RUNNING';
      CREATE INDEX runs_job_history ON sec_modeling.runs(job_id,created_at DESC);
      CREATE TABLE sec_modeling.work_units (
        run_id uuid NOT NULL REFERENCES sec_modeling.runs(id), id text NOT NULL,
        status text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(run_id,id));
      CREATE TABLE sec_modeling.events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, run_id uuid NOT NULL REFERENCES sec_modeling.runs(id),
        type text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX events_run_cursor ON sec_modeling.events(run_id,id);`);
  }
  async down(): Promise<void> {
    throw new Error('SEC modeling history must be preserved; rollback requires an explicit backup and migration.');
  }
}
