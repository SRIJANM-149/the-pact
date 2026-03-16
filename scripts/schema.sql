-- THE PACT v6 — Points System Schema
-- Paste into Supabase SQL Editor → Run

CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT      NOT NULL UNIQUE,
  password     TEXT      NOT NULL,
  display_name TEXT      NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pacts (
  id            BIGSERIAL PRIMARY KEY,
  invite_code   TEXT      NOT NULL UNIQUE,
  creator_id    BIGINT    NOT NULL REFERENCES users(id),
  joiner_id     BIGINT    REFERENCES users(id),
  status        TEXT      NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','dissolved')),
  points_per_rule INTEGER NOT NULL DEFAULT 10,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pact_members (
  id             BIGSERIAL PRIMARY KEY,
  pact_id        BIGINT NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  role           TEXT   NOT NULL CHECK (role IN ('creator','joiner')),
  nickname_given TEXT   NOT NULL DEFAULT '',
  UNIQUE (pact_id, user_id)
);

CREATE TABLE IF NOT EXISTS rules (
  id       BIGSERIAL PRIMARY KEY,
  pact_id  BIGINT  NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text     TEXT    NOT NULL,
  UNIQUE (pact_id, position)
);

CREATE TABLE IF NOT EXISTS daily_records (
  id           BIGSERIAL PRIMARY KEY,
  pact_id      BIGINT  NOT NULL REFERENCES pacts(id) ON DELETE CASCADE,
  user_id      BIGINT  NOT NULL REFERENCES users(id),
  date_key     DATE    NOT NULL,
  checked      JSONB   NOT NULL DEFAULT '[]',
  points_earned INTEGER NOT NULL DEFAULT 0,
  perfect_day  BOOLEAN NOT NULL DEFAULT FALSE,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pact_id, user_id, date_key)
);

CREATE INDEX IF NOT EXISTS idx_pacts_invite     ON pacts(invite_code);
CREATE INDEX IF NOT EXISTS idx_pacts_status     ON pacts(status);
CREATE INDEX IF NOT EXISTS idx_members_user     ON pact_members(user_id);
CREATE INDEX IF NOT EXISTS idx_records_pact     ON daily_records(pact_id, user_id);
CREATE INDEX IF NOT EXISTS idx_records_archived ON daily_records(archived);
