// Cosplaygram — сервер: Express + PostgreSQL
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { connect, pgPool, copyAll } = require('./db');
const storage = require('./storage');
const COUNTRIES = require('./public/countries');

const PORT = process.env.PORT || 3000;
// Разработчики платформы: полный доступ и роль, которую не может снять модератор
const DEVS = ['aiguzhin', ...(process.env.DEV_USERNAMES || '').split(',')].map((s) => s.trim().toLowerCase()).filter(Boolean);
const ADMINS = (process.env.ADMIN_USERNAMES || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const DAY = 24 * 60 * 60 * 1000;
const COLORS = ['lapis', 'turquoise', 'garnet', 'saffron', 'violet', 'jade'];
const CATEGORIES = ['materials', 'sewing', 'props', 'wigs', 'photo', 'other'];
const SOURCES = ['anime', 'manga', 'book', 'film', 'game', 'original'];
const EVENT_TYPES = ['festival', 'contest', 'event', 'party', 'meetup', 'workshop'];
const SOCIALS = ['instagram', 'tiktok', 'telegram', 'vk', 'youtube'];
const ACH_KINDS = ['place', 'jury', 'guest', 'organizer', 'other'];
const CURRENCIES = ['KZT', 'RUB', 'UZS', 'KGS', 'USD', 'EUR'];
const ORDER_STATUSES = ['new', 'accepted', 'declined', 'done', 'cancelled'];
const themeId = (t) => (/^[a-z0-9-]{2,24}$/.test(String(t || '')) ? String(t) : '');
// Комнаты чата: общая, срочная помощь и по одной на каждую страну (код страны строчными буквами)
const ROOMS = ['general', 'help', ...COUNTRIES.LIST.map(([c]) => c.toLowerCase())];
const KZ_CITIES = ['Алматы', 'Астана', 'Шымкент', 'Актобе', 'Караганда', 'Атырау', 'Актау', 'Павлодар', 'Костанай', 'Тараз', 'Уральск', 'Семей', 'Усть-Каменогорск', 'Кызылорда', 'Петропавловск', 'Туркестан'];

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

// Защита от подбора: считаем только неудачные входы (10 за 10 минут на IP+ник)
// и регистрации (30 за час на IP — на фестивалях много людей сидят в одной сети).
const attempts = new Map();
function hits(key, windowMs) {
  const t = now();
  const list = (attempts.get(key) || []).filter((x) => t - x < windowMs);
  attempts.set(key, list);
  return list;
}
const tooMany = (key, max, windowMs) => hits(key, windowMs).length >= max;
const remember = (key) => { (attempts.get(key) || attempts.set(key, []).get(key)).push(now()); };
setInterval(() => { for (const [k, v] of attempts) if (!v.length || now() - v.at(-1) > 3600e3) attempts.delete(k); }, 600e3).unref();

// Ссылка или @ник → просто ник (буквы, цифры, точка, _ и -)
function handle(v) {
  let s = String(v ?? '').trim().slice(0, 200);
  s = s.replace(/^https?:\/\/(www\.)?/i, '').replace(/^(instagram\.com|tiktok\.com|t\.me|telegram\.me|vk\.com|youtube\.com|m\.vk\.com)\//i, '');
  s = s.replace(/^@/, '').split(/[/?#]/)[0].replace(/^@/, '');
  return /^[A-Za-z0-9._-]{1,60}$/.test(s) ? s : '';
}
const cleanSocials = (o) => Object.fromEntries(SOCIALS.map((k) => [k, handle(o[k])]).filter(([, v]) => v));

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function main() {
  const db = await connect();
  const q = db.query;
  const one = async (sql, p) => (await q(sql, p))[0] || null;
  // Переезд: новая база пустая, а старая (Render) ещё жива — переносим всё автоматически
  const NEW_URL = process.env.NEW_DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (NEW_URL && process.env.DATABASE_URL && NEW_URL !== process.env.DATABASE_URL) {
    const { n } = await one('SELECT count(*)::int AS n FROM users');
    if (n === 0) {
      console.log('Новая база пустая — переношу данные из старой…');
      const src = pgPool(process.env.DATABASE_URL);
      try { await copyAll(src, db); console.log('Перенос завершён'); }
      catch (e) {
        // частичный перенос хуже пустой базы: очищаем, чтобы при следующем запуске перенос начался заново
        console.error('Перенос не удался, попробую при следующем запуске:', e.message);
        await db.exec(`TRUNCATE ${require('./db').TABLES.join(', ')} CASCADE`).catch(() => {});
      }
      finally { src.end().catch(() => {}); }
    }
  }
  // Только настоящие участники: демо-профили, их посты и примерные мероприятия удаляются
  await q('DELETE FROM events WHERE demo = TRUE');
  await q('DELETE FROM users WHERE demo = TRUE');
  if (DEVS.length) await q("UPDATE users SET role = 'dev', verified = TRUE WHERE username = ANY($1)", [DEVS]);
  // Дорамы заменены книгами: старые публикации-дорамы считаем сериалами
  await q("UPDATE posts SET source = 'film' WHERE source = 'drama'");
  // Платформа стала международной: проставляем страну старым записям по известным городам
  for (const t of ['users', 'events', 'threads']) {
    await q(`UPDATE ${t} SET country = 'KZ' WHERE country = '' AND city = ANY($1)`, [KZ_CITIES]);
    await q(`UPDATE ${t} SET country = 'UZ' WHERE country = '' AND city IN ('Ташкент', 'Самарканд')`);
  }
  await q("UPDATE messages SET room = 'kz' WHERE room IN ('almaty', 'astana', 'shymkent', 'aktobe', 'karaganda')");
  console.log(`База: ${db.kind}`);

  // ---------- настройки сайта (меняются в админ-панели) ----------
  const settings = {};
  for (const r of await q('SELECT key, value FROM settings')) settings[r.key] = r.value;
  async function setSetting(key, value) {
    settings[key] = value;
    await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
  }
  if (!settings.auth_secret) await setSetting('auth_secret', crypto.randomBytes(32).toString('hex'));
  // Ключи входа: переменные окружения важнее настроек из админ-панели
  const authCfg = () => ({
    google: process.env.GOOGLE_CLIENT_ID || settings.google_client_id || '',
    tgToken: process.env.TELEGRAM_BOT_TOKEN || settings.telegram_token || '',
    tgBot: process.env.TELEGRAM_BOT_NAME || settings.telegram_bot || '',
  });

  // ---------- картинки ----------
  // Проверка фото до сохранения (чтобы не создать профиль с битым фото)
  const IMG_RE = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
  function checkImage(dataUri) {
    const m = IMG_RE.exec(dataUri || '');
    if (!m) throw new HttpError(400, 'Фото должно быть в формате JPG, PNG, WEBP или GIF');
    if (m[2].length > 4_000_000) throw new HttpError(400, 'Фото слишком большое: максимум около 3 МБ');
  }
  async function saveImage(dataUri, ownerId) {
    const m = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || '');
    if (!m) throw new HttpError(400, 'Фото должно быть в формате JPG, PNG, WEBP или GIF');
    if (m[2].length > 4_000_000) throw new HttpError(400, 'Фото слишком большое: максимум около 3 МБ');
    const id = newId();
    let url = '';
    if (storage.enabled) {
      try { url = await storage.upload(id, m[1], Buffer.from(m[2], 'base64')); }
      catch (e) { console.error('Хранилище фото недоступно, сохраняю в базу:', e.message); }
    }
    await q('INSERT INTO images (id, mime, data, owner_id, created_at, url) VALUES ($1,$2,$3,$4,$5,$6)', [id, m[1], url ? '' : m[2], ownerId, now(), url]);
    return id;
  }
  // Старые фото из базы постепенно переезжают во внешнее хранилище; ссылки /img/… продолжают работать
  async function moveImages() {
    if (!storage.enabled) return;
    try { await storage.ensureBucket(); } catch (e) { console.error(e.message); return; }
    let moved = 0;
    for (;;) {
      const rows = await q("SELECT id, mime, data FROM images WHERE url = '' AND data <> '' LIMIT 10");
      if (!rows.length) break;
      for (const r of rows) {
        try {
          const url = await storage.upload(r.id, r.mime, Buffer.from(r.data, 'base64'));
          await q("UPDATE images SET url = $2, data = '' WHERE id = $1", [r.id, url]);
          moved++;
        } catch (e) { console.error('Не удалось перенести фото', r.id, e.message); return; }
      }
    }
    if (moved) console.log(`Фото перенесены в ${storage.kind}: ${moved}`);
  }
  const imgUrl = (id) => (!id ? null : id.startsWith('/') ? id : `/img/${id}`);

  // ---------- представления ----------
  const userCols = 'u.id, u.username, u.name, u.city, u.specialty, u.bio, u.avatar_id, u.color, u.role, u.demo, u.created_at, u.theme, u.country, u.verified, u.socials, u.orders_open';
  const userView = (r, prefix = '') => {
    const g = (k) => r[prefix + k];
    if (!g('id')) return null;
    return {
      id: g('id'), username: g('username'), name: g('name'), city: g('city'), specialty: g('specialty'),
      bio: g('bio'), avatar: imgUrl(g('avatar_id')), color: g('color'), role: g('role'), demo: g('demo'),
      createdAt: g('created_at'), theme: g('theme') || '', country: g('country') || '',
      verified: !!g('verified'), ordersOpen: !!g('orders_open'), socials: (() => { try { return JSON.parse(g('socials') || '{}'); } catch { return {}; } })(),
    };
  };
  const authorCols = (a = 'u', p = 'a_') =>
    ['id', 'username', 'name', 'city', 'specialty', 'bio', 'avatar_id', 'color', 'role', 'demo', 'created_at', 'theme', 'country', 'verified', 'socials', 'orders_open']
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
        caption: r.caption, materials: JSON.parse(r.materials || '[]'), hours: r.hours, demo: r.demo, source: r.source || '', charId: r.char_id || '',
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
    if (type === 'like' || type === 'follow')
      await q('DELETE FROM notifications WHERE user_id = $1 AND actor_id = $2 AND type = $3 AND post_id IS NOT DISTINCT FROM $4', [userId, actorId, type, extra.postId || null]);
    await q(
      'INSERT INTO notifications (id, user_id, actor_id, type, post_id, thread_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [newId(), userId, actorId, type, extra.postId || null, extra.threadId || null, now()]
    );
  }

  // ---------- приложение ----------
  const app = express();
  app.set('trust proxy', 1);
  // Сайт переехал на cosplaygram.kz: старый адрес на Render пересылает все ссылки туда же
  const CANONICAL = (process.env.CANONICAL_URL || 'https://cosplaygram.kz').replace(/\/+$/, '');
  app.use((req, res, next) => {
    const host = req.hostname || '';
    const code = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
    // www.cosplaygram.kz → cosplaygram.kz (вход через Telegram привязан к одному адресу)
    if (/^www\./i.test(host)) return res.redirect(code, `${req.protocol}://${host.slice(4)}${req.originalUrl}`);
    if (!/\.onrender\.com$/i.test(host) || req.path === '/healthz') return next();
    res.redirect(code, CANONICAL + req.originalUrl);
  });
  // ----- переезд на новый сервер -----
  // Новый сервер (пустая база) принимает данные один раз — только с кодом, который показал установщик.
  app.post('/api/migrate/import', express.json({ limit: '500mb' }), wrap(async (req, res) => {
    const code = String(process.env.MIGRATE_CODE || '');
    const got = String(req.headers['x-migrate-code'] || '');
    if (!code || got.length !== code.length || !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(code)))
      throw new HttpError(403, 'Неверный код переезда');
    const { n } = await one('SELECT count(*)::int AS n FROM users');
    if (n > 0) throw new HttpError(409, 'На новом сервере уже есть данные — переезд выполнен раньше');
    const { TABLES } = require('./db');
    const done = {};
    try {
      for (const t of TABLES) {
        const rows = req.body?.tables?.[t];
        if (!Array.isArray(rows) || !rows.length) continue;
        const cols = (await q("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [t])).map((r) => r.column_name);
        for (let i = 0; i < rows.length; i += t === 'images' ? 10 : 300) {
          const part = rows.slice(i, i + (t === 'images' ? 10 : 300));
          const use = Object.keys(part[0]).filter((c) => cols.includes(c));
          const vals = [];
          const ph = part.map((r, k) => '(' + use.map((c, j) => { vals.push(r[c]); return '$' + (k * use.length + j + 1); }).join(',') + ')').join(',');
          await q(`INSERT INTO ${t} (${use.join(',')}) VALUES ${ph} ON CONFLICT DO NOTHING`, vals);
        }
        done[t] = rows.length;
      }
    } catch (e) {
      await db.exec(`TRUNCATE ${TABLES.join(', ')} CASCADE`).catch(() => {});
      throw new HttpError(500, 'Перенос не удался: ' + e.message);
    }
    if (DEVS.length) await q("UPDATE users SET role = 'dev', verified = TRUE WHERE username = ANY($1)", [DEVS]);
    console.log('Переезд: данные приняты', done);
    res.json({ ok: true, done });
  }));
  app.use(express.json({ limit: '25mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders: (res, file) => { if (/\.(html|webmanifest)$|sw\.js$/.test(file)) res.setHeader('Cache-Control', 'no-cache'); },
  }));

  app.get('/img/:id', wrap(async (req, res) => {
    const r = await one('SELECT mime, data, url FROM images WHERE id = $1', [req.params.id]);
    if (!r) return res.status(404).end();
    if (r.url) { res.setHeader('Cache-Control', 'public, max-age=86400'); return res.redirect(301, r.url); }
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
  const OPEN = new Set(['/register', '/login', '/logout', '/me', '/characters', '/auth/providers', '/auth/google', '/auth/telegram', '/auth/complete']);
  // Гостям открыт просмотр: профили, работы, мероприятия с итогами и форум (писать — только после регистрации)
  const GUEST_GET = [/^\/themes(\/[a-z0-9-]+)?$/, /^\/users\/[^/]+$/, /^\/posts\/[^/]+$/, /^\/events$/, /^\/events\/[^/]+\/results$/, /^\/forum(\/[^/]+)?$/];
  const guestOk = (req) => req.method === 'GET' && (GUEST_GET.some((r) => r.test(req.path)) || (req.path === '/feed' && !!req.query.char)); // гостям — косплеи конкретного персонажа
  app.use('/api', (req, _res, next) => (OPEN.has(req.path) || guestOk(req) || req.user ? next() : next(new HttpError(401, 'Зарегистрируйтесь или войдите, чтобы пользоваться Cosplaygram'))));
  // Защита от спама: не больше 120 действий в минуту от одного участника
  app.use('/api', (req, _res, next) => {
    if (req.method === 'GET' || !req.user || ['/login', '/logout'].includes(req.path)) return next();
    const k = 'w:' + req.user.id;
    if (tooMany(k, 120, 60e3)) return next(new HttpError(429, 'Слишком много действий подряд. Подождите минуту.'));
    remember(k);
    next();
  });
  const admin = (req, _res, next) => (['admin', 'dev'].includes(req.user?.role) ? next() : next(new HttpError(403, 'Только для модераторов')));
  const isAdmin = (req) => ['admin', 'dev'].includes(req.user?.role);

  async function startSession(req, res, userId) {
    const sid = crypto.randomBytes(24).toString('hex');
    await q('INSERT INTO sessions (sid, user_id, created_at) VALUES ($1,$2,$3)', [sid, userId, now()]);
    const secure = req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 90}${secure}`);
  }
  const meView = async (id) => userView(await one(`SELECT ${userCols} FROM users u WHERE u.id = $1`, [id]));

  // ----- аккаунт -----
  // Почта: приводим к нижнему регистру и проверяем, что похожа на адрес
  const normEmail = (v) => String(v || '').trim().toLowerCase().slice(0, 200);
  const okEmail = (e) => /^[^\s@]{1,64}@[^\s@]{1,180}\.[a-z0-9-]{2,24}$/i.test(e);
  const emailFree = async (e, except = '') => !(await one('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [e, except]));

  app.post('/api/register', wrap(async (req, res) => {
    if (tooMany('reg:' + req.ip, 30, 3600e3)) throw new HttpError(429, 'Слишком много регистраций из этой сети. Попробуйте через час.');
    const username = clean(req.body.username, 30).toLowerCase();
    const password = String(req.body.password || '');
    const email = normEmail(req.body.email);
    if (!okEmail(email)) throw new HttpError(400, 'Укажите почту, например name@mail.ru');
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Ник: от 3 до 30 символов — латиница, цифры, точка или _');
    if (password.length < 8) throw new HttpError(400, 'Пароль должен быть не короче 8 символов');
    if (!(await emailFree(email))) throw new HttpError(409, 'На эту почту уже есть профиль — просто войдите');
    if (await one('SELECT 1 FROM users WHERE username = $1', [username])) throw new HttpError(409, 'Этот ник уже занят');
    if (req.body.avatar) checkImage(req.body.avatar);
    const real = await one('SELECT count(*)::int AS n FROM users WHERE demo = FALSE');
    const role = DEVS.includes(username) ? 'dev' : ADMINS.includes(username) || real.n === 0 ? 'admin' : 'user';
    const id = newId();
    await q(
      `INSERT INTO users (id, username, password, name, city, specialty, color, role, created_at, theme, country, verified, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, username, hashPassword(password), clean(req.body.name, 60) || username, clean(req.body.city, 40),
        clean(req.body.specialty, 60), COLORS[Math.floor(Math.random() * COLORS.length)], role, now(), themeId(req.body.theme), COUNTRIES.valid(req.body.country), role === 'dev', email]
    );
    if (req.body.avatar) await q('UPDATE users SET avatar_id = $2 WHERE id = $1', [id, await saveImage(req.body.avatar, id)]);
    remember('reg:' + req.ip);
    await startSession(req, res, id);
    res.json({ user: await meView(id) });
  }));

  app.post('/api/login', wrap(async (req, res) => {
    // входить можно по почте или по нику
    const raw = String(req.body.username || req.body.email || '').trim().toLowerCase();
    const byMail = raw.includes('@') && !raw.startsWith('@');
    const name = byMail ? normEmail(raw) : clean(raw, 30).replace(/^@/, '');
    const key = `login:${req.ip}:${name}`;
    if (tooMany(key, 10, 600e3)) throw new HttpError(429, 'Слишком много неудачных попыток. Подождите 10 минут.');
    const u = await one(`SELECT id, password FROM users WHERE ${byMail ? 'email' : 'username'} = $1`, [name]);
    if (!u || !checkPassword(String(req.body.password || ''), u.password)) { remember(key); throw new HttpError(401, byMail ? 'Неверная почта или пароль' : 'Неверный ник или пароль'); }
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
    if (!req.user) return res.json({ user: null, unread: 0, unreadDm: 0 });
    const r = await one(
      `SELECT (SELECT count(*)::int FROM notifications WHERE user_id = $1 AND read = FALSE) AS n,
              (SELECT count(*)::int FROM dms WHERE to_id = $1 AND read = FALSE) AS d`, [req.user.id]);
    res.json({ user: req.user, unread: r.n, unreadDm: r.d });
  }));

  app.patch('/api/me', auth, wrap(async (req, res) => {
    const b = req.body;
    const u = req.user;
    const avatarId = b.avatar ? await saveImage(b.avatar, u.id) : null;
    await q(
      `UPDATE users SET name = $2, city = $3, specialty = $4, bio = $5, color = $6, avatar_id = COALESCE($7, avatar_id), theme = $8, country = $9, socials = $10, orders_open = $11 WHERE id = $1`,
      [u.id, clean(b.name ?? u.name, 60) || u.username, clean(b.city ?? u.city, 40), clean(b.specialty ?? u.specialty, 60),
        clean(b.bio ?? u.bio, 300), COLORS.includes(b.color) ? b.color : u.color, avatarId, 'theme' in b ? themeId(b.theme) : u.theme, 'country' in b ? COUNTRIES.valid(b.country) : u.country,
        JSON.stringify(b.socials && typeof b.socials === 'object' ? cleanSocials(b.socials) : u.socials || {}),
        'ordersOpen' in b ? !!b.ordersOpen && b.ordersOpen !== '0' : u.ordersOpen]
    );
    res.json({ user: await meView(u.id) });
  }));

  app.post('/api/me/password', auth, wrap(async (req, res) => {
    const u = await one('SELECT password FROM users WHERE id = $1', [req.user.id]);
    // Кто зарегистрировался через Google/Telegram, задаёт пароль впервые — без текущего
    if (u.password && !checkPassword(String(req.body.current || ''), u.password)) throw new HttpError(400, 'Текущий пароль указан неверно');
    if (String(req.body.next || '').length < 8) throw new HttpError(400, 'Новый пароль должен быть не короче 8 символов');
    await q('UPDATE users SET password = $2 WHERE id = $1', [req.user.id, hashPassword(String(req.body.next))]);
    res.json({ ok: true });
  }));

  // Почта для входа (видна только самому участнику)
  app.post('/api/me/email', auth, wrap(async (req, res) => {
    const email = normEmail(req.body.email);
    if (!okEmail(email)) throw new HttpError(400, 'Укажите почту, например name@mail.ru');
    if (!(await emailFree(email, req.user.id))) throw new HttpError(409, 'Эта почта уже привязана к другому профилю');
    await q('UPDATE users SET email = $2 WHERE id = $1', [req.user.id, email]);
    res.json({ ok: true, email });
  }));

  // ----- вход через Google и Telegram -----
  const PROVIDERS = { google: 'Google', telegram: 'Telegram' };
  const b64u = (b) => Buffer.from(b).toString('base64url');
  // Билет на регистрацию: подписанный сервером, живёт 30 минут
  const signTicket = (data) => {
    const body = b64u(JSON.stringify({ ...data, exp: now() + 30 * 60e3 }));
    return body + '.' + crypto.createHmac('sha256', settings.auth_secret).update(body).digest('base64url');
  };
  const readTicket = (t) => {
    const [body, sig] = String(t || '').split('.');
    const good = body && sig && crypto.createHmac('sha256', settings.auth_secret).update(body).digest('base64url');
    if (!good || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) throw new HttpError(400, 'Начните вход заново');
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!(d.exp > now())) throw new HttpError(400, 'Время вышло — начните вход заново');
    return d;
  };
  // Свободный ник по имени из Google/Telegram
  async function freeUsername(raw) {
    let base = String(raw || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').replace(/^[._]+|[._]+$/g, '').slice(0, 24);
    if (base.length < 3) base = 'cosplayer';
    for (let i = 0; i < 20; i++) {
      const name = i ? `${base}${Math.floor(Math.random() * 9000) + 100}` : base;
      if (!(await one('SELECT 1 FROM users WHERE username = $1', [name]))) return name;
    }
    return 'cosplayer' + newId().slice(0, 6);
  }
  // Аватар из Google/Telegram — только с их серверов
  async function fetchAvatar(url, ownerId) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || !/(^|\.)(googleusercontent\.com|t\.me|telegram\.org|telesco\.pe)$/i.test(u.hostname)) return null;
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 2_500_000) return null;
      return await saveImage(`data:${type};base64,${buf.toString('base64')}`, ownerId);
    } catch { return null; }
  }
  // Общий шаг: войти, привязать к текущему профилю или выдать билет на регистрацию
  async function socialDone(req, res, p) {
    const known = await one('SELECT user_id FROM identities WHERE provider = $1 AND subject = $2', [p.provider, p.subject]);
    if (req.user) {
      if (known && known.user_id !== req.user.id) throw new HttpError(409, `Этот аккаунт ${PROVIDERS[p.provider]} уже привязан к другому профилю Cosplaygram`);
      if (!known) {
        await q('DELETE FROM identities WHERE user_id = $1 AND provider = $2', [req.user.id, p.provider]);
        await q('INSERT INTO identities (provider, subject, user_id, label, created_at) VALUES ($1,$2,$3,$4,$5)', [p.provider, p.subject, req.user.id, p.label, now()]);
      }
      return res.json({ user: await meView(req.user.id), linked: true });
    }
    if (known) {
      await startSession(req, res, known.user_id);
      return res.json({ user: await meView(known.user_id) });
    }
    res.json({ signup: { ticket: signTicket(p), provider: p.provider, name: p.name, avatar: /^https:\/\//.test(p.avatar || '') ? p.avatar : null, username: await freeUsername(p.suggest) } });
  }
  const socialLimit = (req) => {
    const k = 'soc:' + req.ip;
    if (tooMany(k, 40, 600e3)) throw new HttpError(429, 'Слишком много попыток входа. Подождите 10 минут.');
    remember(k);
  };

  app.get('/api/auth/providers', (_req, res) => {
    const c = authCfg();
    const tg = c.tgToken && c.tgBot ? c.tgBot : null;
    res.json({ google: c.google || null, telegram: tg, telegramId: tg ? String(c.tgToken).split(':')[0] : null });
  });

  app.post('/api/auth/google', wrap(async (req, res) => {
    socialLimit(req);
    const { google } = authCfg();
    if (!google) throw new HttpError(400, 'Вход через Google ещё не включён');
    const cred = clean(req.body.credential, 5000);
    if (!cred) throw new HttpError(400, 'Google не прислал данные входа');
    let p;
    try {
      const r = await fetch((process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo') + '?id_token=' + encodeURIComponent(cred), { signal: AbortSignal.timeout(10000) });
      p = r.ok ? await r.json() : null;
    } catch { throw new HttpError(502, 'Google не отвечает. Попробуйте ещё раз.'); }
    if (!p || p.aud !== google || !['accounts.google.com', 'https://accounts.google.com'].includes(p.iss) || !(Number(p.exp) * 1000 > now()) || !p.sub)
      throw new HttpError(401, 'Google не подтвердил вход. Попробуйте ещё раз.');
    await socialDone(req, res, {
      provider: 'google', subject: String(p.sub), label: clean(p.email, 120), name: clean(p.name || p.given_name, 60),
      avatar: clean(p.picture, 500), suggest: String(p.email || '').split('@')[0],
    });
  }));

  app.post('/api/auth/telegram', wrap(async (req, res) => {
    socialLimit(req);
    const { tgToken } = authCfg();
    if (!tgToken) throw new HttpError(400, 'Вход через Telegram ещё не включён');
    const d = req.body && typeof req.body === 'object' ? req.body : {};
    const fields = Object.entries(d).filter(([k, v]) => k !== 'hash' && /^[a-z_]{1,30}$/.test(k) && ['string', 'number'].includes(typeof v));
    const check = fields.sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHash('sha256').update(tgToken).digest();
    const good = crypto.createHmac('sha256', secret).update(check).digest('hex');
    const hash = String(d.hash || '');
    if (hash.length !== good.length || !crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(good))) throw new HttpError(401, 'Telegram не подтвердил вход. Попробуйте ещё раз.');
    if (!(Number(d.auth_date) * 1000 > now() - 86400e3)) throw new HttpError(401, 'Вход через Telegram устарел — нажмите кнопку ещё раз');
    if (!/^\d{1,20}$/.test(String(d.id))) throw new HttpError(400, 'Telegram прислал странные данные');
    const name = clean([d.first_name, d.last_name].filter(Boolean).join(' '), 60);
    await socialDone(req, res, {
      provider: 'telegram', subject: String(d.id), label: d.username ? '@' + clean(d.username, 40) : name, name,
      avatar: clean(d.photo_url, 500), suggest: d.username || '',
    });
  }));

  // Регистрация после Google/Telegram: ник, страна, город — пароль не нужен
  app.post('/api/auth/complete', wrap(async (req, res) => {
    const t = readTicket(req.body.ticket);
    if (!PROVIDERS[t.provider]) throw new HttpError(400, 'Начните вход заново');
    if (tooMany('reg:' + req.ip, 30, 3600e3)) throw new HttpError(429, 'Слишком много регистраций из этой сети. Попробуйте через час.');
    const username = clean(req.body.username, 30).toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new HttpError(400, 'Ник: от 3 до 30 символов — латиница, цифры, точка или _');
    if (await one('SELECT 1 FROM users WHERE username = $1', [username])) throw new HttpError(409, 'Этот ник уже занят');
    if (await one('SELECT 1 FROM identities WHERE provider = $1 AND subject = $2', [t.provider, t.subject])) throw new HttpError(409, 'Этот аккаунт уже зарегистрирован — просто войдите');
    if (req.body.avatar) checkImage(req.body.avatar);
    const real = await one('SELECT count(*)::int AS n FROM users WHERE demo = FALSE');
    const role = DEVS.includes(username) ? 'dev' : ADMINS.includes(username) || real.n === 0 ? 'admin' : 'user';
    const id = newId();
    await q(
      `INSERT INTO users (id, username, password, name, city, specialty, color, role, created_at, theme, country, verified)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, username, clean(req.body.name, 60) || t.name || username, clean(req.body.city, 40), clean(req.body.specialty, 60),
        COLORS[Math.floor(Math.random() * COLORS.length)], role, now(), themeId(req.body.theme), COUNTRIES.valid(req.body.country), role === 'dev']
    );
    await q('INSERT INTO identities (provider, subject, user_id, label, created_at) VALUES ($1,$2,$3,$4,$5)', [t.provider, t.subject, id, t.label || '', now()]);
    // почту из Google сразу сохраняем — по ней можно будет входить, если задать пароль
    const gmail = t.provider === 'google' ? normEmail(t.label) : '';
    if (okEmail(gmail) && (await emailFree(gmail))) await q('UPDATE users SET email = $2 WHERE id = $1', [id, gmail]);
    remember('reg:' + req.ip);
    // своё фото важнее фото из Google/Telegram
    const av = req.body.avatar ? await saveImage(req.body.avatar, id) : t.avatar ? await fetchAvatar(t.avatar, id) : null;
    if (av) await q('UPDATE users SET avatar_id = $2 WHERE id = $1', [id, av]);
    await startSession(req, res, id);
    res.json({ user: await meView(id) });
  }));

  // Какие способы входа привязаны к моему профилю
  app.get('/api/me/identities', auth, wrap(async (req, res) => {
    const rows = await q('SELECT provider, label, created_at FROM identities WHERE user_id = $1 ORDER BY created_at', [req.user.id]);
    const u = await one('SELECT password, email FROM users WHERE id = $1', [req.user.id]);
    res.json({ identities: rows.map((r) => ({ provider: r.provider, label: r.label, createdAt: r.created_at })), hasPassword: !!u.password, email: u.email || '' });
  }));
  app.delete('/api/me/identities/:provider', auth, wrap(async (req, res) => {
    const rows = await q('SELECT provider FROM identities WHERE user_id = $1', [req.user.id]);
    const u = await one('SELECT password FROM users WHERE id = $1', [req.user.id]);
    if (!u.password && rows.filter((r) => r.provider !== req.params.provider).length === 0)
      throw new HttpError(400, 'Сначала задайте пароль ниже — иначе не сможете войти в профиль');
    await q('DELETE FROM identities WHERE user_id = $1 AND provider = $2', [req.user.id, req.params.provider]);
    res.json({ ok: true });
  }));

  // Ключи входа — только разработчик
  app.get('/api/admin/auth', auth, admin, wrap(async (req, res) => {
    if (req.user.role !== 'dev') throw new HttpError(403, 'Только для разработчика');
    const c = authCfg();
    const counts = Object.fromEntries((await q('SELECT provider, count(*)::int AS n FROM identities GROUP BY provider')).map((r) => [r.provider, r.n]));
    res.json({ google: c.google, telegramBot: c.tgBot, telegramToken: !!c.tgToken, counts, origin: `${req.protocol}://${req.hostname}` });
  }));
  app.post('/api/admin/auth', auth, admin, wrap(async (req, res) => {
    if (req.user.role !== 'dev') throw new HttpError(403, 'Только для разработчика');
    const b = req.body || {};
    if (b.clear === 'google') await setSetting('google_client_id', '');
    if (b.clear === 'telegram') { await setSetting('telegram_token', ''); await setSetting('telegram_bot', ''); }
    if (typeof b.google === 'string' && b.google.trim()) {
      const id = b.google.trim();
      if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id)) throw new HttpError(400, 'Client ID Google выглядит так: 1234567890-abc123.apps.googleusercontent.com');
      await setSetting('google_client_id', id);
    }
    if (typeof b.telegramToken === 'string' && b.telegramToken.trim()) {
      const token = b.telegramToken.trim();
      if (!/^\d{5,15}:[A-Za-z0-9_-]{30,50}$/.test(token)) throw new HttpError(400, 'Токен бота выглядит так: 1234567890:AAH… — скопируйте его из сообщения @BotFather целиком');
      let bot = null;
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(10000) });
        bot = (await r.json()).result;
      } catch { throw new HttpError(502, 'Telegram не отвечает. Попробуйте ещё раз.'); }
      if (!bot?.username) throw new HttpError(400, 'Telegram не принял этот токен — проверьте, что скопировали его целиком');
      await setSetting('telegram_token', token);
      await setSetting('telegram_bot', bot.username);
    }
    const c = authCfg();
    res.json({ google: c.google, telegramBot: c.tgBot, telegramToken: !!c.tgToken });
  }));

  // ----- посты -----
  app.get('/api/feed', wrap(async (req, res) => {
    const conds = [];
    const params = [];
    if (req.query.kind === 'process' || req.query.kind === 'costume') { params.push(req.query.kind); conds.push(`p.kind = $${params.length}`); }
    if (themeId(req.query.char)) { params.push(themeId(req.query.char)); conds.push(`p.char_id = $${params.length}`); }
    if (SOURCES.includes(req.query.source)) { params.push(req.query.source); conds.push(`p.source = $${params.length}`); }
    if (req.query.mode === 'following' && req.user) {
      params.push(req.user.id);
      conds.push(`(p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $${params.length}) OR p.author_id = $${params.length})`);
    }
    if (COUNTRIES.valid(req.query.country)) { params.push(COUNTRIES.valid(req.query.country)); conds.push(`u.country = $${params.length}`); }
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
      `INSERT INTO posts (id, author_id, kind, character, fandom, caption, materials, hours, created_at, source, char_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id, req.user.id, req.body.kind === 'process' ? 'process' : 'costume', clean(req.body.character, 80),
        clean(req.body.fandom, 80), clean(req.body.caption, 2200), JSON.stringify(materials),
        Math.max(0, Math.min(5000, parseInt(req.body.hours, 10) || 0)), now(), SOURCES.includes(req.body.source) ? req.body.source : '', themeId(req.body.charId)]
    );
    for (const [i, imgId] of imageIds.entries())
      await q('INSERT INTO post_images (post_id, idx, image_id, caption) VALUES ($1,$2,$3,$4)', [id, i, imgId, clean(slides[i].caption, 300)]);
    const [post] = await loadPosts('WHERE p.id = $1', [id], req.user.id, { limit: 1 });
    res.json({ post });
  }));

  app.patch('/api/posts/:id', auth, wrap(async (req, res) => {
    const p = await one('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!p) throw new HttpError(404, 'Публикация не найдена');
    if (p.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Изменить можно только свою публикацию');
    const b = req.body;
    const materials = 'materials' in b
      ? JSON.stringify(clean(b.materials, 300).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 12))
      : p.materials;
    await q(
      `UPDATE posts SET character = $2, fandom = $3, caption = $4, materials = $5, hours = $6, source = $7, char_id = $8 WHERE id = $1`,
      [p.id, clean(b.character ?? p.character, 80), clean(b.fandom ?? p.fandom, 80), clean(b.caption ?? p.caption, 2200), materials,
        'hours' in b ? Math.max(0, Math.min(5000, parseInt(b.hours, 10) || 0)) : p.hours,
        'source' in b ? (SOURCES.includes(b.source) ? b.source : '') : p.source,
        'charId' in b ? themeId(b.charId) : p.char_id]
    );
    if (Array.isArray(b.captions))
      for (const [i, c] of b.captions.slice(0, 10).entries())
        await q('UPDATE post_images SET caption = $3 WHERE post_id = $1 AND idx = $2', [p.id, i, clean(c, 300)]);
    const [post] = await loadPosts('WHERE p.id = $1', [p.id], req.user.id, { limit: 1, comments: 0 });
    res.json({ post });
  }));

  app.delete('/api/posts/:id', auth, wrap(async (req, res) => {
    const p = await one('SELECT author_id FROM posts WHERE id = $1', [req.params.id]);
    if (!p) throw new HttpError(404, 'Публикация не найдена');
    if (p.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалить можно только свою публикацию');
    const imgs = await q('SELECT image_id FROM post_images WHERE post_id = $1', [req.params.id]);
    await q('DELETE FROM posts WHERE id = $1', [req.params.id]);
    const own = imgs.map((r) => r.image_id).filter((x) => !x.startsWith('/'));
    if (own.length) await q('DELETE FROM images WHERE id = ANY($1)', [own]);
    await q('DELETE FROM notifications WHERE post_id = $1', [req.params.id]);
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
  // Кого подписаться: свой город и страна, кто подписан на вас, общие подписки, активные и подтверждённые
  app.get('/api/suggestions', auth, wrap(async (req, res) => {
    const me = req.user;
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const rows = await q(
      `SELECT ${userCols},
         (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS followers,
         (SELECT count(*)::int FROM posts p WHERE p.author_id = u.id) AS posts,
         EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followee_id = $1) AS follows_me,
         (SELECT count(*)::int FROM follows a JOIN follows b ON b.follower_id = a.followee_id WHERE a.follower_id = $1 AND b.followee_id = u.id) AS mutual
       FROM users u
       WHERE u.id <> $1 AND u.demo = FALSE
         AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id)
       ORDER BY u.created_at DESC LIMIT 400`, [me.id]);
    const city = String(me.city || '').trim().toLowerCase();
    const scored = rows.map((r) => {
      const sameCity = city && String(r.city || '').trim().toLowerCase() === city;
      const sameCountry = me.country && r.country === me.country;
      const score = (r.follows_me ? 6 : 0) + Math.min(r.mutual, 5) * 2 + (sameCity ? 4 : sameCountry ? 2 : 0) + (r.verified ? 2 : 0)
        + Math.min(r.followers, 50) * 0.08 + Math.min(r.posts, 30) * 0.12 + (r.avatar_id ? 0.5 : 0) + (r.orders_open ? 0.5 : 0);
      const reason = r.follows_me ? 'Подписан(а) на вас' : r.mutual ? `Общих подписок: ${r.mutual}` : sameCity ? 'Из вашего города'
        : sameCountry ? 'Из вашей страны' : r.verified ? 'Подтверждённый косплеер' : r.posts ? 'Публикует работы' : 'Новый участник';
      return { ...userView(r), followers: r.followers, posts: r.posts, reason, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const { n } = await one('SELECT count(*)::int AS n FROM follows WHERE follower_id = $1', [me.id]);
    res.json({ users: scored.slice(0, limit).map(({ score, ...u }) => u), following: n });
  }));

  app.get('/api/users', wrap(async (req, res) => {
    const rows = await q(
      `SELECT ${userCols}, (SELECT count(*)::int FROM follows f WHERE f.followee_id = u.id) AS followers,
         (SELECT round(avg(rating)::numeric, 1)::float FROM reviews v WHERE v.master_id = u.id) AS rating,
         (SELECT count(*)::int FROM reviews v WHERE v.master_id = u.id) AS reviews
       FROM users u ORDER BY u.verified DESC, followers DESC, u.created_at DESC LIMIT 100`
    );
    res.json({ users: rows.map((r) => ({ ...userView(r), followers: r.followers, rating: r.rating, reviews: r.reviews })) });
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
    const services = await q('SELECT id, title, price, currency, days, note FROM services WHERE user_id = $1 ORDER BY created_at', [user.id]);
    const reviews = await q(
      `SELECT v.rating, v.text, v.created_at, o.title, ${authorCols()} FROM reviews v JOIN orders o ON o.id = v.order_id JOIN users u ON u.id = v.client_id
       WHERE v.master_id = $1 ORDER BY v.created_at DESC LIMIT 30`, [user.id]);
    const rt = await one('SELECT round(avg(rating)::numeric, 1)::float AS avg, count(*)::int AS n FROM reviews WHERE master_id = $1', [user.id]);
    res.json({ user, posts, achievements: await loadAchievements(user.id), services,
      reviews: reviews.map((v) => ({ rating: v.rating, text: v.text, createdAt: v.created_at, title: v.title, author: userView(v, 'a_') })),
      rating: { avg: rt.avg, count: rt.n }, stats: { posts: posts.length, followers: s.followers, following: s.following, likes: s.likes }, isFollowing: s.is_following });
  }));

  // Достижения: добавленные самим участником + подтверждённые итогами мероприятий на сайте
  async function loadAchievements(userId) {
    const own = await q('SELECT * FROM achievements WHERE user_id = $1 ORDER BY year DESC, created_at DESC', [userId]);
    const won = await q(
      `SELECT r.id, r.nomination, r.place, e.id AS event_id, e.title, e.date FROM event_results r JOIN events e ON e.id = r.event_id
       WHERE r.user_id = $1 ORDER BY e.date DESC`, [userId]);
    return [
      ...won.map((r) => ({ id: 'r:' + r.id, kind: 'place', event: r.title, year: r.date.slice(0, 4), title: [r.place, r.nomination].filter(Boolean).join(' — '), verified: true, eventId: r.event_id })),
      ...own.map((a) => ({ id: a.id, kind: a.kind, event: a.event, year: a.year, title: a.title, verified: false })),
    ].sort((a, b) => String(b.year).localeCompare(String(a.year)));
  }
  app.post('/api/me/achievements', auth, wrap(async (req, res) => {
    const event = clean(req.body.event, 100);
    if (!event) throw new HttpError(400, 'Укажите фестиваль или мероприятие');
    const n = await one('SELECT count(*)::int AS n FROM achievements WHERE user_id = $1', [req.user.id]);
    if (n.n >= 60) throw new HttpError(400, 'Слишком много достижений');
    const year = /^\d{4}$/.test(String(req.body.year || '').trim()) ? String(req.body.year).trim() : '';
    await q('INSERT INTO achievements (id, user_id, kind, event, year, title, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
      newId(), req.user.id, ACH_KINDS.includes(req.body.kind) ? req.body.kind : 'other', event, year, clean(req.body.title, 120), now()]);
    res.json({ achievements: await loadAchievements(req.user.id) });
  }));
  app.delete('/api/me/achievements/:id', auth, wrap(async (req, res) => {
    await q('DELETE FROM achievements WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ achievements: await loadAchievements(req.user.id) });
  }));

  // ----- услуги и заказы у мастеров -----
  app.post('/api/me/services', auth, wrap(async (req, res) => {
    const title = clean(req.body.title, 80);
    if (!title) throw new HttpError(400, 'Напишите, что вы делаете на заказ');
    const { n } = await one('SELECT count(*)::int AS n FROM services WHERE user_id = $1', [req.user.id]);
    if (n >= 20) throw new HttpError(400, 'Не больше 20 услуг');
    await q('INSERT INTO services (id, user_id, title, price, currency, days, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
      newId(), req.user.id, title, Math.max(0, Math.min(100_000_000, parseInt(String(req.body.price).replace(/\D/g, ''), 10) || 0)),
      CURRENCIES.includes(req.body.currency) ? req.body.currency : 'KZT', Math.max(0, Math.min(365, parseInt(req.body.days, 10) || 0)), clean(req.body.note, 200), now()]);
    res.json({ services: await q('SELECT id, title, price, currency, days, note FROM services WHERE user_id = $1 ORDER BY created_at', [req.user.id]) });
  }));
  app.delete('/api/me/services/:id', auth, wrap(async (req, res) => {
    await q('DELETE FROM services WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ services: await q('SELECT id, title, price, currency, days, note FROM services WHERE user_id = $1 ORDER BY created_at', [req.user.id]) });
  }));
  app.post('/api/users/:username/orders', auth, wrap(async (req, res) => {
    const m = await one('SELECT id, orders_open FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!m) throw new HttpError(404, 'Мастер не найден');
    if (m.id === req.user.id) throw new HttpError(400, 'Нельзя заказать у себя');
    if (!m.orders_open) throw new HttpError(400, 'Мастер сейчас не принимает заказы');
    const title = clean(req.body.title, 120);
    if (!title) throw new HttpError(400, 'Опишите, что нужно сделать');
    const { n } = await one("SELECT count(*)::int AS n FROM orders WHERE client_id = $1 AND master_id = $2 AND status = 'new'", [req.user.id, m.id]);
    if (n >= 3) throw new HttpError(400, 'У вас уже есть заявки, которые мастер пока не посмотрел');
    const id = newId();
    const svc = req.body.serviceId ? await one('SELECT id FROM services WHERE id = $1 AND user_id = $2', [req.body.serviceId, m.id]) : null;
    await q('INSERT INTO orders (id, master_id, client_id, service_id, title, details, budget, deadline, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)', [
      id, m.id, req.user.id, svc?.id || null, title, clean(req.body.details, 2000), clean(req.body.budget, 60),
      /^\d{4}-\d{2}-\d{2}$/.test(req.body.deadline || '') ? req.body.deadline : '', 'new', now()]);
    await notify(m.id, req.user.id, 'order');
    res.json({ ok: true, id });
  }));
  async function loadOrders(where, params) {
    const rows = await q(
      `SELECT o.*, ${authorCols('mu', 'm_')}, ${authorCols('cu', 'c_')}, v.rating AS review_rating, v.text AS review_text
       FROM orders o JOIN users mu ON mu.id = o.master_id JOIN users cu ON cu.id = o.client_id LEFT JOIN reviews v ON v.order_id = o.id
       ${where} ORDER BY o.updated_at DESC LIMIT 100`, params);
    return rows.map((o) => ({ id: o.id, title: o.title, details: o.details, budget: o.budget, deadline: o.deadline, status: o.status,
      createdAt: o.created_at, updatedAt: o.updated_at, master: userView(o, 'm_'), client: userView(o, 'c_'),
      review: o.review_rating ? { rating: o.review_rating, text: o.review_text } : null }));
  }
  app.get('/api/orders', auth, wrap(async (req, res) => {
    res.json({ incoming: await loadOrders('WHERE o.master_id = $1', [req.user.id]), outgoing: await loadOrders('WHERE o.client_id = $1', [req.user.id]) });
  }));
  app.post('/api/orders/:id/status', auth, wrap(async (req, res) => {
    const o = await one('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!o) throw new HttpError(404, 'Заказ не найден');
    const to = req.body.status;
    const isMaster = o.master_id === req.user.id, isClient = o.client_id === req.user.id;
    const ok = (isMaster && ((o.status === 'new' && ['accepted', 'declined'].includes(to)) || (o.status === 'accepted' && to === 'done')))
      || (isClient && ['new', 'accepted'].includes(o.status) && to === 'cancelled');
    if (!ORDER_STATUSES.includes(to) || !ok) throw new HttpError(400, 'Так изменить заказ нельзя');
    await q('UPDATE orders SET status = $2, updated_at = $3 WHERE id = $1', [o.id, to, now()]);
    await notify(isMaster ? o.client_id : o.master_id, req.user.id, 'order_' + to);
    res.json({ ok: true });
  }));
  app.post('/api/orders/:id/review', auth, wrap(async (req, res) => {
    const o = await one('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (!o || o.client_id !== req.user.id) throw new HttpError(404, 'Заказ не найден');
    if (o.status !== 'done') throw new HttpError(400, 'Отзыв можно оставить, когда мастер отметит заказ выполненным');
    const rating = parseInt(req.body.rating, 10);
    if (!(rating >= 1 && rating <= 5)) throw new HttpError(400, 'Поставьте оценку от 1 до 5');
    if (await one('SELECT 1 FROM reviews WHERE order_id = $1', [o.id])) throw new HttpError(400, 'Отзыв уже оставлен');
    await q('INSERT INTO reviews (order_id, master_id, client_id, rating, text, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [o.id, o.master_id, o.client_id, rating, clean(req.body.text, 1000), now()]);
    await notify(o.master_id, req.user.id, 'review');
    res.json({ ok: true });
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
      `SELECT t.id, t.category, t.city, t.country, t.title, t.demo, t.created_at, ${authorCols()},
        (SELECT count(*)::int FROM replies r WHERE r.thread_id = t.id) AS reply_count,
        COALESCE((SELECT max(r.created_at) FROM replies r WHERE r.thread_id = t.id), t.created_at) AS last_at
       FROM threads t JOIN users u ON u.id = t.author_id ORDER BY last_at DESC LIMIT 200`
    );
    res.json({
      threads: rows.map((r) => ({
        id: r.id, category: r.category, city: r.city, country: r.country, title: r.title, demo: r.demo, createdAt: r.created_at,
        author: userView(r, 'a_'), replyCount: r.reply_count, lastAt: r.last_at,
      })),
    });
  }));
  async function loadThread(id) {
    const t = await one(`SELECT t.*, ${authorCols()} FROM threads t JOIN users u ON u.id = t.author_id WHERE t.id = $1`, [id]);
    if (!t) throw new HttpError(404, 'Тема не найдена');
    const replies = await q(`SELECT r.*, ${authorCols()} FROM replies r JOIN users u ON u.id = r.author_id WHERE r.thread_id = $1 ORDER BY r.created_at`, [id]);
    return {
      id: t.id, authorId: t.author_id, category: t.category, city: t.city, country: t.country, title: t.title, body: t.body, demo: t.demo,
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
    await q('INSERT INTO threads (id, author_id, category, city, title, body, created_at, country) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
      id, req.user.id, CATEGORIES.includes(req.body.category) ? req.body.category : 'other', clean(req.body.city, 40), title, body, now(),
      'country' in req.body ? COUNTRIES.valid(req.body.country) : req.user.country,
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

  // ----- мероприятия -----
  app.get('/api/events', wrap(async (req, res) => {
    const rows = await q(
      `SELECT e.*, (SELECT count(*)::int FROM event_going g WHERE g.event_id = e.id) AS going_count,
         (SELECT count(*)::int FROM event_results x WHERE x.event_id = e.id) AS results_count,
         EXISTS (SELECT 1 FROM event_going g WHERE g.event_id = e.id AND g.user_id = $1) AS going
       FROM events e ORDER BY e.date`, [req.user?.id || '']);
    res.json({ events: rows.map((e) => ({ ...e, authorId: e.author_id, goingCount: e.going_count, resultsCount: e.results_count })) });
  }));
  app.post('/api/events/:id/going', auth, wrap(async (req, res) => {
    if (!(await one('SELECT 1 FROM events WHERE id = $1', [req.params.id]))) throw new HttpError(404, 'Мероприятие не найдено');
    const del = await q('DELETE FROM event_going WHERE event_id = $1 AND user_id = $2 RETURNING 1', [req.params.id, req.user.id]);
    if (!del.length) await q('INSERT INTO event_going (event_id, user_id, created_at) VALUES ($1,$2,$3)', [req.params.id, req.user.id, now()]);
    const { n } = await one('SELECT count(*)::int AS n FROM event_going WHERE event_id = $1', [req.params.id]);
    res.json({ going: !del.length, goingCount: n });
  }));
  app.post('/api/events', auth, wrap(async (req, res) => {
    const title = clean(req.body.title, 120);
    const date = clean(req.body.date, 10);
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) throw new HttpError(400, 'Укажите название и дату мероприятия');
    const type = EVENT_TYPES.includes(req.body.type) ? req.body.type : 'festival';
    const link = /^https?:\/\//.test(req.body.link || '') ? clean(req.body.link, 300) : '';
    await q(
      'INSERT INTO events (id, title, date, city, place, type, link, note, author_id, created_at, country, major) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [newId(), title, date, clean(req.body.city, 40), clean(req.body.place, 120), type, link, clean(req.body.note, 300), req.user.id, now(),
        'country' in req.body ? COUNTRIES.valid(req.body.country) : req.user.country, isAdmin(req) && !!req.body.major]
    );
    res.json({ ok: true });
  }));
  app.post('/api/admin/events/:id/major', auth, admin, wrap(async (req, res) => {
    const r = await q('UPDATE events SET major = NOT major WHERE id = $1 RETURNING major', [req.params.id]);
    if (!r.length) throw new HttpError(404, 'Мероприятие не найдено');
    res.json({ major: r[0].major });
  }));
  // ----- итоги: победители по номинациям -----
  async function loadResults(eventId) {
    const rows = await q(
      `SELECT r.*, ${authorCols()} FROM event_results r LEFT JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 ORDER BY r.created_at`, [eventId]);
    return rows.map((r) => ({ id: r.id, nomination: r.nomination, place: r.place, name: r.name, link: r.link, user: userView(r, 'a_') }));
  }
  const canEditEvent = async (req, id) => {
    const e = await one('SELECT author_id FROM events WHERE id = $1', [id]);
    if (!e) throw new HttpError(404, 'Мероприятие не найдено');
    if (e.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Итоги может заполнять автор мероприятия или модератор');
  };
  app.get('/api/events/:id/results', wrap(async (req, res) => res.json({ results: await loadResults(req.params.id) })));
  app.post('/api/events/:id/results', auth, wrap(async (req, res) => {
    await canEditEvent(req, req.params.id);
    const nomination = clean(req.body.nomination, 100);
    const who = clean(req.body.who, 80);
    if (!nomination || !who) throw new HttpError(400, 'Укажите номинацию и участника');
    const u = await one('SELECT id, username FROM users WHERE username = $1', [who.replace(/^@/, '').toLowerCase()]);
    let link = clean(req.body.link, 200);
    if (link && !/^https?:\/\//.test(link)) { const h = handle(link); link = h ? 'https://instagram.com/' + h : ''; }
    await q('INSERT INTO event_results (id, event_id, nomination, place, user_id, name, link, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
      newId(), req.params.id, nomination, clean(req.body.place, 40), u?.id || null, u ? '' : who, link, now()]);
    res.json({ results: await loadResults(req.params.id) });
  }));
  app.delete('/api/results/:id', auth, wrap(async (req, res) => {
    const r = await one('SELECT event_id FROM event_results WHERE id = $1', [req.params.id]);
    if (!r) throw new HttpError(404, 'Запись не найдена');
    await canEditEvent(req, r.event_id);
    await q('DELETE FROM event_results WHERE id = $1', [req.params.id]);
    res.json({ results: await loadResults(r.event_id) });
  }));
  app.delete('/api/events/:id', auth, wrap(async (req, res) => {
    const e = await one('SELECT author_id FROM events WHERE id = $1', [req.params.id]);
    if (!e) throw new HttpError(404, 'Мероприятие не найдено');
    if (e.author_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалить можно только своё мероприятие');
    await q('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));

  // ----- персонажи: фото косплея от участников и обложки модератора -----
  app.get('/api/characters', wrap(async (_req, res) => {
    const best = await q(
      `SELECT DISTINCT ON (p.char_id) p.char_id, pi.image_id, p.id AS post_id, u.username,
         (SELECT count(*)::int FROM likes l WHERE l.post_id = p.id) AS lk
       FROM posts p JOIN post_images pi ON pi.post_id = p.id AND pi.idx = 0 JOIN users u ON u.id = p.author_id
       WHERE p.char_id <> '' ORDER BY p.char_id, lk DESC, p.created_at DESC`);
    const counts = await q("SELECT char_id, count(*)::int AS n FROM posts WHERE char_id <> '' GROUP BY char_id");
    const fans = await q("SELECT theme, count(*)::int AS n FROM users WHERE theme <> '' GROUP BY theme");
    const covers = await q('SELECT char_id, image_id FROM char_covers');
    const out = {};
    const slot = (id) => (out[id] ||= { photo: null, by: null, postId: null, cosplays: 0, fans: 0, cover: false });
    for (const r of best) Object.assign(slot(r.char_id), { photo: imgUrl(r.image_id), by: r.username, postId: r.post_id });
    for (const r of covers) Object.assign(slot(r.char_id), { photo: imgUrl(r.image_id), by: null, postId: null, cover: true });
    for (const r of counts) slot(r.char_id).cosplays = r.n;
    for (const r of fans) slot(r.theme).fans = r.n;
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ characters: out });
  }));
  app.post('/api/admin/characters/:id/photo', auth, admin, wrap(async (req, res) => {
    const cid = themeId(req.params.id);
    if (!cid) throw new HttpError(400, 'Неизвестный персонаж');
    const imageId = await saveImage(req.body.image, req.user.id);
    await q(`INSERT INTO char_covers (char_id, image_id, updated_at) VALUES ($1,$2,$3)
      ON CONFLICT (char_id) DO UPDATE SET image_id = EXCLUDED.image_id, updated_at = EXCLUDED.updated_at`, [cid, imageId, now()]);
    res.json({ ok: true, photo: imgUrl(imageId) });
  }));
  app.delete('/api/admin/characters/:id/photo', auth, admin, wrap(async (req, res) => {
    await q('DELETE FROM char_covers WHERE char_id = $1', [themeId(req.params.id)]);
    res.json({ ok: true });
  }));

  // ----- свои персонажи: тема оформления из фото своего косплея -----
  const T_FONTS = ['Unbounded', 'Cormorant Garamond', 'Yeseva One', 'Comfortaa', 'JetBrains Mono'];
  const T_PATTERNS = ['dots', 'stars', 'diamond', 'check', 'stripes', 'grid', 'rain', 'waves', 'rings', 'stitch'];
  const T_CATS = ['anime', 'manga', 'book', 'film', 'game'];
  const HEX = /^#[0-9a-f]{6}$/i;
  const themeView = (r, me) => ({
    id: r.id, name: r.name, from: r.fandom, cat: r.cat, mode: r.mode, bg: r.bg, accent: r.accent, accent2: r.accent2,
    font: r.font, pattern: r.pattern, photo: imgUrl(r.image_id), by: r.username, status: r.status, mine: !!me && me.id === r.owner_id,
  });
  const themeFields = (b, old = {}) => {
    const f = {
      name: clean(b.name ?? old.name, 60), fandom: clean(b.from ?? old.fandom, 80),
      cat: T_CATS.includes(b.cat) ? b.cat : b.cat === undefined ? old.cat || '' : '',
      mode: (b.mode ?? old.mode) === 'light' ? 'light' : 'dark',
      bg: String(b.bg ?? old.bg ?? ''), accent: String(b.accent ?? old.accent ?? ''), accent2: String(b.accent2 ?? old.accent2 ?? ''),
      font: T_FONTS.includes(b.font) ? b.font : old.font || 'Unbounded', pattern: T_PATTERNS.includes(b.pattern) ? b.pattern : old.pattern || 'dots',
    };
    if (!f.name) throw new HttpError(400, 'Напишите, какой это персонаж');
    if (![f.bg, f.accent, f.accent2].every((c) => HEX.test(c))) throw new HttpError(400, 'Цвета темы указаны неверно');
    return f;
  };
  const THEME_SEL = 'SELECT t.*, u.username FROM custom_themes t JOIN users u ON u.id = t.owner_id';

  app.get('/api/themes', wrap(async (req, res) => {
    const rows = await q(`${THEME_SEL} WHERE t.status = 'public' OR t.owner_id = $1 ORDER BY t.created_at`, [req.user?.id || '']);
    res.setHeader('Cache-Control', 'no-cache');
    res.json({ themes: rows.map((r) => themeView(r, req.user)) });
  }));
  app.get('/api/themes/:id', wrap(async (req, res) => {
    const r = await one(`${THEME_SEL} WHERE t.id = $1`, [req.params.id]);
    if (!r) throw new HttpError(404, 'Такого персонажа нет');
    res.json({ theme: themeView(r, req.user) });
  }));
  app.post('/api/themes', auth, wrap(async (req, res) => {
    const f = themeFields(req.body || {});
    checkImage(req.body.image);
    const { n } = await one('SELECT count(*)::int AS n FROM custom_themes WHERE owner_id = $1', [req.user.id]);
    if (n >= 12) throw new HttpError(400, 'Можно создать до 12 своих персонажей — удалите ненужного');
    const id = 'my-' + crypto.randomBytes(5).toString('hex');
    const imageId = await saveImage(req.body.image, req.user.id);
    await q(`INSERT INTO custom_themes (id, owner_id, name, fandom, cat, mode, bg, accent, accent2, font, pattern, image_id, status, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, req.user.id, f.name, f.fandom, f.cat, f.mode, f.bg, f.accent, f.accent2, f.font, f.pattern, imageId, req.body.submit ? 'pending' : 'private', now()]);
    res.json({ theme: themeView(await one(`${THEME_SEL} WHERE t.id = $1`, [id]), req.user) });
  }));
  app.patch('/api/themes/:id', auth, wrap(async (req, res) => {
    const old = await one('SELECT * FROM custom_themes WHERE id = $1', [req.params.id]);
    if (!old) throw new HttpError(404, 'Такого персонажа нет');
    if (old.owner_id !== req.user.id) throw new HttpError(403, 'Менять можно только своего персонажа');
    const f = themeFields(req.body || {}, old);
    if (req.body.image) checkImage(req.body.image);
    const imageId = req.body.image ? await saveImage(req.body.image, req.user.id) : old.image_id;
    // опубликованный персонаж после правок снова проходит проверку
    const status = req.body.submit ? 'pending' : old.status === 'public' || old.status === 'pending' ? 'pending' : old.status === 'rejected' ? 'private' : old.status;
    await q(`UPDATE custom_themes SET name=$2, fandom=$3, cat=$4, mode=$5, bg=$6, accent=$7, accent2=$8, font=$9, pattern=$10, image_id=$11, status=$12 WHERE id=$1`,
      [old.id, f.name, f.fandom, f.cat, f.mode, f.bg, f.accent, f.accent2, f.font, f.pattern, imageId, status]);
    res.json({ theme: themeView(await one(`${THEME_SEL} WHERE t.id = $1`, [old.id]), req.user) });
  }));
  app.post('/api/themes/:id/submit', auth, wrap(async (req, res) => {
    const old = await one('SELECT owner_id, status FROM custom_themes WHERE id = $1', [req.params.id]);
    if (!old || old.owner_id !== req.user.id) throw new HttpError(404, 'Такого персонажа нет');
    if (old.status !== 'public') await q("UPDATE custom_themes SET status = 'pending' WHERE id = $1", [req.params.id]);
    res.json({ theme: themeView(await one(`${THEME_SEL} WHERE t.id = $1`, [req.params.id]), req.user) });
  }));
  app.delete('/api/themes/:id', auth, wrap(async (req, res) => {
    const old = await one('SELECT owner_id FROM custom_themes WHERE id = $1', [req.params.id]);
    if (!old) throw new HttpError(404, 'Такого персонажа нет');
    if (old.owner_id !== req.user.id && !isAdmin(req)) throw new HttpError(403, 'Удалять можно только своего персонажа');
    await q("UPDATE users SET theme = '' WHERE theme = $1", [req.params.id]);
    await q('DELETE FROM custom_themes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  }));
  // Модерация: персонажи, которых предложили в общий каталог
  app.get('/api/admin/themes', auth, admin, wrap(async (req, res) => {
    const rows = await q(`${THEME_SEL} WHERE t.status IN ('pending', 'public') ORDER BY t.status DESC, t.created_at DESC LIMIT 200`);
    res.json({ themes: rows.map((r) => themeView(r, req.user)) });
  }));
  app.post('/api/admin/themes/:id', auth, admin, wrap(async (req, res) => {
    const st = { public: 'public', rejected: 'rejected', pending: 'pending' }[req.body.status];
    if (!st) throw new HttpError(400, 'Неизвестное решение');
    const old = await one('SELECT owner_id FROM custom_themes WHERE id = $1', [req.params.id]);
    if (!old) throw new HttpError(404, 'Такого персонажа нет');
    await q('UPDATE custom_themes SET status = $2 WHERE id = $1', [req.params.id, st]);
    if (st !== 'pending') await notify(old.owner_id, req.user.id, st === 'public' ? 'theme_ok' : 'theme_no');
    res.json({ ok: true });
  }));

  // ----- личные сообщения -----
  app.get('/api/dm', auth, wrap(async (req, res) => {
    const me = req.user.id;
    const rows = await q(
      `SELECT x.other_id, x.text, x.created_at, x.from_id, ${authorCols()},
         (SELECT count(*)::int FROM dms d WHERE d.from_id = x.other_id AND d.to_id = $1 AND d.read = FALSE) AS unread
       FROM (
         SELECT DISTINCT ON (other_id) other_id, text, created_at, from_id FROM (
           SELECT CASE WHEN from_id = $1 THEN to_id ELSE from_id END AS other_id, text, created_at, from_id
           FROM dms WHERE from_id = $1 OR to_id = $1
         ) t ORDER BY other_id, created_at DESC
       ) x JOIN users u ON u.id = x.other_id
       ORDER BY x.created_at DESC LIMIT 100`, [me]);
    res.json({
      conversations: rows.map((r) => ({ user: userView(r, 'a_'), last: r.text, mine: r.from_id === me, createdAt: r.created_at, unread: r.unread })),
    });
  }));
  app.get('/api/dm/:username', auth, wrap(async (req, res) => {
    const other = await one(`SELECT ${userCols} FROM users u WHERE u.username = $1`, [req.params.username.toLowerCase()]);
    if (!other) throw new HttpError(404, 'Косплеер не найден');
    const me = req.user.id;
    const rows = await q(
      `SELECT * FROM (SELECT * FROM dms WHERE ((from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)) AND created_at > $3
         ORDER BY created_at DESC LIMIT 200) x ORDER BY created_at`,
      [me, other.id, Number(req.query.after) || 0]);
    await q('UPDATE dms SET read = TRUE WHERE from_id = $1 AND to_id = $2 AND read = FALSE', [other.id, me]);
    res.json({ user: userView(other), messages: rows.map((m) => ({ id: m.id, text: m.text, createdAt: m.created_at, mine: m.from_id === me })) });
  }));
  app.post('/api/dm/:username', auth, wrap(async (req, res) => {
    const other = await one('SELECT id, demo FROM users WHERE username = $1', [req.params.username.toLowerCase()]);
    if (!other) throw new HttpError(404, 'Косплеер не найден');
    if (other.id === req.user.id) throw new HttpError(400, 'Нельзя написать самому себе');
    const text = clean(req.body.text, 2000);
    if (!text) throw new HttpError(400, 'Сообщение пустое');
    const m = { id: newId(), text, createdAt: now(), mine: true };
    await q('INSERT INTO dms (id, from_id, to_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [m.id, req.user.id, other.id, text, m.createdAt]);
    res.json({ message: m });
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
       OR lower(u.specialty) LIKE $1 OR lower(u.city) LIKE $1 OR lower(u.bio) LIKE $1 OR u.country = ANY($2) LIMIT 30`,
      [like, term.length >= 3 ? COUNTRIES.LIST.filter(([, n]) => n.toLowerCase().startsWith(term)).map(([c]) => c) : []]
    );
    const posts = await loadPosts(
      `WHERE lower(p.character) LIKE $1 OR lower(p.fandom) LIKE $1 OR lower(p.caption) LIKE $1 OR lower(p.materials) LIKE $1`,
      [like], req.user?.id, { limit: 60, comments: 0 }
    );
    res.json({ users: users.map((r) => userView(r)), posts });
  }));

  // ----- костюм месяца -----
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
  // Резервная копия (без самих фото и сессий) — только для разработчика
  app.get('/api/admin/backup', auth, admin, wrap(async (req, res) => {
    if (req.user.role !== 'dev') throw new HttpError(403, 'Только для разработчика');
    const { TABLES } = require('./db');
    const out = { createdAt: new Date().toISOString(), tables: {} };
    for (const t of TABLES.filter((x) => x !== 'sessions' && x !== 'settings')) {
      out.tables[t] = t === 'images' ? await q('SELECT id, mime, owner_id, created_at, url FROM images') : t === 'users'
        ? await q('SELECT id, username, name, city, country, specialty, bio, avatar_id, color, role, verified, socials, theme, orders_open, created_at FROM users') : await q(`SELECT * FROM ${t}`);
    }
    res.setHeader('Content-Disposition', `attachment; filename="cosplaygram-backup-${out.createdAt.slice(0, 10)}.json"`);
    res.json(out);
  }));
  // Старый сервер отправляет все данные на новый (только разработчик)
  app.post('/api/admin/migrate/push', auth, admin, wrap(async (req, res) => {
    if (req.user.role !== 'dev') throw new HttpError(403, 'Только для разработчика');
    let target = clean(req.body.target, 200).replace(/\/+$/, '');
    if (!/^https?:\/\//.test(target)) target = 'https://' + target;
    if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(target)) throw new HttpError(400, 'Адрес нового сервера: например, https://cosplaygram.kz');
    const { TABLES } = require('./db');
    const tables = {};
    for (const t of TABLES) tables[t] = await q(`SELECT * FROM ${t}`);
    let r;
    try {
      r = await fetch(target + '/api/migrate/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-migrate-code': clean(req.body.code, 20) }, body: JSON.stringify({ tables }),
      });
    } catch (e) { throw new HttpError(502, 'Новый сервер не отвечает: ' + e.message); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(400, j.error || 'Новый сервер ответил ошибкой ' + r.status);
    res.json(j);
  }));
  app.get('/api/admin/users', auth, admin, wrap(async (req, res) => {
    const term = clean(req.query.q, 60).toLowerCase();
    const like = `%${term.replace(/[%_\\]/g, '\\$&')}%`;
    const rows = await q(
      `SELECT ${userCols}, (SELECT count(*)::int FROM posts p WHERE p.author_id = u.id) AS posts FROM users u
       ${term ? 'WHERE lower(u.username) LIKE $1 OR lower(u.name) LIKE $1' : ''} ORDER BY u.created_at DESC LIMIT 200`, term ? [like] : []);
    res.json({ users: rows.map((r) => ({ ...userView(r), posts: r.posts })) });
  }));
  app.post('/api/admin/users/:id', auth, admin, wrap(async (req, res) => {
    const t = await one('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!t) throw new HttpError(404, 'Участник не найден');
    if (t.role === 'dev' && req.user.role !== 'dev') throw new HttpError(403, 'Разработчика может менять только разработчик');
    if ('verified' in req.body) await q('UPDATE users SET verified = $2 WHERE id = $1', [t.id, !!req.body.verified]);
    if ('role' in req.body) {
      if (req.user.role !== 'dev') throw new HttpError(403, 'Роли назначает только разработчик');
      if (t.id === req.user.id) throw new HttpError(400, 'Свою роль менять нельзя');
      if (!['user', 'admin', 'dev'].includes(req.body.role)) throw new HttpError(400, 'Неизвестная роль');
      await q('UPDATE users SET role = $2 WHERE id = $1', [t.id, req.body.role]);
    }
    res.json({ user: userView(await one(`SELECT ${userCols} FROM users u WHERE u.id = $1`, [t.id])) });
  }));
  app.delete('/api/admin/users/:id', auth, admin, wrap(async (req, res) => {
    const t = await one('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!t) throw new HttpError(404, 'Участник не найден');
    if (t.id === req.user.id) throw new HttpError(400, 'Себя удалить нельзя');
    if (t.role === 'dev' || (t.role === 'admin' && req.user.role !== 'dev')) throw new HttpError(403, 'Этого участника удалить нельзя');
    await q('DELETE FROM users WHERE id = $1', [t.id]);
    res.json({ ok: true });
  }));

  app.get('/healthz', (_req, res) => res.send('ok'));
  // Короткая команда установки: curl -sL cosplaygram.kz/i | sudo bash
  app.get('/i', (_req, res) => { res.type('text/plain'); res.sendFile(path.join(__dirname, 'deploy', 'install.sh')); });
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Нет такого адреса API')));
  // Красивые ссылки с превью для Instagram, Telegram и поисковиков: /u/ник, /p/работа, /e/мероприятие
  const INDEX = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const escH = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const origin = (req) => `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
  function page(req, res, meta) {
    const o = origin(req);
    const img = meta.image ? (meta.image.startsWith('http') ? meta.image : o + meta.image) : o + '/icon-512.png';
    const tags = `<meta property="og:site_name" content="Cosplaygram"><meta property="og:type" content="${meta.type || 'website'}">
  <meta property="og:title" content="${escH(meta.title)}"><meta property="og:description" content="${escH(meta.description)}">
  <meta property="og:image" content="${escH(img)}"><meta property="og:url" content="${escH(o + req.path)}">
  <meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escH(o + req.path)}">`;
    const html = INDEX.replace(/<title>[^<]*<\/title>/, `<title>${escH(meta.title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escH(meta.description)}">`)
      .replace('</head>', tags + '\n</head>');
    res.setHeader('Cache-Control', 'no-cache');
    res.type('html').send(html);
  }
  const short = (s, n = 180) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  app.get('/u/:username', wrap(async (req, res) => {
    const u = await one(`SELECT ${userCols} FROM users u WHERE u.username = $1`, [req.params.username.toLowerCase()]);
    if (!u) return page(req, res, { title: 'Cosplaygram', description: 'Платформа косплееров' });
    const v = userView(u);
    const cover = await one('SELECT pi.image_id FROM posts p JOIN post_images pi ON pi.post_id = p.id AND pi.idx = 0 WHERE p.author_id = $1 ORDER BY p.created_at DESC LIMIT 1', [v.id]);
    const ach = await one('SELECT (SELECT count(*)::int FROM achievements WHERE user_id = $1) + (SELECT count(*)::int FROM event_results WHERE user_id = $1) AS n', [v.id]);
    page(req, res, { type: 'profile', title: `${v.name} (@${v.username}) — Cosplaygram`,
      description: short([v.specialty, v.city, ach.n ? `🏆 достижений: ${ach.n}` : '', v.bio].filter(Boolean).join(' · ') || 'Косплеер на Cosplaygram'),
      image: imgUrl(cover?.image_id) || v.avatar });
  }));
  app.get('/p/:id', wrap(async (req, res) => {
    const p = await one('SELECT p.character, p.fandom, p.caption, u.name, u.username FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = $1', [req.params.id]);
    if (!p) return page(req, res, { title: 'Cosplaygram', description: 'Платформа косплееров' });
    const im = await one('SELECT image_id FROM post_images WHERE post_id = $1 AND idx = 0', [req.params.id]);
    page(req, res, { type: 'article', title: `${p.character || 'Косплей'}${p.fandom ? ' · ' + p.fandom : ''} — @${p.username}`, description: short(p.caption || `Работа ${p.name} на Cosplaygram`), image: imgUrl(im?.image_id) });
  }));
  app.get('/e/:id', wrap(async (req, res) => {
    const e = await one('SELECT title, date, city, country, note FROM events WHERE id = $1', [req.params.id]);
    if (!e) return page(req, res, { title: 'Мероприятия — Cosplaygram', description: 'Фестивали, ивенты, вечеринки, сходки' });
    const w = await q('SELECT r.nomination, r.place, COALESCE(u.name, r.name) AS who FROM event_results r LEFT JOIN users u ON u.id = r.user_id WHERE r.event_id = $1 ORDER BY r.created_at LIMIT 6', [req.params.id]);
    page(req, res, { title: `${e.title}${w.length ? ' — итоги' : ''} · Cosplaygram`,
      description: short(w.length ? w.map((r) => `${r.nomination}: ${r.place} — ${r.who}`).join('; ') : [e.date.split('-').reverse().join('.'), e.city, COUNTRIES.name(e.country), e.note].filter(Boolean).join(' · ')) });
  }));
  // Политика конфиденциальности и правила (нужны Google для кнопки входа)
  app.get('/privacy', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'privacy.html')));
  app.get('/terms', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
  app.get('/robots.txt', (req, res) => res.type('text').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`));
  app.get('/sitemap.xml', wrap(async (req, res) => {
    const o = origin(req);
    const urls = [o + '/', ...(await q('SELECT username FROM users ORDER BY created_at DESC LIMIT 5000')).map((r) => `${o}/u/${encodeURIComponent(r.username)}`),
      ...(await q('SELECT id FROM posts ORDER BY created_at DESC LIMIT 20000')).map((r) => `${o}/p/${r.id}`),
      ...(await q('SELECT id FROM events ORDER BY date DESC LIMIT 2000')).map((r) => `${o}/e/${r.id}`)];
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${escH(u)}</loc></url>`).join('')}</urlset>`);
  }));
  app.get(/^\/(?!api\/|img\/|chars\/).*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(__dirname, 'public', 'index.html')); });

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status === 413 ? 'Файлы слишком большие' : status >= 500 ? 'Ошибка сервера. Попробуйте ещё раз.' : err.message });
  });

  app.listen(PORT, () => {
    console.log(`Cosplaygram запущен на порту ${PORT}${storage.enabled ? ', фото: ' + storage.kind : ''}`);
    setTimeout(() => moveImages().catch((e) => console.error(e)), 3000);
  });
}

main().catch((e) => {
  console.error('Не удалось запустить Cosplaygram:', e);
  process.exit(1);
});
