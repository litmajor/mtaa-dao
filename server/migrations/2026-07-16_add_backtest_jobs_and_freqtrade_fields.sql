-- Migration: add backtest_jobs table and freqtrade metadata fields to strategies

BEGIN;

ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS freqtrade_code text,
  ADD COLUMN IF NOT EXISTS freqtrade_name varchar(256);

CREATE TABLE IF NOT EXISTS backtest_jobs (
  id varchar(128) PRIMARY KEY,
  strategy_id varchar(128) NOT NULL,
  kind varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  metrics jsonb,
  best_parameters jsonb,
  error text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  duration_ms integer
);

ALTER TABLE backtest_jobs
  ADD CONSTRAINT fk_backtest_jobs_strategy FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE;

COMMIT;
