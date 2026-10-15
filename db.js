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
`;

async function connect() {
  let query, exec, kind;
  if (process.env.DATABASE_URL) {
    const { Pool, types } = require('pg');
    types.setTypeParser(20, (v) => Number(v)); // bigint → number
    const local = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL);
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: local ? false : { rejectUnauthorized: false },
      max: 5,
    });
    query = async (sql, params = []) => (await pool.query(sql, params)).rows;
    exec = async (sql) => { await pool.query(sql); };
    kind = 'postgres';
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

module.exports = { connect };
