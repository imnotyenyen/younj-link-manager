CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER,
  slug TEXT NOT NULL,
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  outcome TEXT NOT NULL DEFAULT 'visit',
  country TEXT,
  device TEXT,
  browser TEXT,
  referrer TEXT,
  FOREIGN KEY(link_id) REFERENCES links(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings(key, value) VALUES
 ('site_name', 'YOUNJ LINK MANAGER'),
 ('logo_text', 'YOUNJ'),
 ('favicon_url', ''),
 ('wait_seconds', '3'),
 ('interstitial_message', 'Vui lòng chờ trong giây lát...'),
 ('maintenance', '0');
