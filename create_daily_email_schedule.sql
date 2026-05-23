CREATE TABLE IF NOT EXISTS "DailyEmailSchedule" (
  id VARCHAR NOT NULL DEFAULT gen_random_uuid(),
  enabled BOOLEAN NOT NULL DEFAULT false,
  send_time VARCHAR NOT NULL DEFAULT '08:00',
  recipient_ids TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);