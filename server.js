// Cosplaygram — сервер: Express + PostgreSQL
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { connect } = require('./db');
const { seedDb } = require('./seed');

const PORT = process.env.PORT || 3000;
const ADMINS = (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const DAY = 24 * 60 * 60 * 1000;
const COLORS = ['lapis', 'turquoise', 'garnet', 'saffron', 'violet', 'jade'];
const CATEGORIES = ['materials', 'sewing', 'props', 'wigs', 'photo', 'other'];
const ROOMS = ['general', 'almaty', 'astana', 'shymkent', 'aktobe', 'karaganda', 'help'];

const newId = () => crypto.randomBytes(8).toString('hex');
const now = () => Date.now();
const clean = (s, max = 2000) => String(s ?? '').trim().slice(0, max);

function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// простой лимит попыток входа: 10 за 10 минут с одного IP
const attempts = new Map();
function tooMany(ip) {
  const t = now();
  const list = (attempts.get(ip) || []).filter((x) => t - x < 10 * 60 * 1000);
  list.push(t);
  attempts.set(ip, list);
  return list.length > 10;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function main() {
  const db = await connect();
  const q = db.query;
  const one = async (sql, p) => (await q(sql, p))[0] || null;
  if (await seedDb(db)) console.log('Демо-данные загружены');
  console.log(`База: ${db.kind}`);

  // ---------- картинки ----------
  async function saveImage(dataUri, ownerId) {
    const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || '');
    if (!m) throw new HttpError(400, 'Фото должно быть в формате JPG, PNG, WEBP или GIF');
    if (m[2].length > 4_000_000) throw new HttpError(400, 'Фото слишком большое: максимум около 3 МБ');
    const id = newId();
    await q('INSERT INTO images (id, mime, data, owner_id, created_at) VALUES ($1,$2,$3,$4,$5)', [id, m[1], m[2], ownerId, now()]);
    return id;
  }
  const imgUrl = (id) => (!id ? null : id.startsWith('/') ? id : `/img/${id}`);

  // ---------- представления ----------
  const userCols = 'u.id, u.username, u.name, u.city, u.specialty, u.bio, u.avatar_id, u.color, u.role, u.demo, u.created_at';
  const userView = (r, prefix = '') => {
    const g = (k) => r[prefix + k];
    if (!g('id')) return null;
    return {
      id: g('id'), username: g('username'), name: g('name'), city: g('city'), specialty: g('specialty'),
      bio: g('bio'), avatar: imgUrl(g('avatar_id')), color: g('color'), role: g('role'), demo: g('demo'),
      createdAt: g('created_at'),
    };
  };
  const authorCols = (a = 'u', p = 'a_') =>
    ['id', 'username', 'name', 'city', 'specialty', 'bio', 'avatar_id', 'color', 'role', 'demo', 'created_at']
      .map((c) => `${a}.${c} AS ${p}${c}`).join(', ');

  async function loadPosts(where, params, meId, { limit = 30, comments = 2 } = {}) {
    const me = meId || '';
    const n = params.length;
    const rows = await q(
      `SELECT p.*, ${authorCols()},
        (SELECT count(*)::int FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT count(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count,
        EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${n + 1}) AS liked,
        EXISTS (SELECT 1 FROM saves s WHERE s.post_id = p.id AND s.user_id = $${n + 1}) AS saved
       FROM posts p JOIN users u ON u.id = p.author_id
       ${where}
       ORDER BY p.created_at DESC LIMIT ${Number(limit)}`,
      [...params, me]
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const slides = await q('SELECT * FROM post_images WHERE post_id = ANY($1) ORDER BY idx', [ids]);
    const cms = await q(
      `SELECT c.*, ${authorCols()} FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.post_id = ANY($1) ORDER BY c.created_at`,
      [ids]
    );
    return rows.map((r) => {
      const all = cms.filter((c) => c.post_id === r.id);
      return {
        id: r.id, authorId: r.author_id, kind: r.kind, character: r.character, fandom: r.fandom,
        caption: r.caption, materials: JSON.parse(r.materials || '[]'), hours: r.hours, demo: r.demo,
        createdAt: r.created_at, author: userView(r, 'a_'),
        likeCount: r.like_count, commentCount: r.comment_count, liked: r.liked, saved: r.saved,
        slides: slides.filter((s) => s.post_id === r.id).map((s) => ({ image: imgUrl(s.image_id), caption: s.caption })),
        comments: (comments ? all.slice(-comments) : all).map((c) => ({
          id: c.id, text: c.text, createdAt: c.created_at, authorId: c.author_id, author: userView(c, 'a_'),
        })),
      };
    });
  }

  async function notify(userId, actorId, type, extra = {}) {
    if (!userId || userId === actorId) return;
    await q(
      'INSERT INTO notifications (id, user_id, actor_id, type, post_id, thread_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId(), userId, actorId, type, extra.postId || null, extra.threadId || null, now()]
    );
  }

  // ---------- приложение ----------
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '25mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

  app.get('/img/:id', wrap(async (req, res) => {
    const r = await one('SELECT mime, data FROM images WHERE id = $1', [req.params.id]);
    if (!r) return res.status(404).end();
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (r.mime === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.end(Buffer.from(r.data, 'base64'));
  }));

  // сессия
  app.use(wrap(async (req, _res, next) => {
    const m = /(?:^|;\s*)sid=([a-f0-9]{48})/.exec(req.headers.cookie || '');
    req.user = null;
    if (m) {
      const r = await one(`SELECT ${userCols} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.sid = $1`, [m[1]]);
      if (r) req.user = userView(r);
    }
    next();
  }));
  const auth = (req, _res, next) => (req.user ? next() : next(new HttpError(401, 'Войдите, чтобы продолжить')));
  // сайт закрыт для гостей: без входа доступны только регистрация, вход и проверка сессии
  const OPEN = new Set(['/register', '/login', '/logout', '/me']);
  app.use('/api', (req, _res, next) => (OPEN.has(req.path) || req.user ? next() : next(new HttpError(401, 'Зарегистрируйтесь или войдите, чтобы пользоваться Cosplaygram'))));
  const admin = (req, _res, next) => (req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Только для модераторов')));
  const isAdmin = (req) => req.user?.role === 'admin';

  async function startSession(req, res, userId) {
    const sid = crypto.randomBytes(24).toString('hex');
    await q('INSERT INTO sessions (sid, user_id, created_at) VALUES ($1,$2,$3)', [sid, userId, now()]);
    const secure = req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}${secure}`);
  }
  const meView = async (id) => userView(await one(`SELECT ${userCols} FROM users u WHERE u.id = $1`, [id]));

  // ----- аккаунт -----
  app.post('/api/register', wrap(async (req, res) => {
    if (tooMany(req.ip)) throw new HttpError(429, 'Слишком много попыток. Подождите 10 минут.');
    const username = clean(req.body.username, 30).toLowerCase();
    const password = String(req.body.password || '');
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Ник: от 3 до 30 символов — латиница, цифры, точка или _');
    if (password.length < 8) throw new HttpError(400, 'Пароль должен быть не короче 8 символов');
    if (await one('SELECT 1 FROM users WHERE username = $1', [username])) throw new HttpError(409, 'Этот ник уже занят');
    const real = await one('SELECT count(*)::int AS n FROM users WHERE demo = FALSE');
    const role = ADMINS.includes(username) || real.n === 0 ? 'admin' : 'user';
    const id = newId();
    await q(
      `INSERT INTO users (id, username, password, name, city, specialty, color, role, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, username, hashPassword(password), clean(req.body.name, 60) || username, clean(req.body.city, 40),
        clean(req.body.specialty, 60), COLORS[Math.floor(Math.random() * COLORS.length)], role, now()]
    );
    await startSession(req, res, id);
    res.json({ user: await meView(id) });
  }));

  app.post('/api/login', wrap(async (req, res) => {
    if (tooMany(req.ip)) throw new HttpError(429, 'Слишком много попыток. Подождите 10 минут.');
    const u = await one('SELECT id, password FROM users WHERE username = $1', [clean(req.body.username, 30).toLowerCase()]);
    if (!u || !checkPassword(String(req.body.password || ''), u.password)) throw new HttpError(401, 'Неверный ник или пароль');
    await startSession(req, res, u.id);
    res.json({ user: await meView(u.id) });
  }));

  app.post('/api/logout', wrap(async (req, res) => {
    const m = /(?:^|;\s*)sid=([a-f0-9]{48})/.exec(req.headers.cookie || '');
    if (m) await q('DELETE FROM sessions WHERE sid = $1', [m[1]]);
    res.setHeader('Set-Cookie', 'sid=; Path=/; Max-Age=0');
    res.json({ ok: true });
  }));

  app.get('/api/me', wrap(async (req, res) => {
    if (!req.user) return res.json({ user: null, unread: 0 });
    const r = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read = FALSE', [req.user.id]);
    res.json({ user: req.user, unread: r.n });
  }));

  app.patch('/api/me', auth, wrap(async (req, res) => {
    const b = req.body;
    const u = req.user;
    const avatarId = b.avatar ? await saveImage(b.avatar, u.id) : null;
    await q(
      `UPDATE users SET name = $2, city = $3, specialty = $4, bio = $5, color = $6, avatar_id = COALESCE($7, avatar_id) WHERE id = $1`,
      [u.id, clean(b.name ?? u.name, 60), clean(b.city ?? u.city, 40), clean(b.specialty ?? u.specialty, 60),
        clean(b.bio ?? u.bio, 300), COLORS.includes(b.color) ? b.color : u.color, avatarId]
    );
    res.json({ user: await meView(u.id) });
  }));

  app.post('/api/me/password', auth, wrap(async (req, res) => {
    const u = await one('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!checkPassword(String(req.body.current || ''), u.password)) throw new HttpError(400, 'Текущий пароль указан неверно');
    if (String(req.body.next || '').length < 8) throw new HttpError(400, 'Новый пароль должен быть не короче 8 символов');
    await q('UPDATE users SET password = $2 WHERE id = $1', [req.user.id, hashPassword(String(req.body.next))]);
    res.json({ ok: true });
  }));

  // ----- посты -----
  app.get('/api/feed', wrap(async (req, res) => {
    const conds = [];
    const params = [];
    if (req.query.kind === 'process' || req.query.kind === 'costume') { params.push(req.query.kind); conds.push(`p.kind = $${params.length}`); }
    if (req.query.mode === 'following' && req.user) {
      params.push(req.user.id);
      conds.push(`(p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $${params.length}) OR p.author_id = $${params.length})`);
    }
    if (req.query.before) { params.push(Number(req.query.before)); conds.push(`p.created_at < $${params.length}`); }
    const posts = await loadPosts(conds.length ? 'WHERE ' + conds.join(' AND ') : '', params, req.user?.id, { limit: 20 });
    res.json({ posts });
  }));

  app.get('/api/posts/:id', wrap(async (req, res) => {
    const [post] = await loadPosts('WHERE p.id = $1', [req.params.id], req.user?.id, { limit: 1, comments: 0 });
    if (!post) throw new HttpError(404, 'Публикация не найдена');
    res.json({ post });
  }));

  app.post('/api/posts', auth, wrap(async (req, res) => {
    const slides = (Array.isArray(req.body.slides) ? req.body.slides : []).slice(0, 10);
    if (!slides.length) throw new HttpError(400, 'Добавьте хотя бы одно фото');
    const id = newId();
    const materials = clean(req.body.materials, 300).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    const imageIds = [];
    for (const s of slides) imageIds.push(await saveImage(s.image, req.user.id));
    await q(
      `INSERT INTO posts (id, author_id, kind, character, fandom, caption, materials, hours, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, req.user.id, req.body.kind === 'process' ? 'process' : 'costume', clean(req.body.character, 80),
        clean(req.body.fandom, 80), clean(req.body.caption, 2200), JSON.stringify(materials),
        Math.max(0, Math.min(5000, parseInt(req.body.hours, 10) || 0)), now()]
    );
    for (const [i, imgId] of imageIds.entries())
      await q('INSERT INTO post_images (post_id, idx, image_id, caption) VALUES ($1,$2,$3,$4)', [id, i, imgId, clean(slides[i].caption, 300)]);
    const [post] = await loadPosts('WHERE p.id = $1', [id], req.user.id, { limit: 1 });
    res.json({ post });
  }));

  app.delete('/api/posts/:id', auth, wrap(async (req, res) => {
    const p = await one('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (!p) throw new HttpError(404, 'Публикация не найдена');
    if (p.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалить можно только свою публикацию');
    await q('DELETE FROM posts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  async function toggle(table, postId, userId) {
    const del = await q(`DELETE FROM ${table} WHERE post_id = $1 AND user_id = $2 RETURNING 1`, [postId, userId]);
    if (del.length) return false;
    await q(`INSERT INTO ${table} (post_id, user_id, created_at) VALUES ($1,$2,$3)`, [postId, userId, now()]);
    return true;
  }

  app.post('/api/posts/:id/like', auth, wrap(async (req, res) => {
    const p = await one('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (!p) throw new HttpError(404, 'Публикация не найдена');
    const liked = await toggle('likes', req.params.id, req.user.id);
    if (liked) await notify(p.author_id, req.user.id, 'like', { postId: req.params.id });
    const { n } = await one('SELECT count(*)::int AS n FROM likes WHERE post_id = $1', [req.params.id]);
    res.json({ liked, likeCount: n });
  }));

  app.post('/api/posts/:id/save', auth, wrap(async (req, res) => {
    if (!(await one('SELECT 1 FROM posts WHERE id = $1', [req.params.id]))) throw new HttpError(404, 'Публикация не найдена');
    res.json({ saved: await toggle('saves', req.params.id, req.user.id) });
  }));

  app.get('/api/saved', auth, wrap(async (req, res) => {
    res.json({ posts: await loadPosts('WHERE p.id IN (SELECT post_id FROM saves WHERE user_id = $1)', [req.user.id], req.user.id, { limit: 100 }) });
  }));

  app.post('/api/posts/:id/comments', auth, wrap(async (req, res) => {
    const p = await one('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    const text = clean(req.body.text, 500);
    if (!p) throw new HttpError(404, 'Публикация не найдена');
    if (!text) throw new HttpError(400, 'Комментарий пустой');
    const c = { id: newId(), text, createdAt: now(), authorId: req.user.id, author: req.user };
    await q('INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [c.id, req.params.id, req.user.id, text, c.createdAt]);
    await notify(p.author_id, req.user.id, 'comment', { postId: req.params.id });
    res.json({ comment: c });
  }));

  app.delete('/api/comments/:id', auth, wrap(async (req, res) => {
    const c = await one('SELECT c.author_id, p.author_id AS post_author FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = $1', [req.params.id]);
    if (!c) throw new HttpError(404, 'Комментарий не найден');
    if (![c.author_id, c.post_author].includes(req.user.id) && !isAdmin(req)) throw new HttpError(403, 'Нет прав удалить этот комментарий');
    await q('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // ----- люди -----
  app.get('/api/users', wrap(async (req, res) => {
    const rows = await q(
      `SELECT ${userCols}, (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS followers
       FROM users u ORDER BY u.demo ASC, followers DESC, u.created_at DESC LIMIT 50`
    );
    res.json({ users: rows.map((r) => ({ ...userView(r), followers: r.followers })) });
  }));

  app.get('/api/users/:username', wrap(async (req, res) => {
    const r = await one(`SELECT ${userCols} FROM users u WHERE u.username = $1`, [req.params.username.toLowerCase()]);
    if (!r) throw new HttpError(404, 'Косплеер не найден');
    const user = userView(r);
    const posts = await loadPosts('WHERE p.author_id = $1', [user.id], req.user?.id, { limit: 200, comments: 0 });
    const s = await one(
      `SELECT (SELECT count(*)::int FROM follows WHERE followee_id = $1) AS followers,
              (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS following,
              (SELECT count(*)::int FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = $1) AS likes,
              EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1) AS is_following`,
      [user.id, req.user?.id || '']
    );
    res.json({ user, posts, stats: { posts: posts.length, followers: s.followers, following: s.following, likes: s.likes }, isFollowing: s.is_following });
  }));

  app.post('/api/users/:username/follow', auth, wrap(async (req, res) => {
    const u = await one('SELECT id FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!u) throw new HttpError(404, 'Косплеер не найден');
    if (u.id === req.user.id) throw new HttpError(400, 'Нельзя подписаться на себя');
    const del = await q('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2 RETURNING 1', [req.user.id, u.id]);
    if (!del.length) {
      await q('INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1,$2,$3)', [req.user.id, u.id, now()]);
      await notify(u.id, req.user.id, 'follow');
    }
    const { n } = await one('SELECT count(*)::int AS n FROM follows WHERE followee_id = $1', [u.id]);
    res.json({ following: !del.length, followers: n });
  }));

  // ----- истории (24 часа) -----
  app.get('/api/stories', wrap(async (_req, res) => {
    const rows = await q(
      `SELECT s.*, ${authorCols()} FROM stories s JOIN users u ON u.id = s.author_id
       WHERE s.created_at > $1 ORDER BY s.created_at`,
      [now() - DAY]
    );
    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.author_id)) groups.set(r.author_id, { author: userView(r, 'a_'), items: [] });
      groups.get(r.author_id).items.push({ id: r.id, image: imgUrl(r.image_id), text: r.text, createdAt: r.created_at });
    }
    const list = [...groups.values()].sort((a, b) => b.items.at(-1).createdAt - a.items.at(-1).createdAt);
    res.json({ groups: list });
  }));
  app.post('/api/stories', auth, wrap(async (req, res) => {
    const imageId = await saveImage(req.body.image, req.user.id);
    const id = newId();
    await q('INSERT INTO stories (id, author_id, image_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [id, req.user.id, imageId, clean(req.body.text, 120), now()]);
    res.json({ story: { id } });
  }));

  // ----- форум -----
  app.get('/api/forum', wrap(async (_req, res) => {
    const rows = await q(
      `SELECT t.id, t.category, t.city, t.title, t.demo, t.created_at, ${authorCols()},
        (SELECT count(*)::int FROM replies r WHERE r.thread_id = t.id) AS reply_count,
        COALESCE((SELECT max(r.created_at) FROM replies r WHERE r.thread_id = t.id), t.created_at) AS last_at
       FROM threads t JOIN users u ON u.id = t.author_id ORDER BY last_at DESC LIMIT 200`
    );
    res.json({
      threads: rows.map((r) => ({
        id: r.id, category: r.category, city: r.city, title: r.title, demo: r.demo, createdAt: r.created_at,
        author: userView(r, 'a_'), replyCount: r.reply_count, lastAt: r.last_at,
      })),
    });
  }));
  async function loadThread(id) {
    const t = await one(`SELECT t.*, ${authorCols()} FROM threads t JOIN users u ON u.id = t.author_id WHERE t.id = $1`, [id]);
    if (!t) throw new HttpError(404, 'Тема не найдена');
    const replies = await q(`SELECT r.*, ${authorCols()} FROM replies r JOIN users u ON u.id = r.author_id WHERE r.thread_id = $1 ORDER BY r.created_at`, [id]);
    return {
      id: t.id, authorId: t.author_id, category: t.category, city: t.city, title: t.title, body: t.body, demo: t.demo,
      createdAt: t.created_at, author: userView(t, 'a_'),
      replies: replies.map((r) => ({ id: r.id, authorId: r.author_id, text: r.text, createdAt: r.created_at, author: userView(r, 'a_') })),
    };
  }
  app.get('/api/forum/:id', wrap(async (req, res) => res.json({ thread: await loadThread(req.params.id) })));
  app.post('/api/forum', auth, wrap(async (req, res) => {
    const title = clean(req.body.title, 140);
    const body = clean(req.body.body, 4000);
    if (!title || !body) throw new HttpError(400, 'Заполните заголовок и текст');
    const id = newId();
    await q('INSERT INTO threads (id, author_id, category, city, title, body, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
      id, req.user.id, CATEGORIES.includes(req.body.category) ? req.body.category : 'other', clean(req.body.city, 40), title, body, now(),
    ]);
    res.json({ thread: await loadThread(id) });
  }));
  app.post('/api/forum/:id/replies', auth, wrap(async (req, res) => {
    const t = await one('SELECT author_id FROM threads WHERE id = $1', [req.params.id]);
    const text = clean(req.body.text, 2000);
    if (!t) throw new HttpError(404, 'Тема не найдена');
    if (!text) throw new HttpError(400, 'Ответ пустой');
    await q('INSERT INTO replies (id, thread_id, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [newId(), req.params.id, req.user.id, text, now()]);
    await notify(t.author_id, req.user.id, 'reply', { threadId: req.params.id });
    res.json({ thread: await loadThread(req.params.id) });
  }));
  app.delete('/api/forum/:id', auth, wrap(async (req, res) => {
    const t = await one('SELECT author_id FROM threads WHERE id = $1', [req.params.id]);
    if (!t) throw new HttpError(404, 'Тема не найдена');
    if (t.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалить можно только свою тему');
    await q('DELETE FROM threads WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // ----- календарь -----
  app.get('/api/events', wrap(async (_req, res) => {
    const rows = await q('SELECT * FROM events ORDER BY date');
    res.json({ events: rows.map((e) => ({ ...e, authorId: e.author_id })) });
  }));
  app.post('/api/events', auth, wrap(async (req, res) => {
    const title = clean(req.body.title, 120);
    const date = clean(req.body.date, 10);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Укажите название и дату');
    const type = ['contest', 'festival', 'meetup', 'workshop'].includes(req.body.type) ? req.body.type : 'festival';
    const link = /^https?:\/\//.test(req.body.link || '') ? clean(req.body.link, 300) : '';
    await q(
      'INSERT INTO events (id, title, date, city, place, type, link, note, author_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [newId(), title, date, clean(req.body.city, 40), clean(req.body.place, 120), type, link, clean(req.body.note, 300), req.user.id, now()]
    );
    res.json({ ok: true });
  }));
  app.delete('/api/events/:id', auth, wrap(async (req, res) => {
    const e = await one('SELECT author_id FROM events WHERE id = $1', [req.params.id]);
    if (!e) throw new HttpError(404, 'Событие не найдено');
    if (e.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалить можно только своё событие');
    await q('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // ----- чат -----
  app.get('/api/chat/:room', wrap(async (req, res) => {
    if (!ROOMS.includes(req.params.room)) throw new HttpError(404, 'Нет такой комнаты');
    const rows = await q(
      `SELECT * FROM (SELECT m.*, ${authorCols()} FROM messages m JOIN users u ON u.id = m.author_id
         WHERE m.room = $1 AND m.created_at > $2 ORDER BY m.created_at DESC LIMIT 100) x ORDER BY created_at`,
      [req.params.room, Number(req.query.after) || 0]
    );
    res.json({ messages: rows.map((m) => ({ id: m.id, text: m.text, createdAt: m.created_at, authorId: m.author_id, author: userView(m, 'a_') })) });
  }));
  app.post('/api/chat/:room', auth, wrap(async (req, res) => {
    if (!ROOMS.includes(req.params.room)) throw new HttpError(404, 'Нет такой комнаты');
    const text = clean(req.body.text, 1000);
    if (!text) throw new HttpError(400, 'Сообщение пустое');
    const m = { id: newId(), text, createdAt: now(), authorId: req.user.id, author: req.user };
    await q('INSERT INTO messages (id, room, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [m.id, req.params.room, req.user.id, text, m.createdAt]);
    res.json({ message: m });
  }));
  app.delete('/api/messages/:id', auth, wrap(async (req, res) => {
    const m = await one('SELECT author_id FROM messages WHERE id = $1', [req.params.id]);
    if (!m) throw new HttpError(404, 'Сообщение не найдено');
    if (m.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Нет прав удалить это сообщение');
    await q('DELETE FROM messages WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // ----- уведомления -----
  app.get('/api/notifications', auth, wrap(async (req, res) => {
    const rows = await q(
      `SELECT n.*, ${authorCols()}, t.title AS thread_title,
         (SELECT pi.image_id FROM post_images pi WHERE pi.post_id = n.post_id AND pi.idx = 0) AS post_image
       FROM notifications n JOIN users u ON u.id = n.actor_id
       LEFT JOIN threads t ON t.id = n.thread_id
       WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 60`,
      [req.user.id]
    );
    res.json({
      items: rows.map((n) => ({
        id: n.id, type: n.type, read: n.read, createdAt: n.created_at, postId: n.post_id, threadId: n.thread_id,
        threadTitle: n.thread_title, postImage: imgUrl(n.post_image), actor: userView(n, 'a_'),
      })),
    });
  }));
  app.post('/api/notifications/read', auth, wrap(async (req, res) => {
    await q('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  }));

  // ----- поиск -----
  app.get('/api/search', wrap(async (req, res) => {
    const term = clean(req.query.q, 60).toLowerCase();
    if (!term) return res.json({ users: [], posts: [] });
    const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
    const users = await q(
      `SELECT ${userCols} FROM users u WHERE lower(u.username) LIKE $1 OR lower(u.name) LIKE $1
       OR lower(u.specialty) LIKE $1 OR lower(u.city) LIKE $1 OR lower(u.bio) LIKE $1 LIMIT 30`,
      [like]
    );
    const posts = await loadPosts(
      `WHERE lower(p.character) LIKE $1 OR lower(p.fandom) LIKE $1 OR lower(p.caption) LIKE $1 OR lower(p.materials) LIKE $1`,
      [like], req.user?.id, { limit: 60, comments: 0 }
    );
    res.json({ users: users.map((r) => userView(r)), posts });
  }));

  // ----- конкурс месяца -----
  app.get('/api/contest', wrap(async (req, res) => {
    const d = new Date();
    const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const rows = await q(
      `SELECT p.id, (SELECT count(*)::int FROM likes l WHERE l.post_id = p.id AND l.created_at >= $1) AS score
       FROM posts p WHERE p.kind = 'costume' ORDER BY score DESC, p.created_at DESC LIMIT 5`,
      [from]
    );
    const posts = rows.length
      ? await loadPosts('WHERE p.id = ANY($1)', [rows.map((r) => r.id)], req.user?.id, { limit: 5, comments: 0 })
      : [];
    const score = Object.fromEntries(rows.map((r) => [r.id, r.score]));
    posts.sort((a, b) => score[b.id] - score[a.id]);
    res.json({ month: d.toLocaleString('ru-RU', { month: 'long', year: 'numeric' }), top: posts.map((p) => ({ ...p, score: score[p.id] })) });
  }));

  // ----- жалобы и модерация -----
  app.post('/api/reports', auth, wrap(async (req, res) => {
    const type = ['post', 'comment', 'thread', 'message', 'user', 'event'].includes(req.body.type) ? req.body.type : null;
    if (!type || !req.body.id) throw new HttpError(400, 'Не указано, на что жалоба');
    await q('INSERT INTO reports (id, reporter_id, target_type, target_id, reason, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [
      newId(), req.user.id, type, clean(req.body.id, 40), clean(req.body.reason, 300), now(),
    ]);
    res.json({ ok: true });
  }));
  app.get('/api/admin/reports', auth, admin, wrap(async (_req, res) => {
    const rows = await q(
      `SELECT r.*, ${authorCols()} FROM reports r JOIN users u ON u.id = r.reporter_id
       WHERE r.resolved = FALSE ORDER BY r.created_at DESC LIMIT 100`
    );
    const stats = await one(
      `SELECT (SELECT count(*)::int FROM users WHERE demo = FALSE) AS users, (SELECT count(*)::int FROM posts) AS posts,
              (SELECT count(*)::int FROM threads) AS threads, (SELECT count(*)::int FROM messages) AS messages`
    );
    res.json({
      stats,
      reports: rows.map((r) => ({ id: r.id, type: r.target_type, targetId: r.target_id, reason: r.reason, createdAt: r.created_at, reporter: userView(r, 'a_') })),
    });
  }));
  app.post('/api/admin/reports/:id/resolve', auth, admin, wrap(async (req, res) => {
    await q('UPDATE reports SET resolved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
  app.post('/api/admin/demo/clear', auth, admin, wrap(async (_req, res) => {
    await q('DELETE FROM events WHERE demo = TRUE');
    await q('DELETE FROM users WHERE demo = TRUE');
    res.json({ ok: true });
  }));

  app.get('/healthz', (_req, res) => res.send('ok'));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Нет такого адреса API')));
  app.get(/^\/(?!api\/|img\/).*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 413 ? 'Файлы слишком большие' : status >= 500 ? 'Ошибка сервера. Попробуйте ещё раз.' : err.message });
  });

  app.listen(PORT, () => console.log(`Cosplaygram запущен на порту ${PORT}`));
}

main().catch((e) => {
  console.error('Не удалось запустить Cosplaygram:', e);
  process.exit(1);
});
