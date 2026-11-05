-- Throttle signed background-worker dispatch; game authority stays in the fenced room lease.
ALTER TABLE breakthrough_rooms ADD COLUMN IF NOT EXISTS worker_wake_at timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z';
