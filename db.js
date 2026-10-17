// Слой базы данных Cosplaygram.
// С переменной DATABASE_URL — настоящий PostgreSQL (Supabase, Render, Neon…).
// Без неё — встроенный PostgreSQL (PGlite) в папке data/, удобно для локальной разработки.
const path = require('path');
const fs = require('fs');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT,
  name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  specialty TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  avatar_id TEXT,
  color TEXT NOT NULL DEFAULT 'lapis',
  role TEXT NOT NULL DEFAULT 'user',
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  owner_id TEXT,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'costume',
  character TEXT NOT NULL DEFAULT '',
  fandom TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  materials TEXT NOT NULL DEFAULT '[]',
  hours INTEGER NOT NULL DEFAULT 0,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_created ON posts(created_at DESC);
CREATE TABLE IF NOT EXISTS post_images (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  image_id TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (post_id, idx)
);
CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS saves (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS threads (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other',
  city TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  place TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'festival',
  link TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_room ON messages(room, created_at);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id TEXT,
  thread_id TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE TABLE IF NOT EXISTS dms (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS dms_from ON dms(from_id, to_id, created_at);
CREATE INDEX IF NOT EXISTS dms_to ON dms(to_id, read);
CREATE TABLE IF NOT EXISTS event_going (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT '';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS char_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS posts_char ON posts(char_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE threads ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS socials TEXT NOT NULL DEFAULT '{}';
ALTER TABLE events ADD COLUMN IF NOT EXISTS major BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE images ADD COLUMN IF NOT EXISTS url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS orders_open BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KZT',
  days INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS services_user ON services(user_id);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  master_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id TEXT,
  title TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  budget TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at DOUBLE PRECISION NOT NULL,
  updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_master ON orders(master_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_client ON orders(client_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reviews (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  master_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_master ON reviews(master_id, created_at DESC);
CREATE TABLE IF NOT EXISTS event_results (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  nomination TEXT NOT NULL,
  place TEXT NOT NULL DEFAULT '',
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS results_event ON event_results(event_id);
CREATE INDEX IF NOT EXISTS results_user ON event_results(user_id);
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'place',
  event TEXT NOT NULL,
  year TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ach_user ON achievements(user_id);
CREATE TABLE IF NOT EXISTS char_covers (
  char_id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL,
  updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DOUBLE PRECISION NOT NULL
);
-- Вход через Google, Telegram и т. п.: какой внешний аккаунт к какому участнику привязан
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  created_at DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (provider, subject)
);
CREATE INDEX IF NOT EXISTS identities_user ON identities (user_id);
-- Настройки сайта, которые разработчик меняет в админ-панели (ключи входа и т. п.)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`;

// Postgres по адресу (Supabase, Render и т. п.)
function pgPool(url) {
  const { Pool, types } = require('pg');
  types.setTypeParser(20, (v) => Number(v)); // bigint → number
  // без SSL: локальная база или база в соседнем контейнере на том же сервере (docker compose)
  const local = /localhost|127\.0\.0\.1|@db[:/]|sslmode=disable/.test(url);
  const pool = new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 5 });
  return {
    query: async (sql, params = []) => (await pool.query(sql, params)).rows,
    exec: async (sql) => { await pool.query(sql); },
    end: () => pool.end(),
  };
}

// Основная база: NEW_DATABASE_URL (Neon, после переезда) → DATABASE_URL (Render) → локальная PGlite
async function connect() {
  let query, exec, kind;
  const url = process.env.NEW_DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (url) {
    ({ query, exec } = pgPool(url));
    kind = process.env.NEW_DATABASE_URL || process.env.SUPABASE_DB_URL ? 'новая база (Neon)' : 'postgres';
  } else {
    const dir = process.env.DATA_DIR || path.join(__dirname, 'data', 'pg');
    fs.mkdirSync(dir, { recursive: true });
    const { PGlite } = await import('@electric-sql/pglite');
    const db = new PGlite(dir);
    await db.waitReady;
    query = async (sql, params = []) => (await db.query(sql, params)).rows;
    exec = async (sql) => { await db.exec(sql); };
    kind = 'pglite';
  }
  await exec(SCHEMA);
  return { query, exec, kind };
}

// Перенос всех данных из старой базы в новую (по порядку, чтобы не сломать связи между таблицами)
const TABLES = ['users', 'sessions', 'images', 'posts', 'post_images', 'likes', 'saves', 'comments', 'follows', 'stories',
  'threads', 'replies', 'events', 'event_going', 'event_results', 'achievements', 'messages', 'notifications', 'reports',
  'dms', 'char_covers', 'services', 'orders', 'reviews', 'identities', 'settings'];
async function copyAll(src, dst, log = console.log) {
  for (const t of TABLES) {
    const [ex] = await src.query('SELECT to_regclass($1) AS r', ['public.' + t]);
    if (!ex.r) continue;
    const cols = (await dst.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [t])).map((r) => r.column_name);
    const size = t === 'images' ? 10 : 400;
    let off = 0;
    for (;;) {
      const rows = await src.query(`SELECT * FROM ${t} ORDER BY 1 LIMIT ${size} OFFSET ${off}`);
      if (!rows.length) break;
      const use = Object.keys(rows[0]).filter((c) => cols.includes(c));
      const vals = [];
      const ph = rows.map((r, i) => '(' + use.map((c, j) => { vals.push(r[c]); return '$' + (i * use.length + j + 1); }).join(',') + ')').join(',');
      await dst.query(`INSERT INTO ${t} (${use.join(',')}) VALUES ${ph} ON CONFLICT DO NOTHING`, vals);
      off += rows.length;
    }
    log(`  перенесено: ${t} — ${off}`);
  }
}

module.exports = { connect, pgPool, copyAll, TABLES };
