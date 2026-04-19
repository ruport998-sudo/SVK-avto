-- schema.sql
-- D1 database schema for СВК Авто

-- Topics table for AI blog
CREATE TABLE IF NOT EXISTS topics (
  topic_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  system TEXT NOT NULL,
  angle TEXT NOT NULL,
  audience TEXT DEFAULT 'все владельцы',
  priority INTEGER DEFAULT 5,
  cooldown_system_days INTEGER DEFAULT 21,
  cooldown_system_angle_days INTEGER DEFAULT 60,
  last_used_at TEXT,
  use_count INTEGER DEFAULT 0
);

-- Calendar slots for scheduled publishing
CREATE TABLE IF NOT EXISTS calendar_slots (
  pub_date TEXT PRIMARY KEY,
  topic_id TEXT,
  category TEXT,
  system TEXT,
  angle TEXT,
  title_draft TEXT,
  keywords TEXT,
  image_prompt TEXT,
  status TEXT DEFAULT 'planned',
  post_slug TEXT UNIQUE,
  commit_sha TEXT,
  fingerprint TEXT,
  image_pending INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  error TEXT,
  FOREIGN KEY (topic_id) REFERENCES topics(topic_id)
);

-- Chat quota tracking
CREATE TABLE IF NOT EXISTS chat_quota (
  visitor_id TEXT,
  window_start TEXT,
  used_count INTEGER DEFAULT 0,
  PRIMARY KEY (visitor_id, window_start)
);

-- Callback requests
CREATE TABLE IF NOT EXISTS callbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_time TEXT DEFAULT 'day',
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'new'
);

-- Published posts log
CREATE TABLE IF NOT EXISTS published_posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  pub_date TEXT NOT NULL,
  commit_sha TEXT,
  topic_id TEXT,
  created_at TEXT,
  FOREIGN KEY (topic_id) REFERENCES topics(topic_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_slots_status ON calendar_slots(status);
CREATE INDEX IF NOT EXISTS idx_slots_date ON calendar_slots(pub_date);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_topics_system ON topics(system);
