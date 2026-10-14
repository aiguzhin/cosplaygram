// Cosplaygram — сервер (Express + JSON-хранилище)
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { seed } = require('./seed');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---------- хранилище ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let db;
try {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
} catch {
  db = seed();
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
  console.log('Создана демо-база Cosplaygram');
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db), (err) => {
      if (!err) fs.rename(DB_FILE + '.tmp', DB_FILE, () => {});
    });
  }, 300);
}

const id = () => crypto.randomBytes(8).toString('hex');
const now = () => Date.now();
const DAY = 24 * 60 * 60 * 1000;

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

function publicUser(u) {
  if (!u) return null;
  const { password, ...rest } = u;
  return rest;
}
const userById = (uid) => db.users.find((u) => u.id === uid);
const userByName = (name) => db.users.find((u) => u.username.toLowerCase() === String(name).toLowerCase());

function postView(p, me) {
  return {
    ...p,
    author: publicUser(userById(p.authorId)),
    likeCount: p.likes.length,
    liked: me ? p.likes.includes(me.id) : false,
    comments: p.comments.map((c) => ({ ...c, author: publicUser(userById(c.authorId)) })),
  };
}

// ---------- приложение ----------
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

// сессия из cookie
app.use((req, _res, next) => {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  const s = m && db.sessions[m[1]];
  req.user = s ? userById(s) : null;
  next();
});
const auth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Войдите, чтобы продолжить' });

function startSession(res, user) {
  const sid = crypto.randomBytes(24).toString('hex');
  db.sessions[sid] = user.id;
  save();
  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}`);
}

const clean = (s, max = 2000) => String(s || '').trim().slice(0, max);
const isImage = (s) => typeof s === 'string' && /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/.test(s);

// ----- аккаунт -----
app.post('/api/register', (req, res) => {
  const username = clean(req.body.username, 30).toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[a-z0-9_.]{3,30}$/.test(username))
    return res.status(400).json({ error: 'Ник: 3–30 символов, латиница, цифры, точка или _' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  if (userByName(username)) return res.status(409).json({ error: 'Этот ник уже занят' });
  const user = {
    id: id(),
    username,
    password: hashPassword(password),
    name: clean(req.body.name, 60) || username,
    city: clean(req.body.city, 40),
    specialty: clean(req.body.specialty, 60),
    bio: '',
    avatar: null,
    hue: Math.floor(Math.random() * 360),
    createdAt: now(),
  };
  db.users.push(user);
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const user = userByName(clean(req.body.username, 30));
  if (!user || !user.password || !checkPassword(String(req.body.password || ''), user.password))
    return res.status(401).json({ error: 'Неверный ник или пароль' });
  startSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  const m = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '');
  if (m) delete db.sessions[m[1]];
  save();
  res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => res.json({ user: publicUser(req.user) }));

app.patch('/api/me', auth, (req, res) => {
  const u = req.user;
  for (const k of ['name', 'city', 'specialty', 'bio']) if (k in req.body) u[k] = clean(req.body[k], k === 'bio' ? 300 : 60);
  if (req.body.avatar && isImage(req.body.avatar)) u.avatar = req.body.avatar;
  save();
  res.json({ user: publicUser(u) });
});

// ----- лента и посты -----
app.get('/api/feed', (req, res) => {
  const kind = req.query.kind;
  let posts = [...db.posts];
  if (kind) posts = posts.filter((p) => p.kind === kind);
  posts.sort((a, b) => b.createdAt - a.createdAt);
  res.json({ posts: posts.map((p) => postView(p, req.user)) });
});

app.get('/api/posts/:id', (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Пост не найден' });
  res.json({ post: postView(p, req.user) });
});

app.post('/api/posts', auth, (req, res) => {
  const slides = (Array.isArray(req.body.slides) ? req.body.slides : [])
    .filter((s) => isImage(s.image))
    .slice(0, 10)
    .map((s) => ({ image: s.image, caption: clean(s.caption, 300) }));
  if (!slides.length) return res.status(400).json({ error: 'Добавьте хотя бы одно фото' });
  const post = {
    id: id(),
    authorId: req.user.id,
    kind: req.body.kind === 'process' ? 'process' : 'costume',
    character: clean(req.body.character, 80),
    fandom: clean(req.body.fandom, 80),
    caption: clean(req.body.caption, 2200),
    materials: clean(req.body.materials, 200)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10),
    hours: Math.max(0, Math.min(5000, parseInt(req.body.hours, 10) || 0)),
    slides,
    likes: [],
    comments: [],
    createdAt: now(),
  };
  db.posts.push(post);
  save();
  res.json({ post: postView(post, req.user) });
});

app.delete('/api/posts/:id', auth, (req, res) => {
  const i = db.posts.findIndex((p) => p.id === req.params.id && p.authorId === req.user.id);
  if (i < 0) return res.status(404).json({ error: 'Пост не найден' });
  db.posts.splice(i, 1);
  save();
  res.json({ ok: true });
});

app.post('/api/posts/:id/like', auth, (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Пост не найден' });
  const i = p.likes.indexOf(req.user.id);
  if (i >= 0) p.likes.splice(i, 1);
  else p.likes.push(req.user.id);
  save();
  res.json({ liked: i < 0, likeCount: p.likes.length });
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = db.posts.find((x) => x.id === req.params.id);
  const text = clean(req.body.text, 500);
  if (!p) return res.status(404).json({ error: 'Пост не найден' });
  if (!text) return res.status(400).json({ error: 'Комментарий пустой' });
  const c = { id: id(), authorId: req.user.id, text, createdAt: now() };
  p.comments.push(c);
  save();
  res.json({ comment: { ...c, author: publicUser(req.user) } });
});

// ----- профили -----
app.get('/api/users', (req, res) => {
  res.json({ users: db.users.map(publicUser) });
});
app.get('/api/users/:username', (req, res) => {
  const u = userByName(req.params.username);
  if (!u) return res.status(404).json({ error: 'Косплеер не найден' });
  const posts = db.posts
    .filter((p) => p.authorId === u.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => postView(p, req.user));
  const likes = posts.reduce((n, p) => n + p.likeCount, 0);
  res.json({ user: publicUser(u), posts, stats: { posts: posts.length, likes } });
});

// ----- сторис (живут 24 часа) -----
app.get('/api/stories', (req, res) => {
  const fresh = db.stories.filter((s) => now() - s.createdAt < DAY);
  const byUser = {};
  for (const s of fresh.sort((a, b) => a.createdAt - b.createdAt)) {
    (byUser[s.authorId] ||= []).push(s);
  }
  const groups = Object.entries(byUser).map(([uid, items]) => ({ author: publicUser(userById(uid)), items }));
  groups.sort((a, b) => b.items.at(-1).createdAt - a.items.at(-1).createdAt);
  res.json({ groups });
});
app.post('/api/stories', auth, (req, res) => {
  if (!isImage(req.body.image)) return res.status(400).json({ error: 'Добавьте фото для истории' });
  const s = { id: id(), authorId: req.user.id, image: req.body.image, text: clean(req.body.text, 120), createdAt: now() };
  db.stories.push(s);
  db.stories = db.stories.filter((x) => now() - x.createdAt < DAY);
  save();
  res.json({ story: s });
});

// ----- форум -----
const threadView = (t) => ({
  ...t,
  author: publicUser(userById(t.authorId)),
  replies: t.replies.map((r) => ({ ...r, author: publicUser(userById(r.authorId)) })),
  replyCount: t.replies.length,
  lastAt: t.replies.length ? t.replies.at(-1).createdAt : t.createdAt,
});
app.get('/api/forum', (req, res) => {
  const list = db.threads.map(threadView).sort((a, b) => b.lastAt - a.lastAt);
  res.json({ threads: list.map(({ replies, ...t }) => t) });
});
app.get('/api/forum/:id', (req, res) => {
  const t = db.threads.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Тема не найдена' });
  res.json({ thread: threadView(t) });
});
app.post('/api/forum', auth, (req, res) => {
  const title = clean(req.body.title, 140);
  const body = clean(req.body.body, 4000);
  const cats = ['materials', 'sewing', 'props', 'wigs', 'photo', 'other'];
  if (!title || !body) return res.status(400).json({ error: 'Заполните заголовок и текст' });
  const t = {
    id: id(),
    authorId: req.user.id,
    category: cats.includes(req.body.category) ? req.body.category : 'other',
    city: clean(req.body.city, 40),
    title,
    body,
    replies: [],
    createdAt: now(),
  };
  db.threads.push(t);
  save();
  res.json({ thread: threadView(t) });
});
app.post('/api/forum/:id/replies', auth, (req, res) => {
  const t = db.threads.find((x) => x.id === req.params.id);
  const text = clean(req.body.text, 2000);
  if (!t) return res.status(404).json({ error: 'Тема не найдена' });
  if (!text) return res.status(400).json({ error: 'Ответ пустой' });
  t.replies.push({ id: id(), authorId: req.user.id, text, createdAt: now() });
  save();
  res.json({ thread: threadView(t) });
});

// ----- календарь -----
app.get('/api/events', (_req, res) => {
  res.json({ events: [...db.events].sort((a, b) => a.date.localeCompare(b.date)) });
});
app.post('/api/events', auth, (req, res) => {
  const title = clean(req.body.title, 120);
  const date = clean(req.body.date, 10);
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Укажите название и дату' });
  const e = {
    id: id(),
    title,
    date,
    city: clean(req.body.city, 40),
    place: clean(req.body.place, 120),
    type: req.body.type === 'contest' ? 'contest' : req.body.type === 'meetup' ? 'meetup' : 'festival',
    link: /^https?:\/\//.test(req.body.link || '') ? clean(req.body.link, 300) : '',
    note: clean(req.body.note, 300),
    authorId: req.user.id,
    demo: false,
  };
  db.events.push(e);
  save();
  res.json({ event: e });
});

// ----- чат -----
const ROOMS = ['general', 'almaty', 'astana', 'shymkent', 'aktobe', 'help'];
app.get('/api/chat/:room', (req, res) => {
  if (!ROOMS.includes(req.params.room)) return res.status(404).json({ error: 'Нет такой комнаты' });
  const after = Number(req.query.after) || 0;
  const msgs = (db.chat[req.params.room] || []).filter((m) => m.createdAt > after).slice(-100);
  res.json({ messages: msgs.map((m) => ({ ...m, author: publicUser(userById(m.authorId)) })) });
});
app.post('/api/chat/:room', auth, (req, res) => {
  if (!ROOMS.includes(req.params.room)) return res.status(404).json({ error: 'Нет такой комнаты' });
  const text = clean(req.body.text, 1000);
  if (!text) return res.status(400).json({ error: 'Сообщение пустое' });
  const m = { id: id(), authorId: req.user.id, text, createdAt: now() };
  (db.chat[req.params.room] ||= []).push(m);
  db.chat[req.params.room] = db.chat[req.params.room].slice(-500);
  save();
  res.json({ message: { ...m, author: publicUser(req.user) } });
});

// ----- поиск -----
app.get('/api/search', (req, res) => {
  const q = clean(req.query.q, 60).toLowerCase();
  if (!q) return res.json({ users: [], posts: [] });
  const has = (s) => String(s || '').toLowerCase().includes(q);
  const users = db.users.filter((u) => has(u.username) || has(u.name) || has(u.specialty) || has(u.city) || has(u.bio));
  const posts = db.posts.filter(
    (p) => has(p.character) || has(p.fandom) || has(p.caption) || p.materials.some(has)
  );
  res.json({ users: users.map(publicUser), posts: posts.map((p) => postView(p, req.user)) });
});

// ----- конкурс месяца -----
app.get('/api/contest', (req, res) => {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  let pool = db.posts.filter((p) => p.kind === 'costume' && p.createdAt >= from);
  if (pool.length < 3) pool = db.posts.filter((p) => p.kind === 'costume');
  const top = pool
    .map((p) => postView(p, req.user))
    .sort((a, b) => b.likeCount - a.likeCount)
    .slice(0, 5);
  res.json({ month: d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }), top });
});

app.get('/healthz', (_req, res) => res.send('ok'));

// SPA: все остальные пути отдают index.html
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Cosplaygram запущен на порту ${PORT}`));
