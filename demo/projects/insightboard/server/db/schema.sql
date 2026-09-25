PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS feedback (
  id            INTEGER PRIMARY KEY,
  customer      TEXT    NOT NULL,
  channel       TEXT    NOT NULL,
  body          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS predictions (
  id            INTEGER PRIMARY KEY,
  feedback_id   INTEGER NOT NULL REFERENCES feedback(id),
  label         TEXT    NOT NULL,
  confidence    REAL    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY,
  customer      TEXT    NOT NULL,
  amount        INTEGER NOT NULL,
  status        TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);
