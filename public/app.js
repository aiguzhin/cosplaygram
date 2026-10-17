// Cosplaygram — клиент (чистый JS, без сборки). Темы персонажей — в themes.js (window.CG).
'use strict';

/* ================= утилиты ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = () => $('#view');
const isMobile = () => matchMedia('(max-width: 860px)').matches;
const state = { me: null, unread: 0, unreadDm: 0, groups: [], timers: {}, installEvt: null, observer: null, cleanup: null };

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers: opts.body ? { 'Content-Type': 'application/json' } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('Нет соединения с интернетом. Проверьте сеть и попробуйте ещё раз.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !state.me && !['/login', '/register', '/me'].includes(path) && !path.startsWith('/auth/')) setTimeout(() => openAuth('register'), 0);
  if (res.status === 401 && state.me && !['/login', '/register', '/me/password'].includes(path) && !path.startsWith('/auth/')) {
    state.me = null;
    toast('Сессия закончилась. Войдите снова.');
    setTimeout(route, 0);
  }
  if (!res.ok) {
    const e = new Error(data.error || 'Не получилось. Попробуйте ещё раз.');
    e.status = res.status;
    throw e;
  }
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2800);
}

const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
};
/* ---------- страны ---------- */
const C = window.COUNTRIES;
const flag = (code) => (C.valid(code) ? C.flag(code) : '');
// «🇯🇵 Токио» / «🇯🇵 Япония» / «Токио»
const place = (x) => { const f = flag(x?.country); const c = x?.city || (f ? C.name(x.country) : ''); return c ? (f ? f + ' ' : '') + esc(c) : ''; };
const countryOptions = (value, empty = 'Не указана') =>
  `<option value="">${empty}</option>` + C.sorted().map(([c, n]) => `<option value="${c}" ${c === value ? 'selected' : ''}>${C.flag(c)} ${n}</option>`).join('');
// Ряд чипов «Весь мир · моя страна · другие страны из списка»
function countryChips(codes, current, href) {
  const mine = state.me?.country;
  const list = [...new Set([mine, ...codes].filter((c) => C.valid(c)))];
  return `<a class="chip ${!current ? 'on' : ''}" href="${href('')}">🌍 Весь мир</a>` +
    list.map((c) => `<a class="chip ${c === current ? 'on' : ''}" href="${href(c)}">${C.flag(c)} ${C.name(c)}</a>`).join('');
}
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${plural(d, 'день', 'дня', 'дней')} назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
const hhmm = (ts) => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
function dayLabel(ts) {
  const d = new Date(ts), t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Сегодня';
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

async function copyText(text, okMsg = 'Ссылка скопирована') {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Скопируйте ссылку: ' + text); }
}
function share(path, title) {
  // #/u/ник → /u/ник: такие ссылки показывают превью в Instagram и Telegram
  const m = /^#\/(u|p|e)\/(.+)$/.exec(path);
  const url = location.origin + '/' + (m ? `${m[1]}/${m[2]}` : path);
  if (navigator.share && isMobile()) navigator.share({ title: title || 'Cosplaygram', url }).catch(() => {});
  else copyText(url);
}

function readImage(file, max = 1440) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Выберите фото: JPG, PNG или WEBP'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Не удалось открыть фото. Попробуйте другой файл.')); };
    img.src = url;
  });
}

/* ================= иконки ================= */
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ic = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  needle: I('<path d="M4 20 18 6"/><ellipse cx="19.5" cy="4.5" rx="1.6" ry="2.6" transform="rotate(45 19.5 4.5)"/><path d="M8 13c-3 1-4 4-2 5s5-1 6-3" stroke-dasharray="2 2.4"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  forum: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  users: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c1.8.8 3 2.6 3.5 5.4"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  bell: I('<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>'),
  mail: I('<path d="M21 4 3 11l7 3 3 7z"/><path d="m10 14 4-4"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 4 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4 20 4 22.4 7.3 21.2 10.7 19.5 15.4 12 20 12 20z"/>'),
  comment: I('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>'),
  save: I('<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>'),
  bag: I('<path d="M5.5 8h13l-1 12.5h-11z"/><path d="M9 8a3 3 0 0 1 6 0"/>'),
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1-4.5-4.3 6.1-.8z"/></svg>',
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  flag: I('<path d="M5 21V4h11l-1.5 4L16 12H5"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  share: I('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  logout: I('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/>'),
  shield: I('<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9 17h6"/>'),
  back: I('<path d="m15 5-7 7 7 7"/>'),
  right: I('<path d="m9 5 7 7-7 7"/>'),
  left: I('<path d="m15 5-7 7 7 7"/>'),
  up: I('<path d="m6 15 6-6 6 6"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  trophy: I('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  verified: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.4 1.8 3-.2.9 2.9 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.9-3-.2L12 22l-2.4-1.8-3 .2-.9-2.9-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.9 3 .2z"/><path d="m8.4 12.2 2.5 2.5 4.7-4.9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  palette: I('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.3-1-1.6-1-2.7 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>'),
  phone: I('<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  eyeOff: I('<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  send: I('<path d="M4 12h15M13 6l6 6-6 6"/>'),
  pin: I('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>'),
  layers: I('<rect x="7" y="7" width="13" height="13" rx="2.5" fill="currentColor"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>'),
};

/* ================= люди и персонажи ================= */
const SOURCES = { anime: 'Аниме', manga: 'Манга', book: 'Книга', film: 'Фильм', game: 'Игра', original: 'Ориджинал' };
const LEGACY = { lapis: '#4F63E8', turquoise: '#1BA79D', garnet: '#D93D62', saffron: '#D4931C', violet: '#7C58E6', jade: '#2E9A63' };
const themeOf = (u) => CG.get(u?.theme || 'classic');
function ava(u, size = 36) {
  if (!u) return `<span class="ava" style="--s:${size}px"></span>`;
  const t = u.theme ? CG.get(u.theme) : null;
  const st = t ? `--a:${t.accent};--o:${t.onAccent}` : `--a:${LEGACY[u.color] || '#4F63E8'};--o:#fff`;
  const inner = u.avatar ? `<img src="${esc(u.avatar)}" alt="" loading="lazy">` : esc((u.name || u.username || '?').trim().charAt(0).toUpperCase() || '?');
  return `<span class="ava" style="--s:${size}px;${st}">${inner}</span>`;
}
const userLink = (u) => `#/u/${encodeURIComponent(u?.username || '')}`;
// Роли и галочка подтверждённого аккаунта
const isMod = (u) => ['admin', 'dev'].includes(u?.role);
const ROLE_LABEL = { dev: 'Разработчик', admin: 'Модератор' };
const vmark = (u) => (u?.verified || u?.role === 'dev' ? `<span class="vmark" title="Подтверждённый аккаунт" aria-label="Подтверждённый аккаунт">${ic.verified}</span>` : '');
const rolePill = (u) => (ROLE_LABEL[u?.role] ? `<span class="pill role-${u.role}">${ROLE_LABEL[u.role]}</span>` : '');
const SOCIAL = { instagram: ['Instagram', 'https://instagram.com/'], tiktok: ['TikTok', 'https://www.tiktok.com/@'], telegram: ['Telegram', 'https://t.me/'], vk: ['VK', 'https://vk.com/'], youtube: ['YouTube', 'https://www.youtube.com/@'] };
const ACH = { place: ['🏆', 'Призовое место'], jury: ['⚖️', 'Жюри'], guest: ['🎤', 'Приглашённый гость'], organizer: ['📣', 'Организатор'], other: ['⭐', 'Другое'] };
const CUR = { KZT: '₸', RUB: '₽', UZS: 'сум', KGS: 'сом', USD: '$', EUR: '€' };
const curFor = (country) => ({ KZ: 'KZT', RU: 'RUB', UZ: 'UZS', KG: 'KGS', BY: 'RUB' }[country] || 'USD');
const priceText = (s) => (s.price ? `от ${s.price.toLocaleString('ru-RU')} ${CUR[s.currency] || s.currency}` : 'Цена договорная');
const stars = (n) => `<span class="stars" aria-label="Оценка ${n} из 5">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= Math.round(n) ? 'on' : ''}">${ic.star}</span>`).join('')}</span>`;
const rateText = (avg, n) => (n ? `★ ${String(avg).replace('.', ',')} · ${n} ${plural(n, 'отзыв', 'отзыва', 'отзывов')}` : '');
const who = (u, sub, size = 36) =>
  `<a class="who" href="${userLink(u)}">${ava(u, size)}<span class="t"><b>${esc(u?.name || u?.username)}${vmark(u)}</b><span>@${esc(u?.username)}${sub ? ' · ' + esc(sub) : ''}</span></span></a>`;

// Фото персонажа: обложка модератора → лучший косплей участников → свободное фото с Wikimedia Commons → эмблема
const charData = { site: {}, commons: {}, art: new Set(), loaded: false };
async function loadChars(force) {
  if (charData.loaded && !force) return charData;
  const [site, commons, art] = await Promise.all([
    api('/characters').then((r) => r.characters).catch(() => ({})),
    fetch('/chars/credits.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch('/chars/art.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);
  Object.assign(charData, { site, commons, art: new Set(art), loaded: true });
  return charData;
}
// Превью карточки: только изображение самого персонажа (арт, загруженный в админ-панели), иначе эмблема.
// Любые косплеи — участников и свободные фото с Commons — по нажатию на карточку.
function charArt(id) {
  const s = charData.site[id];
  if (s?.cover && s.photo) return { src: s.photo, credit: '' };
  return charData.art.has(id) ? { src: `/chars/art/${id}.jpg`, credit: '' } : null;
}
function charPhoto(id) {
  const ct = CG.get(id);
  if (ct.custom && ct.id === id && ct.photo) return { src: ct.photo, credit: `Косплей: @${ct.by}` };
  const s = charData.site[id];
  if (s?.photo) return { src: s.photo, credit: s.cover ? 'Обложка Cosplaygram' : `Косплей: @${s.by}` };
  const c = charData.commons[id];
  if (c) return { src: `/chars/${id}.jpg`, credit: `Фото: ${c.author}, ${c.license}` };
  return null;
}
const charStats = (id) => charData.site[id] || { cosplays: 0, fans: 0 };

function charCard(t, on) {
  const ph = charArt(t.id);
  const st = charStats(t.id);
  const meta = [t.from + (t.cat ? ' · ' + CG.CATS[t.cat] : ''), st.cosplays ? `${st.cosplays} ${plural(st.cosplays, 'косплей', 'косплея', 'косплеев')}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="char ${on ? 'on' : ''} ${ph ? 'has-photo' : ''}" data-char="${t.id}" style="${CG.styleAttr(t)}" aria-pressed="${!!on}" aria-label="${esc(t.name)}${t.from ? ', ' + esc(t.from) : ''}">
    <span class="art">${ph ? `<img src="${esc(ph.src)}" alt="" loading="lazy" decoding="async">${ph.credit ? `<span class="cr">${esc(ph.credit)}</span>` : ''}` : `<i class="mono" aria-hidden="true">${esc(t.name.trim().charAt(0))}</i><b>${esc(t.name.trim().charAt(0))}</b>`}${st.cosplays ? `<span class="cnt">${ic.image}${st.cosplays}</span>` : ''}<span class="sw"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i><i style="background:${t.ink}"></i></span></span>
    <span class="meta"><span class="nm">${esc(t.name)}</span><span class="fr">${esc(meta)}</span></span>
    <span class="ok">${ic.check}</span></button>`;
}
const CHAR_TABS = [['', 'Популярные'], ['anime', 'Аниме'], ['manga', 'Манга'], ['book', 'Книги'], ['film', 'Фильмы и сериалы'], ['game', 'Игры'], ['classic', 'Классика']];
const charTabList = () => (state.me ? [CHAR_TABS[0], ['mine', 'Свои'], ...CHAR_TABS.slice(1)] : CHAR_TABS);
function charsFor(cat, query = '') {
  const qq = query.trim().toLowerCase();
  // свои персонажи участников видны всем после проверки модератором; свои — всегда во вкладке «Свои»
  const pub = CG.THEMES.filter((t) => t.id !== 'my-preview' && (!t.custom || t.status === 'public'));
  if (cat === 'mine') return CG.THEMES.filter((t) => t.custom && t.mine && t.id !== 'my-preview');
  let list = pub.filter((t) => (cat === '' ? true : cat === 'classic' ? !t.cat : t.cat === cat));
  if (qq) list = CG.THEMES.filter((t) => t.id !== 'my-preview' && (!t.custom || t.status === 'public' || t.mine) && (t.name + ' ' + t.from).toLowerCase().includes(qq));
  if (cat === '' && !qq) {
    // «Популярные»: сначала те, кого чаще косплеят и выбирают на Cosplaygram, затем общий рейтинг каталога
    const rank = (t) => charStats(t.id).cosplays * 3 + charStats(t.id).fans;
    const order = new Map(CG.THEMES.map((t, i) => [t.id, i]));
    list = [...list].sort((a, b) => (!a.cat) - (!b.cat) || rank(b) - rank(a) || order.get(a.id) - order.get(b.id));
  }
  return list;
}
const charTabs = () => `<input class="input" type="search" data-csearch placeholder="Найти персонажа или произведение" aria-label="Найти персонажа" style="margin-bottom:10px">
  <div class="chips" role="tablist" aria-label="Категории персонажей">${charTabList().map(([k, v], i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-ctab="${k}">${v}</button>`).join('')}</div>`;

// Сетка выбора: поиск, вкладки и живой предпросмотр темы. holder хранит выбор в data-sel.
function bindCharPicker(holder, onPick) {
  let cat = '';
  const grid = $('.char-grid', holder);
  const search = $('[data-csearch]', holder);
  const draw = () => {
    const list = charsFor(cat, search?.value || '');
    const mk = state.me && (cat === 'mine' || (search?.value || '').trim())
      ? `<button type="button" class="char char-new" data-newchar><span class="art">${ic.plus}</span><span class="meta"><span class="nm">Свой персонаж</span><span class="fr">Тема из фото вашего косплея</span></span></button>` : '';
    const cards = list.map((t) => charCard(t, t.id === holder.dataset.sel)).join('');
    // во вкладке «Свои» — кнопка создания первой, в поиске — последней
    grid.innerHTML = (cat === 'mine' ? mk + cards : cards + mk) || '<p class="muted">Такого персонажа пока нет в каталоге. Выберите похожий стиль, «Классику» или создайте своего во вкладке «Свои».</p>';
  };
  if (search) search.oninput = draw;
  $$('[data-ctab]', holder).forEach((b) => (b.onclick = () => {
    cat = b.dataset.ctab;
    if (search) search.value = '';
    $$('[data-ctab]', holder).forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  loadChars().then(draw);
  // Детали персонажа: сам персонаж сверху, ниже — косплеи участников; стиль включается кнопкой
  const detail = document.createElement('div');
  detail.className = 'char-detail';
  detail.hidden = true;
  grid.after(detail);
  const chrome = () => [grid, search, ...$$('[data-ctab]', holder).map((b) => b.parentElement)].filter(Boolean);
  const showGrid = () => { detail.hidden = true; chrome().forEach((el) => (el.hidden = false)); CG.apply(holder.dataset.sel || 'classic'); };
  const choose = (id) => {
    holder.dataset.sel = id;
    CG.apply(id);
    onPick(CG.get(id));
    draw();
    showGrid();
  };
  async function openDetail(id) {
    const t = CG.get(id);
    const ph = charArt(id);
    const inOverlay = !!holder.closest('.overlay');
    chrome().forEach((el) => (el.hidden = true));
    detail.hidden = false;
    CG.apply(id);
    detail.innerHTML = `<button type="button" class="btn sm ghost" data-back>${ic.left || '←'} Все персонажи</button>
      <div class="cd-head" style="${CG.styleAttr(t)}"><span class="cd-art">${ph ? `<img src="${esc(ph.src)}" alt="">` : `<b>${esc(t.name.trim().charAt(0))}</b>`}</span>
        <span class="cd-t"><span class="small">${t.cat ? esc(CG.CATS[t.cat]) : 'Стиль Cosplaygram'}</span><b>${esc(t.name)}</b><span>${esc(t.from)}</span></span></div>
      <button type="button" class="btn primary block" data-choose>${holder.dataset.sel === id ? `${ic.check}Это ваш стиль` : `Выбрать стиль «${esc(t.name)}»`}</button>
      <h3 class="cd-h">Косплеи</h3><div class="cd-grid" id="cdG"><div class="skel" style="height:140px"></div></div>`;
    $('[data-back]', detail).onclick = showGrid;
    $('[data-choose]', detail).onclick = () => choose(id);
    detail.scrollIntoView({ block: 'nearest' });
    let posts = [];
    if (t.cat) { try { posts = (await api(feedQuery('char:' + id))).posts || []; } catch {} }
    if (detail.hidden) return;
    const tiles = posts.map((p) => `<button type="button" class="cd-tile" ${inOverlay ? '' : `data-open="${p.id}"`} aria-label="${esc(p.character)} — @${esc(p.author?.username)}"><img src="${esc(p.slides?.[0]?.image || '')}" alt="" loading="lazy"><span>@${esc(p.author?.username || '')}</span></button>`);
    const c = charData.commons[id];
    if (c) tiles.push(`<span class="cd-tile"><img src="/chars/${esc(id)}.jpg" alt="" loading="lazy"><span>${esc(c.author)}, ${esc(c.license)}</span></span>`);
    if (t.custom && t.photo) tiles.unshift(`<span class="cd-tile"><img src="${esc(t.photo)}" alt="" loading="lazy"><span>@${esc(t.by)}</span></span>`);
    $('#cdG', detail).innerHTML = tiles.join('') || `<p class="muted" style="grid-column:1/-1">Пока никто не показал косплей ${esc(t.name)}. Станьте первым!</p>`;
    if (!inOverlay) bindCards(detail);
  }
  grid.addEventListener('click', (e) => {
    if (e.target.closest('[data-newchar]')) return openThemeMaker(null, (search?.value || '').trim());
    const c = e.target.closest('[data-char]');
    if (!c) return;
    // «Классика» — без персонажа: выбирается сразу
    if (!CG.get(c.dataset.char).cat) return choose(c.dataset.char);
    openDetail(c.dataset.char);
  });
  draw();
}

function openPicker({ onboarding = false } = {}) {
  const prev = state.me?.theme || CG.stored() || 'classic';
  let chosen = false;
  const o = openOverlay(`<div class="sheet wide picker" role="dialog" aria-modal="true" aria-labelledby="pkT" data-sel="${esc(prev)}">
    <div class="grab"></div>
    <div class="head"><h2 class="display" id="pkT" style="font-size:1.7rem">${onboarding ? 'Кто вы сегодня?' : 'Выберите персонажа'}</h2>
      <p class="muted">Нажмите на персонажа — откроются его косплеи и кнопка «Выбрать стиль». Сайт оденется в цвета и шрифт персонажа.</p></div>
    <div class="tabs">${charTabs()}</div>
    <div class="body"><div class="char-grid"></div></div>
    <div class="foot"><div class="t"><span class="small muted">Ваш стиль</span><b id="pkN">${esc(CG.get(prev).name)}</b></div>
      <button class="btn primary lg" id="pkOk">Готово</button></div>
  </div>`, {
    onClose: () => {
      if (chosen) return;
      CG.apply(prev);
      if (onboarding) { saveTheme(prev, true); nextOnboard(); }
    },
  });
  const holder = $('.picker', o);
  bindCharPicker(holder, (t) => { $('#pkN', o).textContent = t.name; });
  $('#pkOk', o).onclick = async () => {
    chosen = true;
    const id = holder.dataset.sel || prev;
    closeOverlay();
    await saveTheme(id);
    toast(`Стиль «${CG.get(id).name}» включён`);
    if (onboarding) nextOnboard();
  };
}
function rememberCustom(id) {
  try { const t = CG.get(id); if (t.custom && t.id === id) localStorage.setItem('cg-custom', JSON.stringify(t.raw)); else localStorage.removeItem('cg-custom'); } catch {}
}
async function saveTheme(id, silent) {
  CG.store(id);
  CG.apply(id);
  rememberCustom(id);
  if (!state.me) return;
  try {
    const { user } = await api('/me', { method: 'PATCH', body: { theme: id } });
    state.me = user;
    renderChrome();
  } catch (e) { if (!silent) toast(e.message); }
}

/* ================= свой персонаж: тема из фото своего косплея ================= */
async function loadThemes() {
  try { for (const d of (await api('/themes')).themes) CG.add(d); } catch {}
}
async function ensureTheme(id) {
  if (/^my-[a-z0-9]+$/.test(id || '') && !CG.has(id)) { try { CG.add((await api('/themes/' + id)).theme); } catch {} }
}
// Цвета из фото: самые заметные и непохожие друг на друга
function photoPalette(src) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const W = 64, H = Math.max(1, Math.round((64 * img.height) / img.width));
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const bins = new Map();
      let light = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        light += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const e = bins.get(k) || [0, 0, 0, 0];
        e[0] += r; e[1] += g; e[2] += b; e[3]++;
        bins.set(k, e);
      }
      const cols = [...bins.values()].map(([r, g, b, n]) => {
        r /= n; g /= n; b /= n;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, v = mx / 255;
        return { r, g, b, score: n * (0.12 + sat * sat) * (v > 0.18 && v < 0.97 ? 1 : 0.15) };
      }).sort((a, b) => b.score - a.score);
      const out = [];
      for (const k of cols) { if (out.every((o) => Math.hypot(o.r - k.r, o.g - k.g, o.b - k.b) > 64)) out.push(k); if (out.length >= 8) break; }
      const hex = (k) => '#' + [k.r, k.g, k.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      ok({ colors: out.map(hex), dark: light / (d.length / 4) < 0.55 });
    };
    img.onerror = () => ok({ colors: [], dark: true });
    img.src = src;
  });
}
const PAT_NAMES = { dots: 'Горошек', stars: 'Звёзды', diamond: 'Ромбы', check: 'Клетка', stripes: 'Полосы', grid: 'Сетка', rain: 'Дождь', waves: 'Волны', rings: 'Кольца', stitch: 'Строчка' };
const T_STATUS = { private: 'Только у вас', pending: 'На проверке', public: 'В общем каталоге', rejected: 'Не прошёл проверку' };
const bgFor = (d) => (d.mode === 'light' ? CG.mix(d.accent, '#FFFFFF', 0.94) : CG.mix(d.accent, '#09090F', 0.9));

function openThemeMaker(edit = null, name = '') {
  if (!state.me) return openAuth('register');
  const prev = state.me.theme || CG.stored() || 'classic';
  const d = edit ? { ...edit.raw } : { name, from: '', cat: 'anime', mode: 'dark', accent: '#E0508F', accent2: '#E9B530', font: 'Unbounded', pattern: 'dots', photo: null };
  let image = null, colors = [], saved = false;
  const o = openOverlay(sheet(edit ? 'Мой персонаж' : 'Свой персонаж', `
    <p class="muted" style="margin-bottom:14px">Загрузите фото своего косплея — сайт возьмёт из него цвета и оденется в стиль вашего персонажа. Фото станет обложкой вашего профиля и карточки персонажа.</p>
    <form class="form" id="tmF" novalidate>
      <div class="tm-top"><label for="tm-ph" class="tm-photo" id="tm-pv">${d.photo ? `<img src="${esc(d.photo)}" alt="">` : `${ic.image}<span>Фото косплея</span>`}</label>
        <input type="file" id="tm-ph" accept="image/*" hidden><div class="tm-card" id="tm-card"></div></div>
      <div class="row"><div class="field"><label for="tm-n">Персонаж</label><input class="input" id="tm-n" name="name" maxlength="60" required value="${esc(d.name)}" placeholder="Например, Синобу Кочо"></div>
        <div class="field"><label for="tm-f">Произведение</label><input class="input" id="tm-f" name="from" maxlength="80" value="${esc(d.from)}" placeholder="Например, Клинок, рассекающий демонов"></div></div>
      <p class="hint" id="tm-hint" hidden></p>
      <div class="field"><label for="tm-c">Раздел</label><select class="input" id="tm-c" name="cat">${Object.entries(CG.CATS).map(([k, v]) => `<option value="${k}" ${k === d.cat ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><span class="label">Главный цвет</span><div class="sw-row" id="tm-a"></div></div>
      <div class="field"><span class="label">Второй цвет</span><div class="sw-row" id="tm-a2"></div></div>
      <div class="field"><span class="label">Фон</span><div class="chips" id="tm-m"><button type="button" class="chip" data-m="dark">Тёмный</button><button type="button" class="chip" data-m="light">Светлый</button></div></div>
      <div class="field"><span class="label">Шрифт заголовков</span><div class="chips" id="tm-fo">${CG.FONTS.map((f) => `<button type="button" class="chip" data-fo="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Узор</span><div class="chips" id="tm-pa"></div></div>
      ${edit?.status === 'public' ? '<p class="hint">Персонаж в общем каталоге. После правок он снова пройдёт проверку.</p>'
        : `<label class="check"><input type="checkbox" id="tm-sub" ${edit?.status === 'pending' ? 'checked' : ''}> Предложить в общий каталог</label>
      <p class="hint">После проверки модератором персонаж появится у всех в выборе стиля — с вашим фото и подписью «Косплей: @${esc(state.me.username)}».</p>`}
      <p class="error" id="tmErr" role="alert" hidden></p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary lg" style="flex:1" type="submit">${edit ? 'Сохранить' : 'Создать и включить'}</button>
        ${edit ? '<button type="button" class="btn ghost danger" id="tmDel">Удалить</button>' : ''}</div>
    </form>`, 'wide'), { onClose: () => { CG.remove('my-preview'); if (!saved) CG.apply(prev); } });

  const swRow = (el, key) => {
    const list = [...new Set([...colors, d[key]].map((c) => c.toLowerCase()))];
    el.innerHTML = list.map((c) => `<button type="button" class="sw ${c === d[key].toLowerCase() ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join('')
      + `<label class="sw sw-pick" aria-label="Свой цвет"><input type="color" value="${d[key]}">${ic.palette}</label>`;
    $$('[data-c]', el).forEach((b) => (b.onclick = () => { d[key] = b.dataset.c; refresh(); }));
    $('input[type=color]', el).oninput = (e) => { d[key] = e.target.value; refresh(true); };
  };
  const refresh = (live) => {
    d.name = $('#tm-n', o).value.trim(); d.from = $('#tm-f', o).value.trim(); d.cat = $('#tm-c', o).value;
    d.bg = bgFor(d);
    const t = CG.add({ ...d, id: 'my-preview', name: d.name || 'Ваш персонаж', photo: image || d.photo, by: state.me.username, mine: true });
    CG.apply('my-preview');
    $('#tm-card', o).innerHTML = charCard(t, true);
    if (!live) { swRow($('#tm-a', o), 'accent'); swRow($('#tm-a2', o), 'accent2'); }
    $$('[data-m]', o).forEach((b) => b.classList.toggle('on', b.dataset.m === d.mode));
    $$('[data-fo]', o).forEach((b) => b.classList.toggle('on', b.dataset.fo === d.font));
    $('#tm-pa', o).innerHTML = CG.PATTERNS.map((pt) => `<button type="button" class="chip pat ${pt === d.pattern ? 'on' : ''}" data-pa="${pt}"><i style="background:${CG.pattern({ accent: d.accent, pattern: pt }, 0.6)}"></i>${PAT_NAMES[pt]}</button>`).join('');
    $$('[data-pa]', o).forEach((b) => (b.onclick = () => { d.pattern = b.dataset.pa; refresh(); }));
    const same = CG.THEMES.find((x) => !x.custom && d.name && x.name.toLowerCase() === d.name.toLowerCase());
    const hint = $('#tm-hint', o);
    hint.hidden = !same;
    if (same) hint.textContent = `«${same.name}» уже есть в каталоге. Опубликуйте косплей и отметьте этого персонажа — самое популярное фото попадёт на его карточку. А свою тему с вашими цветами всё равно можно сделать здесь.`;
  };
  $$('[data-m]', o).forEach((b) => (b.onclick = () => { d.mode = b.dataset.m; refresh(); }));
  $$('[data-fo]', o).forEach((b) => (b.onclick = () => { d.font = b.dataset.fo; refresh(); }));
  ['#tm-n', '#tm-f'].forEach((k) => ($(k, o).oninput = () => refresh(true)));
  $('#tm-c', o).onchange = () => refresh(true);
  $('#tm-ph', o).onchange = async (e) => {
    try {
      image = await readImage(e.target.files[0], 1200);
      $('#tm-pv', o).innerHTML = `<img src="${image}" alt="">`;
      const pal = await photoPalette(image);
      colors = pal.colors;
      if (colors[0]) { d.accent = colors[0]; d.accent2 = colors[1] || CG.mix(colors[0], '#FFFFFF', 0.45); }
      d.mode = pal.dark ? 'dark' : 'light';
      refresh();
      toast('Цвета взяты из фото — можно поменять');
    } catch (x) { toast(x.message); }
  };
  $('#tmDel', o)?.addEventListener('click', confirmTwice(async () => {
    await api('/themes/' + edit.id, { method: 'DELETE' });
    CG.remove(edit.id);
    saved = true;
    closeOverlay();
    if ((state.me.theme || CG.stored()) === edit.id) await saveTheme('classic', true); else CG.apply(prev);
    toast('Персонаж удалён');
    route();
  }, 'Нажмите ещё раз — персонаж удалится'));
  $('#tmF', o).onsubmit = async (e) => {
    e.preventDefault();
    refresh(true);
    const err = $('#tmErr', o), btn = e.target.querySelector('[type=submit]');
    err.hidden = true;
    if (!d.name) { err.textContent = 'Напишите, какой это персонаж'; err.hidden = false; return; }
    if (!image && !d.photo) { err.textContent = 'Загрузите фото своего косплея'; err.hidden = false; return; }
    const body = { name: d.name, from: d.from, cat: d.cat, mode: d.mode, bg: d.bg, accent: d.accent, accent2: d.accent2, font: d.font, pattern: d.pattern, submit: !!$('#tm-sub', o)?.checked };
    if (image) body.image = image;
    btn.disabled = true;
    try {
      const r = edit ? await api('/themes/' + edit.id, { method: 'PATCH', body }) : await api('/themes', { body });
      CG.remove('my-preview');
      const t = CG.add(r.theme);
      saved = true;
      closeOverlay();
      await saveTheme(t.id);
      toast(r.theme.status === 'pending' ? `«${t.name}» включён и отправлен на проверку` : `Стиль «${t.name}» включён`);
      if (location.hash.startsWith('#/settings') || location.hash.startsWith('#/u/')) route();
    } catch (x) { err.textContent = x.message; err.hidden = false; btn.disabled = false; }
  };
  refresh();
}

/* ================= оверлеи (листы) ================= */
let overlayCb = null;
let skipPop = false;
function openOverlay(html, { onClose, full } = {}) {
  closeMenu();
  const o = $('#overlay');
  const wasOpen = !o.hidden;
  if (wasOpen && overlayCb) { const cb = overlayCb; overlayCb = null; cb(); }
  o.innerHTML = html;
  o.className = 'overlay' + (full ? ' full' : '');
  o.hidden = false;
  document.body.style.overflow = 'hidden';
  overlayCb = onClose || null;
  o.onclick = (e) => { if (e.target === o || e.target.closest('[data-close]')) closeOverlay(); };
  if (!wasOpen) history.pushState({ cgOverlay: 1 }, '');
  return o;
}
function closeOverlay({ fromPop = false, silent = false } = {}) {
  const o = $('#overlay');
  if (o.hidden) return;
  o.hidden = true;
  o.innerHTML = '';
  document.body.style.overflow = '';
  clearTimeout(state.timers.story);
  const cb = overlayCb;
  overlayCb = null;
  if (cb) cb();
  if (!fromPop && !silent && history.state?.cgOverlay) { skipPop = true; history.back(); }
}
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  if (!$('#overlay').hidden) closeOverlay({ fromPop: true });
  closeMenu();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#overlay').hidden) closeOverlay(); else closeMenu(); }
});
const sheet = (title, body, cls = '') =>
  `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div>
    <div class="sh-head"><h2>${esc(title)}</h2><button class="iconbtn" data-close aria-label="Закрыть">${ic.close}</button></div>
    <div class="sh-body">${body}</div></div>`;

/* ================= шапка, меню, навигация ================= */
const NAV = [
  { k: '', href: '#/', label: 'Главная' },
  { k: 'process', href: '#/process', label: 'Мастерская' },
  { k: 'events', href: '#/events', label: 'Мероприятия' },
  { k: 'forum', href: '#/forum', label: 'Форум' },
  { k: 'chat', href: '#/chat', label: 'Чат' },
  { k: 'people', href: '#/people', label: 'Мастера' },
];
const curKey = () => (location.hash.slice(2).split(/[/?]/)[0]) || '';
const badge = (n) => (n ? `<span class="badge num">${n > 99 ? '99+' : n}</span>` : '');

function renderChrome() {
  const k = curKey();
  const me = state.me;
  $('#topNav').innerHTML = me ? NAV.map((n) => `<a href="${n.href}" class="${n.k === k ? 'active' : ''}">${n.label}</a>`).join('') : '';
  $('#headerActions').innerHTML = me
    ? `<button class="iconbtn lang-btn" data-act="lang" aria-label="Язык: ${esc(CGLang.name(CGLang.current()))}">${ic.globe}<span class="lang-code notranslate" translate="no">${CGLang.current().split('-')[0].toUpperCase()}</span></button><a class="iconbtn" href="#/search" aria-label="Поиск">${ic.search}</a>
       <a class="iconbtn desk-only" href="#/messages" aria-label="Сообщения">${ic.mail}${badge(state.unreadDm)}</a>
       <a class="iconbtn" href="#/notifications" aria-label="Уведомления">${ic.bell}${badge(state.unread)}</a>
       <button class="iconbtn plus desk-only" data-act="create" aria-label="Опубликовать">${ic.plus}</button>
       <button class="me-btn" id="meBtn" aria-haspopup="true" aria-label="Меню профиля">${ava(me, 32)}</button>`
    : `<button class="iconbtn lang-btn" data-act="lang" aria-label="Язык: ${esc(CGLang.name(CGLang.current()))}">${ic.globe}<span class="lang-code notranslate" translate="no">${CGLang.current().split('-')[0].toUpperCase()}</span></button><button class="btn ghost sm" data-act="login">Войти</button><button class="btn primary sm" data-act="register">Регистрация</button>`;
  const bn = $('#bottomNav');
  bn.hidden = !me;
  bn.innerHTML = !me ? '' : `
    <a href="#/" class="${k === '' ? 'active' : ''}">${ic.home}Главная</a>
    <a href="#/process" class="${k === 'process' ? 'active' : ''}">${ic.needle}Мастерская</a>
    <button class="create" data-act="create" aria-label="Опубликовать"><span class="pl">${ic.plus}</span></button>
    <a href="#/events" class="${k === 'events' ? 'active' : ''}">${ic.calendar}Мероприятия</a>
    <a href="#/messages" class="${k === 'messages' ? 'active' : ''}">${ic.mail}Сообщения${badge(state.unreadDm)}</a>`;
  const mb = $('#meBtn');
  if (mb) mb.onclick = (e) => { e.stopPropagation(); if ($('#menuRoot').innerHTML) closeMenu(); else openMenu(); };
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function openMenu() {
  const me = state.me;
  if (!me) return;
  const t = themeOf(me);
  const canInstall = !isStandalone() && (state.installEvt || isIOS());
  $('#menuRoot').innerHTML = `<div class="menu-scrim mob-only" data-mclose></div>
  <nav class="menu" aria-label="Меню профиля"><div class="grab mob-only"></div>
    <a class="mh" href="${userLink(me)}">${ava(me, 44)}<div style="min-width:0"><b>${esc(me.name)}</b><span>@${esc(me.username)} · ${esc(t.name)}</span></div></a>
    <a href="${userLink(me)}">${ic.user}Мой профиль</a>
    <a href="#/messages" class="mob-only">${ic.mail}Сообщения${state.unreadDm ? `<span class="r">${state.unreadDm} новых</span>` : ''}</a>
    <a href="#/orders">${ic.bag}Заказы</a>
    <a href="#/saved">${ic.save}Сохранённое</a>
    <div class="sep mob-only"></div>
    <a href="#/forum" class="mob-only">${ic.forum}Форум</a>
    <a href="#/chat" class="mob-only">${ic.chat}Чат</a>
    <a href="#/people" class="mob-only">${ic.users}Мастера</a>
    <div class="sep"></div>
    <button class="mi" data-act="picker">${ic.palette}Сменить персонажа<span class="r">${esc(t.name)}</span></button>
    <a href="#/settings">${ic.gear}Настройки профиля</a>
    <button class="mi" data-act="lang">${ic.globe}Язык<span class="r notranslate" translate="no">${esc(CGLang.name(CGLang.current()))}</span></button>
    ${canInstall ? `<button class="mi" data-act="install">${ic.phone}Установить приложение</button>` : ''}
    ${isMod(me) ? `<a href="#/admin">${ic.shield}Админ-панель</a>` : ''}
    <div class="sep"></div>
    <button class="mi" data-act="logout">${ic.logout}Выйти</button>
  </nav>`;
}
function closeMenu() { const m = $('#menuRoot'); if (m) m.innerHTML = ''; }

document.addEventListener('click', (e) => {
  if ($('#menuRoot').innerHTML && (e.target.closest('[data-mclose], .menu a') || !e.target.closest('.menu, #meBtn'))) closeMenu();
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  closeMenu();
  if (a === 'create') requireAuth(() => openCreate());
  if (a === 'create-story') requireAuth(() => openCreate('story'));
  if (a === 'create-process') requireAuth(() => openCreate('process'));
  if (a === 'login') openAuth('login');
  if (a === 'register') openAuth('register');
  if (a === 'logout') logout();
  if (a === 'picker') openPicker();
  if (a === 'mychar') requireAuth(() => openThemeMaker());
  if (a === 'install') install();
  if (a === 'lang') openLang();
});

/* ================= язык ================= */
function openLang() {
  const cur = CGLang.current();
  const o = openOverlay(sheet('Язык', `<p class="muted" style="margin-bottom:12px">Сайт переводится автоматически. Публикации и сообщения тоже показываются на выбранном языке.</p>
    <input class="input" id="lgQ" type="search" placeholder="Найти язык" aria-label="Найти язык" style="margin-bottom:10px">
    <div class="lang-list notranslate" translate="no" id="lgL">${CGLang.LANGS.map(([c, n, r]) => `<button type="button" class="lang-item ${c === cur ? 'on' : ''}" data-lang="${c}" data-s="${esc((n + ' ' + r + ' ' + c).toLowerCase())}"><b>${esc(n)}</b><span>${esc(r)}</span>${c === cur ? ic.check : ''}</button>`).join('')}</div>`));
  $('#lgQ', o).oninput = (e) => { const t = e.target.value.trim().toLowerCase(); $$('.lang-item', o).forEach((b) => (b.hidden = !!t && !b.dataset.s.includes(t))); };
  $$('.lang-item', o).forEach((b) => (b.onclick = () => { if (b.dataset.lang !== cur) CGLang.set(b.dataset.lang); else closeOverlay(); }));
  if (!isMobile()) setTimeout(() => $('#lgQ', o)?.focus(), 80);
}

async function install() {
  if (state.installEvt) {
    state.installEvt.prompt();
    const r = await state.installEvt.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') toast('Cosplaygram установлен');
    state.installEvt = null;
    return;
  }
  openOverlay(sheet('Установить на телефон', `<ol class="stack" style="padding-left:20px;margin:0">
      <li>На iPhone откройте сайт в Safari, на Android — в Chrome.</li>
      <li>iPhone: нажмите «Поделиться» внизу экрана. Android: меню ⋮ вверху.</li>
      <li>Выберите «На экран Домой» или «Установить приложение».</li></ol>
      <p class="hint" style="margin-top:14px">Cosplaygram появится на экране как обычное приложение.</p>`));
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installEvt = e; });

/* ================= вход и регистрация ================= */
function requireAuth(fn) { if (state.me) return fn(); openAuth('register', fn); }
const pwField = (id, name, ac, ph) =>
  `<div class="pw"><input class="input" id="${id}" type="password" name="${name}" autocomplete="${ac}" required placeholder="${ph}">
   <button type="button" class="iconbtn" data-eye="${id}" aria-label="Показать пароль">${ic.eye}</button></div>`;
function bindEyes(root) {
  $$('[data-eye]', root).forEach((b) => (b.onclick = () => {
    const i = $('#' + b.dataset.eye, root);
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.innerHTML = show ? ic.eyeOff : ic.eye;
    b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  }));
}

function openAuth(mode = 'login', after) {
  const reg = mode === 'register';
  const t = CG.get(CG.stored() || 'classic');
  const o = openOverlay(sheet(reg ? 'Регистрация' : 'Вход', `
    <p class="muted" style="margin-bottom:16px">${reg ? `Ваш стиль: <b style="color:var(--accent)">${esc(t.name)}</b>. Его можно поменять потом.` : 'С возвращением! Войдите удобным способом.'}</p>
    <div class="social" id="socBox" hidden></div>
    <form class="form" id="authForm" novalidate>
      ${reg ? photoField('au-ph', null, 'Необязательно — можно добавить потом') : ''}
      <div class="field"><label for="au-user">Ник</label><input class="input" id="au-user" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required placeholder="например, aru.cos"></div>
      ${reg ? `<div class="field"><label for="au-name">Имя</label><input class="input" id="au-name" name="name" autocomplete="given-name" placeholder="Как вас называть"></div>
        <div class="field"><label for="au-spec">Ваше лучшее качество</label><input class="input" id="au-spec" name="specialty" maxlength="60" placeholder="Необязательно">
          <p class="hint">Крафт, вигмейкинг, грим, сценическое выступление, макияж и т. д.</p></div>
        <div class="row"><div class="field"><label for="au-country">Страна</label><select class="input" id="au-country" name="country" autocomplete="country">${countryOptions(C.guess())}</select></div>
        <div class="field"><label for="au-city">Город</label><input class="input" id="au-city" name="city" autocomplete="address-level2" placeholder="Необязательно"></div></div>` : ''}
      <div class="field"><label for="au-pass">Пароль</label>${pwField('au-pass', 'password', reg ? 'new-password' : 'current-password', reg ? 'Не короче 8 символов' : '')}</div>
      ${reg ? '<p class="hint">Ник — латиницей, от 3 символов: буквы, цифры, точка или _.</p>' : ''}
      <p class="error" id="authErr" role="alert" hidden></p>
      <button class="btn primary lg block" type="submit">${reg ? 'Создать профиль' : 'Войти'}</button>
      <button type="button" class="btn ghost block" id="authSwitch">${reg ? 'Уже есть профиль? Войти' : 'Нет профиля? Зарегистрироваться'}</button>
      <p class="hint" style="text-align:center">Продолжая, вы соглашаетесь с <a href="/terms" target="_blank" rel="noopener">правилами</a> и <a href="/privacy" target="_blank" rel="noopener">политикой конфиденциальности</a>.</p>
    </form>`));
  bindEyes(o);
  let avatar = null;
  if (reg) bindPhoto(o, 'au-ph', (d) => (avatar = d));
  mountSocial($('#socBox', o), { after });
  $('#authSwitch', o).onclick = () => openAuth(reg ? 'login' : 'register', after);
  $('#authForm', o).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    const err = $('#authErr', o);
    const body = Object.fromEntries(new FormData(e.target));
    body.username = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
    if (reg) { body.theme = CG.stored() || ''; if (avatar) body.avatar = avatar; }
    btn.disabled = true;
    try {
      const { user } = await api(reg ? '/register' : '/login', { body });
      state.me = user;
      closeOverlay();
      toast(reg ? `Добро пожаловать, ${user.name}!` : `Привет, ${user.name}!`);
      if (reg) state.onboard = !after;
      await afterLogin();
      if (after) after(); else route();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
    }
  };
  if (!isMobile()) setTimeout(() => $('#au-user', o)?.focus(), 80);
}

/* ----- вход через Google и Telegram ----- */
const PROV = { google: 'Google', telegram: 'Telegram' };
let providersP = null;
const getProviders = () => (providersP ||= api('/auth/providers').catch(() => { providersP = null; return {}; }));
const loadScript = (src) => new Promise((ok, fail) => {
  const s = document.createElement('script');
  s.src = src; s.async = true; s.onload = ok;
  s.onerror = () => { s.remove(); fail(new Error('Не удалось загрузить кнопку входа')); };
  document.head.appendChild(s);
});
const social = { after: null };
let gsiP = null;
function loadGsi(clientId) {
  return (gsiP ||= loadScript('https://accounts.google.com/gsi/client').then(() => {
    window.google.accounts.id.initialize({
      client_id: clientId, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true,
      callback: (r) => socialAuth('google', { credential: r.credential }),
    });
  }).catch((e) => { gsiP = null; throw e; }));
}
window.cgTg = (user) => socialAuth('telegram', user);

// Кнопки Google и Telegram в контейнере box. link — привязка к уже открытому профилю (в настройках)
async function mountSocial(box, { after = null, link = false, only = null } = {}) {
  const pv = await getProviders();
  const want = (k) => pv[k] && (!only || only.includes(k));
  if (!box?.isConnected || (!want('google') && !want('telegram'))) return false;
  social.after = after;
  box.hidden = false;
  box.innerHTML = `${want('google') ? '<div class="soc-btn notranslate" translate="no" data-g></div>' : ''}${want('telegram') ? '<div class="soc-btn notranslate" translate="no" data-tg></div>' : ''}
    ${link ? '' : '<div class="or"><span>или по нику и паролю</span></div>'}`;
  if (want('telegram')) {
    const sc = document.createElement('script');
    sc.async = true;
    sc.src = 'https://telegram.org/js/telegram-widget.js?22';
    Object.assign(sc.dataset, { telegramLogin: pv.telegram, size: 'large', radius: '20', onauth: 'cgTg(user)', requestAccess: 'write', userpic: 'false', lang: 'ru' });
    $('[data-tg]', box).appendChild(sc);
  }
  if (want('google')) {
    const el = $('[data-g]', box);
    try {
      await loadGsi(pv.google);
      const lang = window.CGLang ? CGLang.current() : 'ru';
      window.google.accounts.id.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: lang, width: Math.max(220, Math.min(380, box.clientWidth || 320)) });
    } catch { el.remove(); }
  }
  return true;
}

async function socialAuth(provider, body) {
  try {
    const r = await api('/auth/' + provider, { body });
    if (r.signup) return openSocialSignup(r.signup, social.after);
    state.me = r.user;
    if (r.linked) { toast(`Готово — теперь можно входить через ${PROV[provider]}`); return route(); }
    closeOverlay();
    toast(`Привет, ${r.user.name}!`);
    await afterLogin();
    const a = social.after;
    social.after = null;
    if (a) a(); else route();
  } catch (e) { toast(e.message); }
}

// Первый вход через Google/Telegram: выбрать ник — и профиль готов
function openSocialSignup(s, after) {
  const o = openOverlay(sheet('Почти готово', `
    <p class="muted" style="margin-bottom:16px">Вы вошли через ${PROV[s.provider] || s.provider}. Осталось выбрать ник — по нему вас будут находить. Пароль не нужен.</p>
    <form class="form" id="sgF" novalidate>
      ${photoField('sg-ph', s.avatar, s.avatar ? `Фото из ${PROV[s.provider] || 'аккаунта'} — можно поменять` : 'Необязательно — можно добавить потом')}
      <div class="field"><label for="sg-user">Ник</label><input class="input" id="sg-user" name="username" value="${esc(s.username || '')}" autocapitalize="none" autocorrect="off" spellcheck="false" required maxlength="30">
        <p class="hint">Латиницей, от 3 символов: буквы, цифры, точка или _.</p></div>
      <div class="field"><label for="sg-name">Имя</label><input class="input" id="sg-name" name="name" value="${esc(s.name || '')}" maxlength="60" placeholder="Как вас называть"></div>
      <div class="field"><label for="sg-spec">Ваше лучшее качество</label><input class="input" id="sg-spec" name="specialty" maxlength="60" placeholder="Необязательно">
        <p class="hint">Крафт, вигмейкинг, грим, сценическое выступление, макияж и т. д.</p></div>
      <div class="row"><div class="field"><label for="sg-country">Страна</label><select class="input" id="sg-country" name="country">${countryOptions(C.guess())}</select></div>
        <div class="field"><label for="sg-city">Город</label><input class="input" id="sg-city" name="city" placeholder="Необязательно"></div></div>
      <p class="error" id="sgErr" role="alert" hidden></p>
      <button class="btn primary lg block" type="submit">Создать профиль</button>
      <p class="hint" style="text-align:center">Создавая профиль, вы соглашаетесь с <a href="/terms" target="_blank" rel="noopener">правилами</a> и <a href="/privacy" target="_blank" rel="noopener">политикой конфиденциальности</a>.</p>
    </form>`));
  let avatar = null;
  bindPhoto(o, 'sg-ph', (d) => (avatar = d));
  $('#sgF', o).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    const err = $('#sgErr', o);
    const body = Object.fromEntries(new FormData(e.target));
    body.username = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
    body.ticket = s.ticket;
    body.theme = CG.stored() || '';
    if (avatar) body.avatar = avatar;
    btn.disabled = true;
    try {
      const { user } = await api('/auth/complete', { body });
      state.me = user;
      closeOverlay();
      toast(`Добро пожаловать, ${user.name}!`);
      state.onboard = !after;
      await afterLogin();
      if (after) after(); else route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  };
}

async function afterLogin() {
  await refreshMe();
  if (!state.me) return;
  await loadThemes();
  await ensureTheme(state.me.theme);
  if (state.me.theme) { CG.apply(state.me.theme); CG.store(state.me.theme); nextOnboard(); }
  else if (CG.stored()) { await saveTheme(CG.stored(), true); nextOnboard(); }
  else setTimeout(() => openPicker({ onboarding: true }), 400);
}
// После регистрации (и выбора персонажа) — предложить, на кого подписаться
function nextOnboard() {
  if (!state.onboard) return;
  state.onboard = false;
  setTimeout(() => openFollowSuggest(true), 700);
}

/* ----- фото профиля при регистрации ----- */
const photoField = (id, src, hint) => `<div class="ph-pick">
    <label for="${id}" class="ph-ava" id="${id}-p" aria-label="Выбрать фото профиля">${src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : ic.image}</label>
    <div class="stack" style="gap:4px;min-width:0"><span class="label">Фото профиля</span>
      <label for="${id}" class="btn sm" style="align-self:flex-start">${ic.image}${src ? 'Сменить фото' : 'Выбрать фото'}</label>
      <span class="hint">${esc(hint)}</span></div>
    <input type="file" id="${id}" accept="image/*" hidden></div>`;
function bindPhoto(root, id, cb) {
  $('#' + id, root).onchange = async (e) => {
    try {
      const d = await readImage(e.target.files[0], 480);
      $('#' + id + '-p', root).innerHTML = `<img src="${d}" alt="">`;
      cb(d);
    } catch (x) { toast(x.message); }
  };
}

/* ----- рекомендации: на кого подписаться ----- */
async function toggleFollow(b) {
  b.disabled = true;
  try {
    const r = await api(`/users/${encodeURIComponent(b.dataset.fol)}/follow`, { method: 'POST' });
    b.classList.toggle('on', r.following);
    b.classList.toggle('primary', !r.following);
    b.textContent = r.following ? 'Вы подписаны' : 'Подписаться';
  } catch (e) { toast(e.message); }
  b.disabled = false;
}
function bindFollow(root) {
  $$('[data-fol]', root).forEach((b) => (b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(b); }));
}
const suggItem = (u) => `<div class="item sugg-item"><a href="${userLink(u)}" data-close>${ava(u, 46)}</a>
  <span style="min-width:0;flex:1"><a href="${userLink(u)}" data-close><h3>${esc(u.name)}${vmark(u)}</h3></a>
    <span class="meta">@${esc(u.username)} · ${esc(u.reason)}</span></span>
  <button class="btn sm primary" data-fol="${esc(u.username)}">Подписаться</button></div>`;
const suggCard = (u) => `<div class="sugg-card"><a href="${userLink(u)}">${ava(u, 64)}<b>${esc(u.name)}${vmark(u)}</b><span class="meta">${esc(u.reason)}</span></a>
  <button class="btn sm primary" data-fol="${esc(u.username)}">Подписаться</button></div>`;
async function openFollowSuggest(onboarding = false) {
  let r;
  try { r = await api('/suggestions?limit=15'); } catch { return; }
  if (!r.users.length) { if (!onboarding) toast('Пока некого посоветовать — вы подписаны на всех'); return; }
  const o = openOverlay(sheet(onboarding ? 'На кого подписаться' : 'Рекомендации', `
    <p class="muted" style="margin-bottom:12px">${onboarding ? 'Подпишитесь на косплееров — их' : 'Их'} новые работы будут в ленте «Подписки».</p>
    <div class="list">${r.users.map(suggItem).join('')}</div>
    <div class="row" style="gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn" id="sgAll">Подписаться на всех</button>
      <button class="btn primary" data-close style="flex:1">${onboarding ? 'Готово' : 'Закрыть'}</button></div>`));
  bindFollow(o);
  $('#sgAll', o).onclick = async (e) => {
    e.currentTarget.disabled = true;
    for (const b of $$('[data-fol]', o)) if (!b.classList.contains('on')) await toggleFollow(b);
    toast('Вы подписались');
  };
}
const SUGG_KEY = 'cg-sugg-hide';
const suggHidden = () => { try { return Date.now() - Number(localStorage.getItem(SUGG_KEY) || 0) < 7 * 864e5; } catch { return false; } };

async function logout() {
  await api('/logout', { method: 'POST' }).catch(() => {});
  state.me = null;
  state.unread = state.unreadDm = 0;
  toast('Вы вышли');
  if (location.hash && location.hash !== '#/') location.hash = '#/'; else route();
}

async function refreshMe() {
  try {
    const r = await api('/me');
    state.me = r.user;
    state.unread = r.unread || 0;
    state.unreadDm = r.unreadDm || 0;
  } catch {}
  renderChrome();
}
async function refreshBadges() {
  try {
    const r = await api('/me');
    const changed = r.unread !== state.unread || r.unreadDm !== state.unreadDm;
    state.unread = r.unread || 0;
    state.unreadDm = r.unreadDm || 0;
    if (changed) renderChrome();
  } catch {}
}

/* ================= карточки и просмотр ================= */
const likeBtn = (p) => `<button class="like ${p.liked ? 'on' : ''}" data-like="${p.id}" aria-pressed="${p.liked}" aria-label="Нравится">${ic.heart}<span class="num" data-likes="${p.id}">${p.likeCount}</span></button>`;
const saveBtn = (p) => `<button class="iconbtn save ${p.saved ? 'on' : ''}" data-save="${p.id}" aria-pressed="${p.saved}" aria-label="${p.saved ? 'Убрать из сохранённого' : 'Сохранить'}">${ic.save}</button>`;
function card(p) {
  const a = p.author || {};
  return `<article class="card" data-post="${p.id}">
    <button class="card-img" data-open="${p.id}" aria-label="Открыть: ${esc(p.character || 'публикация')}">
      <img src="${esc(p.slides[0]?.image)}" alt="" loading="lazy" decoding="async">
      <span class="tl">${p.kind === 'process' ? '<span class="pill accent">Процесс</span>' : ''}${p.source ? `<span class="pill dark">${SOURCES[p.source]}</span>` : ''}</span>
      ${p.slides.length > 1 ? `<span class="tr"><span class="pill dark num">${p.slides.length}</span></span>` : ''}
    </button>
    <div class="card-t">${esc(p.character || 'Без названия')}</div>
    <div class="card-m"><a class="au" href="${userLink(a)}">${ava(a, 20)}<span>${esc(a.username)}</span></a>${likeBtn(p)}</div>
  </article>`;
}
const tile = (p) => `<button class="tile" data-open="${p.id}" aria-label="${esc(p.character || 'Публикация')}"><img src="${esc(p.slides[0]?.image)}" alt="" loading="lazy" decoding="async">${p.slides.length > 1 ? `<span class="tr" style="color:#fff;width:20px">${ic.layers}</span>` : ''}</button>`;

async function toggleLike(id) {
  const r = await api(`/posts/${id}/like`, { method: 'POST' });
  $$(`[data-like="${id}"]`).forEach((x) => {
    x.classList.toggle('on', r.liked);
    x.setAttribute('aria-pressed', String(r.liked));
    x.classList.remove('pop'); void x.offsetWidth; if (r.liked) x.classList.add('pop');
    const lbl = $('.vt', x);
    if (lbl) lbl.textContent = r.liked ? 'Голос учтён' : 'Голосовать';
  });
  $$(`[data-likes="${id}"]`).forEach((x) => (x.textContent = r.likeCount));
  return r;
}
function bindCards(root) {
  $$('[data-open]', root).forEach((b) => (b.onclick = () => openPost(b.dataset.open)));
  $$('[data-like]', root).forEach((b) => (b.onclick = () => requireAuth(() => toggleLike(b.dataset.like).catch((e) => toast(e.message)))));
  $$('[data-save]', root).forEach((b) => (b.onclick = () => requireAuth(async () => {
    try {
      const r = await api(`/posts/${b.dataset.save}/save`, { method: 'POST' });
      $$(`[data-save="${b.dataset.save}"]`).forEach((x) => { x.classList.toggle('on', r.saved); x.setAttribute('aria-pressed', String(r.saved)); });
      toast(r.saved ? 'Сохранено в «Сохранённое»' : 'Убрано из сохранённого');
    } catch (e) { toast(e.message); }
  })));
}

function carousel(p) {
  const n = p.slides.length;
  const step = p.slides.some((s) => s.caption);
  return `<div class="carousel ${step ? 'has-step' : ''}" data-i="0" data-n="${n}">
    <div class="track">${p.slides.map((s, i) => `<div class="slide"><img src="${esc(s.image)}" alt="${esc(p.character || 'Фото')}, фото ${i + 1}" draggable="false">${
      s.caption ? `<div class="step">${p.kind === 'process' ? `<b>Шаг ${i + 1} из ${n}</b>` : ''}${esc(s.caption)}</div>` : ''}</div>`).join('')}</div>
    ${n > 1 ? `<button class="nav prev" aria-label="Предыдущее фото" hidden>‹</button><button class="nav next" aria-label="Следующее фото">›</button>
      <div class="dots">${p.slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
    <div class="heart">${ic.heart}</div>
  </div>`;
}
function bindCarousel(c, onDouble) {
  const n = +c.dataset.n;
  const track = $('.track', c);
  const go = (to) => {
    const i = Math.max(0, Math.min(n - 1, to));
    c.dataset.i = i;
    track.style.transform = `translateX(-${i * 100}%)`;
    if ($('.prev', c)) { $('.prev', c).hidden = i === 0; $('.next', c).hidden = i === n - 1; }
    $$('.dots i', c).forEach((x, j) => x.classList.toggle('on', j === i));
  };
  $('.prev', c)?.addEventListener('click', () => go(+c.dataset.i - 1));
  $('.next', c)?.addEventListener('click', () => go(+c.dataset.i + 1));
  let x0 = null, y0 = 0, last = 0, swiping = false;
  c.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; swiping = false; }, { passive: true });
  c.addEventListener('touchmove', (e) => {
    if (x0 === null || n < 2) return;
    const dx = e.touches[0].clientX - x0;
    if (!swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.touches[0].clientY - y0)) { swiping = true; track.style.transition = 'none'; }
    if (swiping) track.style.transform = `translateX(calc(-${+c.dataset.i * 100}% + ${dx}px))`;
  }, { passive: true });
  c.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    track.style.transition = '';
    if (swiping) { go(+c.dataset.i + (Math.abs(dx) > 50 ? (dx < 0 ? 1 : -1) : 0)); return; }
    const t = Date.now();
    if (t - last < 320) { onDouble(); last = 0; } else last = t;
  });
  c.addEventListener('dblclick', onDouble);
  return go;
}

const commentHtml = (c, p) => {
  const can = state.me && (state.me.id === c.authorId || state.me.id === p.authorId || isMod(state.me));
  return `<div class="comment">${ava(c.author, 30)}<div class="t"><a href="${userLink(c.author)}"><b>${esc(c.author?.username)}</b></a>${esc(c.text)}
    <div class="small muted">${ago(c.createdAt)}</div></div>
    ${can ? `<button class="iconbtn" data-delc="${c.id}" aria-label="Удалить комментарий">${ic.trash}</button>` : ''}</div>`;
};

function detailHtml(p, page) {
  const own = state.me && (state.me.id === p.authorId || isMod(state.me));
  const src = p.source ? SOURCES[p.source] : '';
  const sub = [p.fandom, src && src.toLowerCase() !== String(p.fandom).toLowerCase() ? src : ''].filter(Boolean).join(' · ');
  return `<div class="detail" ${page ? '' : 'role="dialog" aria-modal="true"'} aria-label="${esc(p.character || 'Публикация')}">
    ${carousel(p)}
    <div class="side">
      <div class="top">${page ? `<a class="iconbtn" href="#/" aria-label="В ленту">${ic.back}</a>` : ''}
        <div style="flex:1;min-width:0">${who(p.author, ago(p.createdAt))}</div>
        <button class="iconbtn" data-share aria-label="Поделиться">${ic.share}</button>
        ${own ? `<button class="iconbtn" data-edit aria-label="Изменить">${ic.edit}</button><button class="iconbtn" data-delpost aria-label="Удалить">${ic.trash}</button>`
          : `<button class="iconbtn" data-report="post:${p.id}" aria-label="Пожаловаться">${ic.flag}</button>`}
        ${page ? '' : `<button class="iconbtn" data-close aria-label="Закрыть">${ic.close}</button>`}
      </div>
      <div class="scroll">
        <div><div class="title">${esc(p.character || 'Без названия')}</div>${sub ? `<div class="muted small" style="margin-top:4px">${esc(sub)}</div>` : ''}
          ${p.charId && CG.get(p.charId).id === p.charId ? `<a class="chip tag" style="margin-top:8px" href="#/?char=${p.charId}">Все косплеи: ${esc(CG.get(p.charId).name)}</a>` : ''}</div>
        ${p.caption ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(p.caption)}</p>` : ''}
        ${p.materials.length ? `<div class="chips wrap">${p.materials.map((m) => `<a class="chip tag" href="#/search?q=${encodeURIComponent(m)}">${esc(m)}</a>`).join('')}</div>` : ''}
        ${p.hours ? `<div class="small muted"><b style="color:var(--ink)">${p.hours}</b> ${plural(p.hours, 'час', 'часа', 'часов')} работы</div>` : ''}
        <div class="hr"></div>
        <div id="cmts" class="stack" style="gap:12px">${p.comments.map((c) => commentHtml(c, p)).join('') || '<p class="muted small" id="noC">Пока без комментариев. Спросите про материалы или технику.</p>'}</div>
      </div>
      <div class="bar">${likeBtn(p)}<button class="iconbtn" data-focusc aria-label="Комментировать">${ic.comment}</button><span class="grow"></span>${saveBtn(p)}</div>
      <form class="cform" id="cForm"><input class="input" name="text" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Комментарий" aria-label="Комментарий">
        <button class="btn primary" aria-label="Отправить комментарий">${ic.send}</button></form>
    </div></div>`;
}

function bindDetail(root, p) {
  const c = $('.carousel', root);
  const go = bindCarousel(c, () => {
    const h = $('.heart', c);
    h.classList.remove('go'); void h.offsetWidth; h.classList.add('go');
    const b = $(`[data-like="${p.id}"]`, root);
    if (b && !b.classList.contains('on')) toggleLike(p.id).catch((e) => toast(e.message));
  });
  const keys = (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') go(+c.dataset.i + 1);
    if (e.key === 'ArrowLeft') go(+c.dataset.i - 1);
  };
  document.addEventListener('keydown', keys);
  bindCards(root);
  bindReports(root);
  $('[data-share]', root).onclick = () => share(`#/p/${p.id}`, p.character);
  $('[data-focusc]', root).onclick = () => $('#cForm input', root).focus();
  $('[data-edit]', root)?.addEventListener('click', () => openEdit(p));
  $('[data-delpost]', root)?.addEventListener('click', confirmTwice(async () => {
    await api('/posts/' + p.id, { method: 'DELETE' });
    toast('Публикация удалена');
    closeOverlay({ silent: true });
    if (curKey() === 'p') location.hash = '#/'; else route();
  }, 'Нажмите ещё раз, чтобы удалить публикацию'));
  $('#cForm', root).onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      const inp = e.target.elements.text;
      const text = inp.value.trim();
      if (!text) return;
      try {
        const { comment } = await api(`/posts/${p.id}/comments`, { body: { text } });
        inp.value = '';
        $('#noC', root)?.remove();
        $('#cmts', root).insertAdjacentHTML('beforeend', commentHtml(comment, p));
        bindDelComments(root);
        $('#cmts', root).lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } catch (err) { toast(err.message); }
    });
  };
  bindDelComments(root);
  return () => document.removeEventListener('keydown', keys);
}
function bindDelComments(root) {
  $$('[data-delc]', root).forEach((b) => (b.onclick = confirmTwice(async () => {
    await api('/comments/' + b.dataset.delc, { method: 'DELETE' });
    b.closest('.comment').remove();
    toast('Комментарий удалён');
  }, 'Нажмите ещё раз, чтобы удалить комментарий')));
}

async function openPost(id) {
  let p;
  try { ({ post: p } = await api('/posts/' + id)); } catch (e) { return toast(e.message); }
  let off = null;
  const o = openOverlay(detailHtml(p, false), { full: true, onClose: () => off?.() });
  off = bindDetail(o, p);
}
async function pagePost(id) {
  let p;
  try { ({ post: p } = await api('/posts/' + id)); }
  catch { view().innerHTML = '<div class="empty"><h2>Публикация не найдена</h2><p>Возможно, автор её удалил.</p><a class="btn" href="#/">В ленту</a></div>'; return; }
  view().innerHTML = `<div class="page-detail">${detailHtml(p, true)}</div>`;
  state.cleanup = bindDetail(view(), p);
}

function confirmTwice(fn, msg) {
  return async function (e) {
    const b = e.currentTarget;
    if (b.dataset.armed !== '1') {
      b.dataset.armed = '1';
      toast(msg);
      setTimeout(() => delete b.dataset.armed, 3200);
      return;
    }
    delete b.dataset.armed;
    try { await fn(); } catch (err) { toast(err.message); }
  };
}

function bindReports(root) {
  $$('[data-report]', root).forEach((b) => (b.onclick = () => requireAuth(() => {
    const [type, id] = b.dataset.report.split(':');
    const o = openOverlay(sheet('Пожаловаться', `<form class="form" id="repF">
      <div class="field"><label for="rep-r">Что не так?</label><select class="input" id="rep-r" name="reason">
        <option>Спам или реклама</option><option>Оскорбления</option><option>Чужие фото без указания автора</option><option>Неприемлемый контент</option><option>Другое</option></select></div>
      <button class="btn primary block">Отправить жалобу</button></form>`));
    $('#repF', o).onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/reports', { body: { type, id, reason: e.target.elements.reason.value } });
        closeOverlay();
        toast('Жалоба отправлена модераторам');
      } catch (err) { toast(err.message); }
    };
  })));
}

/* ================= создание и редактирование ================= */
const charDatalist = () => `<datalist id="charList">${CG.THEMES.filter((t) => t.cat).map((t) => `<option value="${esc(t.name)}">${esc(t.from)}</option>`).join('')}</datalist>`;
const CAT_TO_SOURCE = { anime: 'anime', manga: 'manga', book: 'book', film: 'film', game: 'game' };
const findChar = (name) => CG.THEMES.find((t) => t.cat && t.name.toLowerCase() === String(name || '').trim().toLowerCase());
function bindCharInput(root, hint) {
  const inp = $('[name=character]', root);
  const sync = () => {
    const t = findChar(inp.value);
    root.dataset.charId = t ? t.id : '';
    if (t) {
      $('#cr-src', root).value = CAT_TO_SOURCE[t.cat];
      const fa = $('[name=fandom]', root);
      if (fa && !fa.value) fa.value = t.from;
      if (hint) hint.textContent = `Персонаж из каталога: ${t.name} · ${t.from}. Фото появится на его карточке.`;
    } else if (hint) hint.textContent = 'Если персонаж есть в каталоге, ваше фото появится на его карточке.';
  };
  inp.addEventListener('input', sync);
  sync();
}
const sourceSelect = (val = '') => `<select class="input" id="cr-src" name="source">
  <option value="">Не указано</option>${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('')}</select>`;

function openCreate(kind = 'costume') {
  const shots = [];
  const o = openOverlay(sheet('Новая публикация', `<form class="form" id="crF" novalidate>
      <div class="seg" role="tablist">
        <button type="button" data-kind="costume">Костюм</button>
        <button type="button" data-kind="process">Процесс</button>
        <button type="button" data-kind="story">На 24 часа</button>
      </div>
      <p class="hint" id="crHint"></p>
      <label class="drop" id="drop" for="crFiles">${ic.image}<b>Добавить фото</b><span class="small">С телефона или компьютера</span></label>
      <input type="file" id="crFiles" accept="image/*" multiple hidden>
      <div class="shots" id="shots"></div>
      <div id="postF" class="form">
        <div class="field"><label for="cr-ch">Персонаж или название образа</label><input class="input" id="cr-ch" name="character" maxlength="80" list="charList" autocomplete="off" placeholder="Начните вводить: Мику, Годжо, Эльза…">
          ${charDatalist()}<span class="hint" id="crChHint">Если персонаж есть в каталоге, ваше фото появится на его карточке.</span></div>
        <div class="row"><div class="field"><label for="cr-src">Откуда персонаж</label>${sourceSelect()}</div>
          <div class="field"><label for="cr-fa">Произведение</label><input class="input" id="cr-fa" name="fandom" maxlength="80" placeholder="Название аниме, фильма…"></div></div>
        <div class="field"><label for="cr-ca">Описание</label><textarea class="input" id="cr-ca" name="caption" maxlength="2200" placeholder="Что было самым сложным? Чем гордитесь?"></textarea></div>
        <div class="row"><div class="field"><label for="cr-ma">Материалы через запятую</label><input class="input" id="cr-ma" name="materials" maxlength="300" placeholder="EVA 10 мм, бархат"></div>
          <div class="field" style="flex:0 1 130px"><label for="cr-ho">Часов работы</label><input class="input num" id="cr-ho" name="hours" type="number" inputmode="numeric" min="0" max="5000" placeholder="40"></div></div>
      </div>
      <div id="storyF" class="field" hidden><label for="cr-st">Подпись</label><input class="input" id="cr-st" name="text" maxlength="120" placeholder="Крашу шлем, день 3"></div>
      <p class="error" id="crE" role="alert" hidden></p>
      <button class="btn primary lg block" type="submit" id="crB">Опубликовать</button>
    </form>`));
  const draw = () => {
    $('#shots', o).innerHTML = shots.map((s, i) => `<div class="shot"><img src="${s.image}" alt="Фото ${i + 1}">
      ${kind === 'process' ? `<input class="input" data-cap="${i}" value="${esc(s.caption)}" maxlength="300" placeholder="Шаг ${i + 1}: что происходит?" aria-label="Подпись к шагу ${i + 1}">` : `<span class="small muted">${i ? 'Фото ' + (i + 1) : 'Обложка'}</span>`}
      <span class="ctrls">${i ? `<button type="button" class="iconbtn" data-up="${i}" aria-label="Переместить выше">${ic.up}</button>` : ''}
      <button type="button" class="iconbtn" data-rm="${i}" aria-label="Убрать фото ${i + 1}">${ic.close}</button></span></div>`).join('');
    $$('[data-cap]', o).forEach((inp) => inp.addEventListener('input', () => (shots[+inp.dataset.cap].caption = inp.value)));
    $$('[data-rm]', o).forEach((b) => (b.onclick = () => { shots.splice(+b.dataset.rm, 1); draw(); }));
    $$('[data-up]', o).forEach((b) => (b.onclick = () => { const i = +b.dataset.up; [shots[i - 1], shots[i]] = [shots[i], shots[i - 1]]; draw(); }));
    const max = kind === 'story' ? 1 : 10;
    $('#drop', o).hidden = shots.length >= max;
    $('#crFiles', o).multiple = kind !== 'story';
  };
  const setKind = (k) => {
    kind = k;
    $$('[data-kind]', o).forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
    $('#postF', o).hidden = k === 'story';
    $('#storyF', o).hidden = k !== 'story';
    $('#crHint', o).textContent = k === 'process' ? 'Добавьте фото по порядку (до 10) и подпишите каждый шаг.'
      : k === 'story' ? 'Одно фото незаконченной работы. Исчезнет через 24 часа.' : 'До 10 фото. Первое станет обложкой.';
    if (k === 'story') shots.splice(1);
    draw();
  };
  const add = async (files) => {
    const limit = kind === 'story' ? 1 : 10;
    const list = [...files];
    if (list.length > limit - shots.length) toast(`Можно добавить ещё ${limit - shots.length} фото`);
    for (const f of list.slice(0, limit - shots.length)) {
      try { shots.push({ image: await readImage(f), caption: '' }); } catch (e) { toast(e.message); }
    }
    draw();
  };
  $$('[data-kind]', o).forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));
  bindCharInput($('#crF', o), $('#crChHint', o));
  $('#crFiles', o).onchange = (e) => { add(e.target.files); e.target.value = ''; };
  const drop = $('#drop', o);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); };
  $('#crF', o).onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#crE', o);
    err.hidden = true;
    if (!shots.length) { err.textContent = 'Добавьте хотя бы одно фото'; err.hidden = false; return; }
    const b = $('#crB', o);
    b.disabled = true;
    b.textContent = 'Загружаем…';
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (kind === 'story') {
        await api('/stories', { body: { image: shots[0].image, text: fd.text } });
        toast('Опубликовано на 24 часа');
      } else {
        await api('/posts', { body: { ...fd, kind, slides: shots, charId: $('#crF', o).dataset.charId || '' } });
        toast('Опубликовано');
        loadChars(true);
      }
      closeOverlay({ silent: true });
      const target = kind === 'process' ? '#/process' : '#/';
      if ((location.hash || '#/') === target) route(); else location.hash = target;
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      b.disabled = false;
      b.textContent = 'Опубликовать';
    }
  };
  setKind(kind);
}

function openEdit(p) {
  const o = openOverlay(sheet('Изменить публикацию', `<form class="form" id="edF">
    <div class="field"><label for="ed-ch">Персонаж или название образа</label><input class="input" id="ed-ch" name="character" maxlength="80" list="charList" autocomplete="off" value="${esc(p.character)}">${charDatalist()}<span class="hint" id="edHint"></span></div>
    <div class="row"><div class="field"><label for="cr-src">Откуда персонаж</label>${sourceSelect(p.source)}</div>
      <div class="field"><label for="ed-fa">Произведение</label><input class="input" id="ed-fa" name="fandom" maxlength="80" value="${esc(p.fandom)}"></div></div>
    <div class="field"><label for="ed-ca">Описание</label><textarea class="input" id="ed-ca" name="caption" maxlength="2200">${esc(p.caption)}</textarea></div>
    <div class="row"><div class="field"><label for="ed-ma">Материалы через запятую</label><input class="input" id="ed-ma" name="materials" maxlength="300" value="${esc(p.materials.join(', '))}"></div>
      <div class="field" style="flex:0 1 130px"><label for="ed-ho">Часов работы</label><input class="input num" id="ed-ho" name="hours" type="number" inputmode="numeric" min="0" max="5000" value="${p.hours || ''}"></div></div>
    ${p.kind === 'process' ? p.slides.map((s, i) => `<div class="field"><label for="ed-c${i}">Шаг ${i + 1}</label><input class="input" id="ed-c${i}" data-step="${i}" maxlength="300" value="${esc(s.caption)}"></div>`).join('') : ''}
    <p class="error" id="edE" role="alert" hidden></p>
    <button class="btn primary lg block">Сохранить изменения</button></form>`));
  bindCharInput($('#edF', o), $('#edHint', o));
  $('#edF', o).onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    body.charId = $('#edF', o).dataset.charId || '';
    if (p.kind === 'process') body.captions = $$('[data-step]', o).map((x) => x.value);
    try {
      await api('/posts/' + p.id, { method: 'PATCH', body });
      toast('Изменения сохранены');
      loadChars(true);
      closeOverlay({ silent: true });
      await route();
      if (curKey() !== 'p') openPost(p.id);
    } catch (err) { const x = $('#edE', o); x.textContent = err.message; x.hidden = false; }
  };
}

/* ================= «На 24 часа» ================= */
function seenMap() { try { return JSON.parse(localStorage.getItem('cg-seen') || '{}'); } catch { return {}; } }
async function wipRow() {
  const { groups } = await api('/stories');
  state.groups = groups;
  const seen = seenMap();
  return `<div class="wip" aria-label="Работы в процессе, исчезают через 24 часа">
    <button class="wip-item add" data-act="create-story"><span class="ring"><span class="add">${ic.plus}</span></span><span class="n">Ваша работа</span></button>
    ${groups.map((g, i) => `<button class="wip-item ${seen[g.author.id] === g.items.at(-1).id ? 'seen' : ''}" data-story="${i}" aria-label="Работа в процессе: ${esc(g.author.username)}">
      <span class="ring"><img src="${esc(g.items.at(-1).image)}" alt="" loading="lazy"></span><span class="n">${esc(g.author.username)}</span></button>`).join('')}</div>`;
}
function openStory(gi, ii = 0) {
  const g = state.groups[gi];
  if (!g) return closeOverlay();
  const s = g.items[ii];
  if (ii === g.items.length - 1) {
    const m = seenMap();
    m[g.author.id] = s.id;
    try { localStorage.setItem('cg-seen', JSON.stringify(m)); } catch {}
  }
  const o = openOverlay(`<div class="story" role="dialog" aria-modal="true" aria-label="Работа в процессе: ${esc(g.author.username)}">
    <img src="${esc(s.image)}" alt="">
    <div class="bars">${g.items.map((_, i) => `<span class="bar"><i style="width:${i < ii ? 100 : 0}%"></i></span>`).join('')}</div>
    <a class="sh" href="${userLink(g.author)}">${ava(g.author, 32)}<b>${esc(g.author.username)}</b><span class="small" style="opacity:.85">${ago(s.createdAt)}</span></a>
    ${s.text ? `<div class="txt">${esc(s.text)}</div>` : ''}
    <button class="zone l" aria-label="Назад"></button><button class="zone r" aria-label="Дальше"></button>
    <button class="iconbtn x" data-close aria-label="Закрыть">${ic.close}</button></div>`, {
    full: true,
    onClose: () => $$('[data-story]').forEach((b) => { const gg = state.groups[+b.dataset.story]; if (gg && seenMap()[gg.author.id] === gg.items.at(-1).id) b.classList.add('seen'); }),
  });
  const next = () => (ii + 1 < g.items.length ? openStory(gi, ii + 1) : gi + 1 < state.groups.length ? openStory(gi + 1) : closeOverlay());
  const prev = () => (ii > 0 ? openStory(gi, ii - 1) : gi > 0 ? openStory(gi - 1) : null);
  $('.zone.r', o).onclick = next;
  $('.zone.l', o).onclick = prev;
  const bar = $$('.bar i', o)[ii];
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; });
  else bar.style.width = '100%';
  clearTimeout(state.timers.story);
  state.timers.story = setTimeout(next, 5000);
}

/* ================= стартовый экран ================= */
function pageLanding() {
  const sel = CG.stored() || 'classic';
  view().innerHTML = `<section class="land">
    <div><h1>Кто вы сегодня?</h1>
      <p class="lead">Выберите персонажа из аниме, манги, книг, фильмов или игр — Cosplaygram оденется в его стиль. Дальше: ваши костюмы, процесс создания, мастера и мероприятия рядом.</p></div>
    <div id="land" data-sel="${sel}">${charTabs()}<div class="char-grid" style="margin-top:12px"></div></div>
    <div class="land-cta"><div class="t"><span class="small muted">Ваш стиль</span><br><b id="lnN">${esc(CG.get(sel).name)}</b></div>
      <div class="acts"><button class="btn" data-act="login">Войти</button><button class="btn primary" data-act="register">Зарегистрироваться</button></div></div>
    <div class="perks">
      <div><b>Процесс по шагам</b><span>От выкройки до готового образа, с подписью к каждому фото.</span></div>
      <div><b>Мастера рядом</b><span>Швеи, реквизиторы, мастера париков и фотографы вашего города.</span></div>
      <div><b>Весь мир</b><span>Косплееры из ${C.LIST.length} стран: лента и чат вашей страны, мероприятия по всему миру.</span></div>
      <div><b><a class="link" href="#/events">Мероприятия и итоги →</a></b><span>Фестивали, косплей-шоу и встречи — с отметкой «Пойду».</span></div>
    </div>
    <p class="hint">Нажмите на персонажа, чтобы увидеть косплеи участников и свободные фото с Wikimedia Commons. <a class="link" href="#/credits">Авторы фото</a></p>
  </section>`;
  bindCharPicker($('#land'), (t) => { CG.store(t.id); $('#lnN').textContent = t.name; });
}

/* ================= лента ================= */
const FILTERS = [['', 'Все'], ['following', 'Подписки'], ['near', 'Моя страна'], ['process', 'Процесс'], ['anime', 'Аниме'], ['manga', 'Манга'], ['book', 'Книги'], ['film', 'Фильмы'], ['game', 'Игры'], ['original', 'Ориджинал']];
function feedQuery(f, before) {
  const q = new URLSearchParams();
  if (f.startsWith('char:')) q.set('char', f.slice(5));
  else if (f === 'following') q.set('mode', 'following');
  else if (f === 'process') q.set('kind', 'process');
  else if (f === 'near') q.set('country', state.me?.country || '');
  else if (f) q.set('source', f);
  if (before) q.set('before', before);
  return '/feed?' + q;
}
const monthLabel = (m) => { const s = String(m || '').replace(/\s*г\.?$/, ''); return s.charAt(0).toUpperCase() + s.slice(1); };
function spotlight(top, month) {
  const p = top[0];
  if (!p) return '';
  return `<section class="spot" aria-label="Костюм месяца">
    <button class="pic" data-open="${p.id}" aria-label="Открыть: ${esc(p.character)}"><img src="${esc(p.slides[0]?.image)}" alt=""></button>
    <div class="body">
      <span class="kick">${ic.trophy}Костюм месяца<span class="mo"> · ${esc(monthLabel(month))}</span></span>
      <h1>${esc(p.character)}</h1>
      ${who(p.author, p.author?.city, 30)}
      <div class="facts"><span><b class="num">${p.score}</b>${plural(p.score, 'голос', 'голоса', 'голосов')}</span>${p.hours ? `<span><b class="num">${p.hours}</b>${plural(p.hours, 'час', 'часа', 'часов')} работы</span>` : ''}</div>
      <div class="acts"><button class="btn primary" data-open="${p.id}">Смотреть</button>
        <button class="btn like ${p.liked ? 'on' : ''}" data-like="${p.id}" aria-pressed="${p.liked}">${ic.heart}<span class="vt">${p.liked ? 'Голос учтён' : 'Голосовать'}</span></button></div>
      ${top.length > 1 ? `<div class="rest"><span>Дальше в рейтинге</span>${top.slice(1).map((x) => `<button data-open="${x.id}" aria-label="${esc(x.character)}"><img src="${esc(x.slides[0]?.image)}" alt=""></button>`).join('')}</div>` : ''}
    </div></section>`;
}

async function pageFeed(params) {
  const charF = params.get('char') && CG.get(params.get('char')).id === params.get('char') ? params.get('char') : '';
  if (charF) return pageCharFeed(charF);
  const f = FILTERS.some(([k]) => k === params.get('f')) ? params.get('f') : '';
  view().innerHTML = '<div class="skel" style="height:90px;margin-bottom:20px"></div><div class="skel" style="height:260px"></div>';
  const [wip, { posts }, contest, { events }, sugg] = await Promise.all([
    wipRow(), api(feedQuery(f)), f ? { top: [] } : api('/contest'), f ? { events: [] } : api('/events'),
    state.me && !f && !suggHidden() ? api('/suggestions?limit=10').catch(() => ({ users: [] })) : { users: [] },
  ]);
  const showSugg = sugg.users.length > 0 && sugg.following < 30;
  const next = events.find((e) => e.date >= todayLocal());
  const label = FILTERS.find(([k]) => k === f)[1];
  const empty = {
    following: ['Здесь будут работы тех, на кого вы подписаны', 'Найдите мастеров и подпишитесь.', '<a class="btn" href="#/people">Найти мастеров</a>'],
    near: ['В вашей стране пока нет публикаций', 'Станьте первым — покажите свой костюм.', '<button class="btn primary" data-act="create">Опубликовать</button>'],
    process: ['Пока нет пошаговых публикаций', 'Покажите, как вы делали свой костюм.', '<button class="btn primary" data-act="create-process">Показать процесс</button>'],
  }[f] || [f ? `Пока нет работ в разделе «${label}»` : 'Пока нет публикаций', 'Станьте первым — покажите свой костюм.', '<button class="btn primary" data-act="create">Опубликовать</button>'];
  view().innerHTML = `
    ${wip}
    ${f ? '' : spotlight(contest.top, contest.month)}
    ${next ? `<a class="next-ev" href="#/events"><span class="muted" style="width:22px;display:inline-flex">${ic.calendar}</span><span class="d">${+next.date.slice(8)} ${MONTHS[+next.date.slice(5, 7) - 1]}</span><span class="t"><b>${esc(next.title)}</b><span>${esc(next.city)}${next.goingCount ? ` · идут ${next.goingCount}` : ''}</span></span><span class="muted" style="width:18px;display:inline-flex">${ic.right}</span></a>` : ''}
    ${showSugg ? `<section class="sugg" id="sugg"><div class="sugg-h"><h2>Рекомендуем подписаться</h2>
      <span style="display:flex;gap:4px"><button class="btn sm ghost" id="sgMore">Все</button><button class="iconbtn" id="sgHide" aria-label="Скрыть рекомендации">${ic.close}</button></span></div>
      <div class="sugg-row">${sugg.users.map(suggCard).join('')}</div></section>` : ''}
    <div class="filters"><div class="chips" role="tablist" aria-label="Фильтр работ">${FILTERS.filter(([k]) => k !== 'near' || C.valid(state.me?.country)).map(([k, v]) => [k, k === 'near' ? `${flag(state.me.country)} ${C.name(state.me.country)}` : v]).map(([k, v]) => `<a class="chip ${k === f ? 'on' : ''}" href="#/${k ? '?f=' + k : ''}" role="tab" aria-selected="${k === f}">${v}</a>`).join('')}</div></div>
    ${posts.length ? `<div class="grid" id="cards">${posts.map(card).join('')}</div><div class="more" id="more"></div>`
      : `<div class="empty"><h2>${empty[0]}</h2><p>${empty[1]}</p>${empty[2]}</div>`}`;
  $$('[data-story]').forEach((b) => (b.onclick = () => openStory(+b.dataset.story)));
  bindCards(view());
  if (showSugg) {
    bindFollow($('#sugg'));
    $('#sgMore').onclick = () => openFollowSuggest(false);
    $('#sgHide').onclick = () => { try { localStorage.setItem(SUGG_KEY, String(Date.now())); } catch {} $('#sugg').remove(); toast('Скрыли на неделю'); };
  }
  if (posts.length >= 20) infinite(posts, f);
}
function infinite(posts, f) {
  const more = $('#more');
  let busy = false, done = false;
  const load = async () => {
    if (busy || done) return;
    busy = true;
    more.innerHTML = '<span class="muted small">Загружаем…</span>';
    try {
      const r = await api(feedQuery(f, posts.at(-1).createdAt));
      posts.push(...r.posts);
      const wrap = document.createElement('div');
      wrap.innerHTML = r.posts.map(card).join('');
      bindCards(wrap);
      $('#cards').append(...wrap.children);
      if (r.posts.length < 20) { done = true; more.innerHTML = '<span class="muted small">Вы посмотрели всё</span>'; state.observer?.disconnect(); }
      else more.innerHTML = '';
    } catch { more.innerHTML = '<button class="btn" id="moreB">Показать ещё</button>'; $('#moreB').onclick = load; }
    busy = false;
  };
  state.observer = new IntersectionObserver((en) => en[0].isIntersecting && load(), { rootMargin: '600px' });
  state.observer.observe(more);
}

async function pageCharFeed(id) {
  const t = CG.get(id);
  await loadChars();
  const { posts } = await api(feedQuery('char:' + id));
  const ph = charPhoto(id);
  view().innerHTML = `<div class="page-head"><div class="who">${ph ? `<img src="${esc(ph.src)}" alt="" style="width:64px;height:80px;border-radius:14px;object-fit:cover">` : ''}
      <div><h1>${esc(t.name)}</h1><p class="muted">${esc(t.from)} · ${posts.length} ${plural(posts.length, 'косплей', 'косплея', 'косплеев')} на Cosplaygram</p></div></div>
    <button class="btn primary" data-act="create">${ic.plus}Показать свой косплей</button></div>
    ${posts.length ? `<div class="grid">${posts.map(card).join('')}</div>` : `<div class="empty"><h2>Пока никто не показал косплей ${esc(t.name)}</h2><p>Станьте первым — ваше фото появится на карточке персонажа.</p></div>`}`;
  bindCards(view());
}

async function pageProcess() {
  const { posts } = await api('/feed?kind=process');
  view().innerHTML = `<div class="page-head"><div><h1>Мастерская</h1><p class="muted">Как это сделано: пошаговые фото от выкройки до готового костюма.</p></div>
    <button class="btn primary" data-act="create-process">${ic.plus}Показать процесс</button></div>
    ${posts.length ? `<div class="grid">${posts.map(card).join('')}</div>` : '<div class="empty"><h2>Пока нет пошаговых публикаций</h2><p>Расскажите, как вы делали свой костюм.</p></div>'}`;
  bindCards(view());
}

/* ================= поиск и мастера ================= */
const personItem = (u) => `<a class="item" href="${userLink(u)}">${ava(u, 46)}<span style="min-width:0"><h3>${esc(u.name)}${vmark(u)}</h3>
  <span class="meta">@${esc(u.username)}${u.specialty ? ' · ' + esc(u.specialty) : ''}${place(u) ? ' · ' + place(u) : ''}</span>
  ${u.ordersOpen || u.reviews ? `<span class="meta" style="display:block">${u.ordersOpen ? '<span class="pill accent">Принимает заказы</span> ' : ''}${u.reviews ? rateText(u.rating, u.reviews) : ''}</span>` : ''}</span>
  ${u.followers != null ? `<span class="count-b"><b class="num">${u.followers}</b>${plural(u.followers, 'подписчик', 'подписчика', 'подписчиков')}</span>` : `<span class="muted" style="width:18px;display:inline-flex">${ic.right}</span>`}</a>`;

async function pageSearch(params) {
  const q = params.get('q') || '';
  view().innerHTML = `<div class="narrow"><form id="sF" role="search" style="margin-bottom:12px"><input class="input" id="sq" type="search" enterkeyhint="search" value="${esc(q)}" placeholder="Материал, персонаж, мастер, город или страна" aria-label="Поиск"></form>
    <div class="chips" style="margin-bottom:22px">${['EVA', 'парик', 'вышивка', 'бархат', 'PLA', 'worbla', 'грим', 'линзы'].map((t) => `<a class="chip ${t.toLowerCase() === q.toLowerCase() ? 'on' : ''}" href="#/search?q=${encodeURIComponent(t)}">${t}</a>`).join('')}</div>
    <div id="sR"></div></div>`;
  $('#sF').onsubmit = (e) => { e.preventDefault(); const v = $('#sq').value.trim(); location.hash = '#/search' + (v ? '?q=' + encodeURIComponent(v) : ''); };
  if (!q) { if (!isMobile()) $('#sq').focus(); $('#sR').innerHTML = '<p class="muted">Введите слово или выберите подсказку.</p>'; return; }
  const { users, posts } = await api('/search?q=' + encodeURIComponent(q));
  $('#sR').innerHTML = (users.length ? `<div class="section"><h2 style="margin-bottom:6px">Мастера</h2><div class="list">${users.slice(0, 8).map(personItem).join('')}</div></div>` : '') +
    (posts.length ? `<div class="section"><h2 style="margin-bottom:10px">Публикации · ${posts.length}</h2><div class="tiles">${posts.map(tile).join('')}</div></div>`
      : `<div class="empty"><h2>По запросу «${esc(q)}» ничего нет</h2><p>Попробуйте другое слово.</p></div>`);
  bindCards(view());
}

async function pagePeople(params) {
  const country = C.valid(params.get('country'));
  const city = params.get('city') || '';
  const { users } = await api('/users');
  const href = (o) => { const q = new URLSearchParams(); if (o.country) q.set('country', o.country); if (o.city) q.set('city', o.city); const s = q.toString(); return '#/people' + (s ? '?' + s : ''); };
  const onlyOrders = params.get('orders') === '1';
  const inCountry = users.filter((u) => (!country || u.country === country) && (!onlyOrders || u.ordersOpen));
  const cities = country ? [...new Set(inCountry.map((u) => u.city).filter(Boolean))] : [];
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Мастера</h1><p class="muted">Косплееры, швеи, реквизиторы, мастера париков и фотографы.</p></div>${state.me ? '<button class="btn sm" id="ppSugg">Рекомендации</button>' : ''}</div>
    <input class="input" id="pq" type="search" placeholder="Имя, ник или специальность" aria-label="Найти мастера" style="margin-bottom:10px">
    <div class="chips" style="margin-bottom:8px"><a class="chip ${onlyOrders ? 'on' : ''}" href="${onlyOrders ? href({ country }) : href({ country }) + (country ? '&' : '?') + 'orders=1'}">${ic.bag}Принимают заказы</a></div>
    <div class="chips" style="margin-bottom:8px">${countryChips(users.map((u) => u.country), country, (c) => href({ country: c }) + (onlyOrders ? (c ? '&' : '?') + 'orders=1' : ''))}</div>
    ${cities.length > 1 ? `<div class="chips" style="margin-bottom:8px"><a class="chip ${!city ? 'on' : ''}" href="${href({ country })}">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="${href({ country, city: c })}">${esc(c)}</a>`).join('')}</div>` : ''}
    <div class="list" id="pl"></div></div>`;
  const draw = () => {
    const t = $('#pq').value.trim().toLowerCase();
    const list = inCountry.filter((u) => (!city || u.city === city) && (!t || [u.name, u.username, u.specialty, u.city, C.name(u.country)].join(' ').toLowerCase().includes(t)));
    $('#pl').innerHTML = list.map(personItem).join('') || '<div class="empty"><p>Никого не нашли. Попробуйте другое слово.</p></div>';
  };
  $('#pq').oninput = draw;
  if ($('#ppSugg')) $('#ppSugg').onclick = () => openFollowSuggest(false);
  draw();
}

/* ================= профиль ================= */
async function pageProfile(username) {
  let d;
  try { d = await api('/users/' + encodeURIComponent(username)); }
  catch { view().innerHTML = '<div class="empty"><h2>Такого косплеера нет</h2><a class="btn" href="#/people">Все мастера</a></div>'; return; }
  const { user: u, posts, stats } = d;
  const ach = d.achievements || [];
  const services = d.services || [], reviews = d.reviews || [], rating = d.rating || { count: 0 };
  let following = d.isFollowing;
  const mine = state.me?.id === u.id;
  await ensureTheme(u.theme);
  const t = themeOf(u);
  const procN = posts.filter((p) => p.kind === 'process').length;
  view().innerHTML = `
    <div class="cover ${t.photo ? 'has-photo' : ''}" style="${CG.styleAttr(t)}">${t.photo ? `<img class="cv-img" src="${esc(t.photo)}" alt="">` : ''}<div class="ch"><span>${t.custom ? 'Свой персонаж' : 'Персонаж'}</span><b>${esc(t.name)}</b><span>${esc(t.from)}</span></div></div>
    <div class="prof">${ava(u, 96)}<div class="nm"><h1>${esc(u.name)}${vmark(u)}</h1>
      <div class="muted">@${esc(u.username)} ${rolePill(u)} ${u.ordersOpen ? '<span class="pill accent">Принимает заказы</span>' : ''}</div>
      ${rating.count ? `<div class="small" style="margin-top:2px">${stars(rating.avg)} <b>${String(rating.avg).replace('.', ',')}</b> <span class="muted">· ${rating.count} ${plural(rating.count, 'отзыв', 'отзыва', 'отзывов')}</span></div>` : ''}</div></div>
    <div class="prof-info">
      ${u.specialty || place(u) ? `<div style="font-weight:500">${[esc(u.specialty), place(u)].filter(Boolean).join(' · ')}</div>` : ''}
      ${u.bio ? `<p style="max-width:62ch">${esc(u.bio)}</p>` : ''}
      ${Object.keys(SOCIAL).some((k) => u.socials?.[k]) ? `<div class="socials">${Object.entries(SOCIAL).filter(([k]) => u.socials?.[k]).map(([k, [n, base]]) => `<a class="btn sm" href="${esc(base + u.socials[k])}" target="_blank" rel="noopener">${ic.link}${n}</a>`).join('')}</div>` : ''}
      <div class="stats"><span><b class="num">${stats.posts}</b>${plural(stats.posts, 'работа', 'работы', 'работ')}</span><span id="folN"><b class="num">${stats.followers}</b>${plural(stats.followers, 'подписчик', 'подписчика', 'подписчиков')}</span><span><b class="num">${stats.following}</b>${plural(stats.following, 'подписка', 'подписки', 'подписок')}</span><span><b class="num">${stats.likes}</b>${plural(stats.likes, 'отметка', 'отметки', 'отметок')}</span></div>
    </div>
    <div class="prof-acts">${mine
      ? `<a class="btn" href="#/settings">${ic.edit}Настроить профиль</a><button class="btn" data-act="picker">${ic.palette}Сменить персонажа</button><button class="btn" id="shP">${ic.share}Поделиться</button>`
      : `<button class="btn ${following ? '' : 'primary'}" id="fol">${following ? 'Вы подписаны' : 'Подписаться'}</button><a class="btn" href="#/messages/${encodeURIComponent(u.username)}">${ic.mail}Написать</a><button class="btn ic" id="shP" aria-label="Поделиться профилем">${ic.share}</button><button class="btn ghost ic" data-report="user:${u.id}" aria-label="Пожаловаться">${ic.flag}</button>`}</div>
    ${u.ordersOpen || services.length || reviews.length ? `<section class="ach"><div class="ach-h"><h2>${ic.bag}Услуги и цены</h2>${mine ? '<a class="btn sm" href="#/settings">Изменить</a>' : u.ordersOpen ? '<button class="btn sm primary" data-order="">Заказать</button>' : ''}</div>
      ${!u.ordersOpen ? '<p class="muted small" style="margin-bottom:8px">Сейчас не принимает заказы.</p>' : ''}
      ${services.length ? `<div class="ach-list">${services.map((x) => `<div class="ach-item"><span class="at"><b>${esc(x.title)}</b><span>${priceText(x)}${x.days ? ` · ${x.days} дн.` : ''}${x.note ? ' · ' + esc(x.note) : ''}</span></span>${!mine && u.ordersOpen ? `<button class="btn sm" data-order="${x.id}">Заказать</button>` : ''}</div>`).join('')}</div>` : u.ordersOpen ? '<p class="muted small">Цены по договорённости — опишите задачу в заявке.</p>' : ''}
      ${reviews.length ? `<h3 style="margin:16px 0 8px">Отзывы · ${reviews.length}</h3><div class="ach-list">${reviews.map((v) => `<div class="review">${who(v.author, ago(v.createdAt), 30)}${stars(v.rating)}${v.title ? `<span class="muted small">Заказ: ${esc(v.title)}</span>` : ''}${v.text ? `<p>${esc(v.text)}</p>` : ''}</div>`).join('')}</div>` : ''}</section>` : ''}
    ${ach.length || mine ? `<section class="ach"><div class="ach-h"><h2>${ic.trophy}Достижения${ach.length ? ' · ' + ach.length : ''}</h2>${mine ? `<button class="btn sm" id="addAch">${ic.plus}Добавить</button>` : ''}</div>
      ${ach.length ? `<div class="ach-list">${ach.map((a) => `<div class="ach-item"><span class="ai">${(ACH[a.kind] || ACH.other)[0]}</span><span class="at"><b>${esc(a.title || (ACH[a.kind] || ACH.other)[1])}</b><span>${esc(a.event)}${a.year ? ' · ' + esc(a.year) : ''}</span>${a.verified ? `<span class="ok-v">${ic.check}Подтверждено итогами на Cosplaygram</span>` : ''}</span>${mine && !a.verified ? `<button class="iconbtn" data-dach="${a.id}" aria-label="Удалить достижение">${ic.trash}</button>` : ''}</div>`).join('')}</div>`
        : '<p class="muted small">Добавьте призовые места, судейство и выступления на фестивалях: так вас быстрее найдут как мастера.</p>'}</section>` : ''}
    <div class="tabs-line" role="tablist"><button class="on" data-f="all">Работы · ${posts.length}</button><button data-f="process">Процесс · ${procN}</button>${mine ? '<button data-f="saved">Сохранённое</button>' : ''}</div>
    <div class="tiles" id="pG"></div>`;
  const fill = async (f) => {
    let list = posts;
    if (f === 'process') list = posts.filter((p) => p.kind === 'process');
    if (f === 'saved') list = (await api('/saved')).posts;
    $('#pG').innerHTML = list.map(tile).join('');
    $('#pE')?.remove();
    if (!list.length) $('#pG').insertAdjacentHTML('afterend', `<div class="empty" id="pE"><h2>${f === 'saved' ? 'Пока ничего не сохранено' : mine ? 'Покажите свою первую работу' : 'Здесь пока пусто'}</h2>${mine && f !== 'saved' ? '<button class="btn primary" data-act="create">Опубликовать</button>' : ''}</div>`);
    bindCards($('#pG'));
  };
  fill('all');
  $$('.tabs-line button').forEach((b) => (b.onclick = () => { $$('.tabs-line button').forEach((x) => x.classList.toggle('on', x === b)); fill(b.dataset.f); }));
  bindReports(view());
  $('#shP').onclick = () => share(`#/u/${u.username}`, u.name);
  $('#addAch')?.addEventListener('click', openAchievement);
  $$('[data-order]').forEach((b) => (b.onclick = () => requireAuth(() => openOrder(u, services, b.dataset.order))));
  $$('[data-dach]').forEach((b) => (b.onclick = confirmTwice(async () => { await api('/me/achievements/' + b.dataset.dach, { method: 'DELETE' }); route(); }, 'Нажмите ещё раз, чтобы удалить')));
  $('#fol')?.addEventListener('click', () => requireAuth(async () => {
    try {
      const r = await api(`/users/${encodeURIComponent(u.username)}/follow`, { method: 'POST' });
      following = r.following;
      const b = $('#fol');
      b.textContent = following ? 'Вы подписаны' : 'Подписаться';
      b.classList.toggle('primary', !following);
      $('#folN').innerHTML = `<b class="num">${r.followers}</b>${plural(r.followers, 'подписчик', 'подписчика', 'подписчиков')}`;
    } catch (e) { toast(e.message); }
  }));
}

async function pageSaved() {
  const { posts } = await api('/saved');
  view().innerHTML = `<div class="page-head"><div><h1>Сохранённое</h1><p class="muted">Работы и туториалы, к которым хотите вернуться. Видно только вам.</p></div></div>
    ${posts.length ? `<div class="tiles">${posts.map(tile).join('')}</div>` : '<div class="empty"><h2>Пока ничего не сохранено</h2><p>Нажмите на закладку в публикации, чтобы сохранить её.</p></div>'}`;
  bindCards(view());
}

/* ================= личные сообщения ================= */
async function pageMessages(username) {
  view().innerHTML = `<div class="msgr ${username ? 'in-thread' : ''}"><div class="convs" id="convs"><div class="skel" style="height:60px;margin:12px"></div></div>
    <section class="thread" id="thr">${username ? '' : '<div class="empty" style="margin:auto"><h2>Выберите диалог</h2><p>Или откройте профиль мастера и нажмите «Написать».</p></div>'}</section></div>`;
  const drawConvs = async () => {
    try {
      const { conversations } = await api('/dm');
      const box = $('#convs');
      if (!box) return;
      box.innerHTML = conversations.map((c) => `<a class="conv ${c.user.username === username ? 'on' : ''}" href="#/messages/${encodeURIComponent(c.user.username)}">${ava(c.user, 44)}
        <span class="t"><b>${esc(c.user.name)}<span>${ago(c.createdAt)}</span></b><p>${c.mine ? 'Вы: ' : ''}${esc(c.last)}</p></span>${c.unread && c.user.username !== username ? `<span class="dotn">${c.unread}</span>` : ''}</a>`).join('')
        || '<div class="empty"><h2>Пока нет сообщений</h2><p>Напишите мастеру из его профиля.</p><a class="btn" href="#/people">Найти мастеров</a></div>';
    } catch {}
  };
  drawConvs();
  state.timers.convs = setInterval(drawConvs, 12000);
  if (!username) return;
  let other;
  try { ({ user: other } = await api(`/dm/${encodeURIComponent(username)}?after=${Date.now()}`)); }
  catch { $('#thr').innerHTML = '<div class="empty" style="margin:auto"><h2>Такого косплеера нет</h2></div>'; return; }
  if (other.id === state.me.id) { $('#thr').innerHTML = '<div class="empty" style="margin:auto"><h2>Это вы</h2><p>Себе написать нельзя.</p></div>'; return; }
  $('#thr').innerHTML = `<div class="th-head"><a class="iconbtn mob-only" href="#/messages" aria-label="Все диалоги">${ic.back}</a><div style="min-width:0">${who(other, other.specialty || other.city)}</div></div>
    <div class="msgs" id="ml" aria-live="polite"></div>
    <form class="composer" id="mf"><textarea class="input" id="mt" rows="1" maxlength="2000" enterkeyhint="send" placeholder="Сообщение" aria-label="Сообщение"></textarea>
      <button class="btn primary" aria-label="Отправить">${ic.send}</button></form>`;
  await threadLoop({
    load: (after) => api(`/dm/${encodeURIComponent(username)}?after=${after}`),
    send: (text) => api(`/dm/${encodeURIComponent(username)}`, { body: { text } }),
    mineOf: (m) => m.mine,
    after: () => { refreshBadges(); drawConvs(); },
  });
  if (!isMobile()) $('#mt').focus({ preventScroll: true });
}

// Общая лента сообщений для личных и чата: опрос раз в 3 секунды, отправка по Enter
async function threadLoop({ load, send, mineOf, authorOf, after }) {
  const ml = $('#ml');
  let last = 0, lastDay = '', firstAfter = true;
  const add = (msgs) => {
    const fresh = msgs.filter((m) => m.createdAt > last);
    if (!fresh.length) return false;
    $('#mEmpty')?.remove();
    const atBottom = ml.scrollHeight - ml.scrollTop - ml.clientHeight < 90;
    let html = '';
    for (const m of fresh) {
      const dl = dayLabel(m.createdAt);
      if (dl !== lastDay) { html += `<div class="day">${dl}</div>`; lastDay = dl; }
      const a = authorOf?.(m);
      html += `<div class="msg ${mineOf(m) ? 'mine' : ''}">${a ? `<a href="${userLink(a)}">${ava(a, 28)}</a>` : ''}<div class="bubble">${a ? `<span class="w">${esc(a.name)}</span>` : ''}${esc(m.text)}<time>${hhmm(m.createdAt)}</time></div></div>`;
    }
    ml.insertAdjacentHTML('beforeend', html);
    last = Math.max(last, ...fresh.map((m) => m.createdAt));
    if (atBottom || !ml.dataset.init) ml.scrollTop = ml.scrollHeight;
    ml.dataset.init = 1;
    return true;
  };
  const poll = async () => {
    if (!document.body.contains(ml)) return;
    try {
      const got = add((await load(last)).messages);
      if ((got || firstAfter) && after) after();
      firstAfter = false;
    } catch {}
  };
  await poll();
  if (!last) ml.innerHTML = '<div class="empty" id="mEmpty" style="margin:auto"><p>Здесь пока тихо. Напишите первым!</p></div>';
  clearInterval(state.timers.thread);
  state.timers.thread = setInterval(poll, 3000);
  const ta = $('#mt');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#mf').requestSubmit(); } });
  $('#mf').onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    grow();
    try {
      const r = await send(text);
      add([r.message]);
      ml.scrollTop = ml.scrollHeight;
    } catch (err) { ta.value = text; toast(err.message); }
  };
}

/* ================= чат ================= */
// Комнаты: общая на весь мир, срочная помощь и по одной на каждую страну
const ROOMS = { general: '🌍 Общий', help: 'Срочная помощь', ...Object.fromEntries(C.LIST.map(([c, n]) => [c.toLowerCase(), `${C.flag(c)} ${n}`])) };
async function pageChat(params) {
  let room = params.get('r');
  if (!ROOMS[room]) { try { room = localStorage.getItem('cg-room'); } catch {} }
  if (!ROOMS[room]) room = 'general';
  try { localStorage.setItem('cg-room', room); } catch {}
  const mine = state.me?.country?.toLowerCase();
  const shown = [...new Set(['general', mine, room].filter((k) => ROOMS[k] && k !== 'help'))];
  const link = (k) => `<a class="room ${k === room ? 'on' : ''}" href="#/chat?r=${k}">${k === 'help' ? '# ' : ''}${ROOMS[k]}</a>`;
  view().innerHTML = `<div class="msgr chat in-thread"><nav class="rooms" aria-label="Комнаты">${shown.map(link).join('')}
      <select class="input room-pick" id="roomPick" aria-label="Чат другой страны"><option value="">🌐 Другая страна…</option>${C.sorted().map(([c, n]) => `<option value="${c.toLowerCase()}">${C.flag(c)} ${n}</option>`).join('')}</select>${link('help')}</nav>
    <section class="thread"><div class="msgs" id="ml" aria-live="polite"></div>
      <form class="composer" id="mf"><textarea class="input" id="mt" rows="1" maxlength="1000" enterkeyhint="send" placeholder="Сообщение: ${esc(ROOMS[room].replace(/^\S+ /, ''))}" aria-label="Сообщение"></textarea>
        <button class="btn primary" aria-label="Отправить">${ic.send}</button></form></section></div>`;
  $('.room.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  $('#roomPick').onchange = (e) => { if (e.target.value) location.hash = '#/chat?r=' + e.target.value; };
  await threadLoop({
    load: (after) => api(`/chat/${room}?after=${after}`),
    send: (text) => api(`/chat/${room}`, { body: { text } }),
    mineOf: (m) => state.me && m.authorId === state.me.id,
    authorOf: (m) => (state.me && m.authorId === state.me.id ? null : m.author),
  });
}

/* ================= уведомления ================= */
const NTEXT = { theme_ok: 'одобрил(а) вашего персонажа — теперь он в общем каталоге', theme_no: 'не одобрил(а) вашего персонажа для общего каталога — он остался у вас', order: 'отправил(а) вам заявку на заказ', order_accepted: 'принял(а) ваш заказ в работу', order_declined: 'отклонил(а) ваш заказ', order_done: 'отметил(а) заказ выполненным — оставьте отзыв', order_cancelled: 'отменил(а) заказ', review: 'оставил(а) отзыв о вашей работе', like: 'отметил(а) вашу работу', comment: 'прокомментировал(а) вашу работу', follow: 'подписался(-ась) на вас', reply: 'ответил(а) в вашей теме' };
async function pageNotifications() {
  const { items } = await api('/notifications');
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Уведомления</h1></div></div>
    <div class="list">${items.map((n) => {
      const inner = `${ava(n.actor, 42)}<span style="min-width:0" class="${n.read ? '' : 'unread'}"><b>${esc(n.actor?.name)}</b> ${NTEXT[n.type] || ''}${n.threadTitle ? ` «${esc(n.threadTitle)}»` : ''}<span class="meta" style="display:block">${ago(n.createdAt)}</span></span>
        ${n.postImage ? `<img class="thumb" src="${esc(n.postImage)}" alt="">` : '<span></span>'}`;
      return n.postId ? `<button class="item" data-open="${n.postId}">${inner}</button>` : `<a class="item" href="${n.type === 'review' ? userLink(state.me) : n.type.startsWith('order') ? '#/orders' : n.threadId ? '#/forum/' + n.threadId : userLink(n.actor)}">${inner}</a>`;
    }).join('') || '<div class="empty"><h2>Пока тихо</h2><p>Здесь появятся отметки, комментарии, подписки и ответы на форуме.</p></div>'}</div></div>`;
  bindCards(view());
  if (state.unread) { await api('/notifications/read', { method: 'POST' }).catch(() => {}); state.unread = 0; renderChrome(); }
}

/* ================= форум ================= */
const CATS = { materials: 'Материалы', sewing: 'Пошив', props: 'Реквизит и броня', wigs: 'Парики и грим', photo: 'Фотосъёмка', other: 'Разное' };
async function pageForum(params) {
  const cat = params.get('c') || '';
  const country = C.valid(params.get('country'));
  const { threads } = await api('/forum');
  const list = threads.filter((t) => (!cat || t.category === cat) && (!country || t.country === country));
  const fq = (o) => { const q = new URLSearchParams(); if (o.cat) q.set('c', o.cat); if (o.country) q.set('country', o.country); const s = q.toString(); return '#/forum' + (s ? '?' + s : ''); };
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Форум</h1><p class="muted">Где купить материалы, кто поможет с пошивом, с кем снять фотосет.</p></div>
    <button class="btn primary" id="nt">${ic.plus}Новая тема</button></div>
    <div class="chips" style="margin-bottom:6px"><a class="chip ${!cat ? 'on' : ''}" href="${fq({ country })}">Все</a>${Object.entries(CATS).map(([k, v]) => `<a class="chip ${cat === k ? 'on' : ''}" href="${fq({ cat: k, country })}">${v}</a>`).join('')}</div>
    <div class="chips" style="margin-bottom:6px">${countryChips(threads.map((t) => t.country), country, (c) => fq({ cat, country: c }))}</div>
    <div class="list">${list.map((t) => `<a class="item" href="#/forum/${t.id}">${ava(t.author, 40)}
      <span style="min-width:0"><span class="cat">${CATS[t.category]}${place(t) ? ' · ' + place(t) : ''}</span><h3>${esc(t.title)}</h3>
      <span class="meta">@${esc(t.author?.username)} · ${ago(t.lastAt)}</span></span>
      <span class="count-b"><b class="num">${t.replyCount}</b>${plural(t.replyCount, 'ответ', 'ответа', 'ответов')}</span></a>`).join('')
      || '<div class="empty"><h2>Здесь пока нет тем</h2><p>Задайте первый вопрос.</p></div>'}</div></div>`;
  $('#nt').onclick = () => requireAuth(openNewThread);
}
function openNewThread() {
  const o = openOverlay(sheet('Новая тема', `<form class="form" id="ntF">
    <div class="row"><div class="field"><label for="nt-c">Раздел</label><select class="input" id="nt-c" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label for="nt-co">Страна</label><select class="input" id="nt-co" name="country">${countryOptions(state.me?.country || '', 'Весь мир')}</select></div></div>
    <div class="field"><label for="nt-ci">Город</label><input class="input" id="nt-ci" name="city" value="${esc(state.me?.city || '')}" maxlength="40" placeholder="Необязательно"></div>
    <div class="field"><label for="nt-t">Вопрос</label><input class="input" id="nt-t" name="title" required maxlength="140" placeholder="Где купить worbla в моём городе?"></div>
    <div class="field"><label for="nt-b">Подробности</label><textarea class="input" id="nt-b" name="body" required maxlength="4000" placeholder="Что ищете, сроки, бюджет"></textarea></div>
    <p class="error" id="ntE" role="alert" hidden></p><button class="btn primary lg block">Создать тему</button></form>`));
  $('#ntF', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { thread } = await api('/forum', { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay({ silent: true });
      location.hash = '#/forum/' + thread.id;
    } catch (err) { const p = $('#ntE', o); p.textContent = err.message; p.hidden = false; }
  };
}
async function pageThread(id) {
  let t;
  try { ({ thread: t } = await api('/forum/' + id)); }
  catch { view().innerHTML = '<div class="empty"><h2>Тема не найдена</h2><a class="btn" href="#/forum">Ко всем темам</a></div>'; return; }
  const own = state.me && (state.me.id === t.authorId || isMod(state.me));
  view().innerHTML = `<article class="narrow">
    <a href="#/forum" class="btn ghost sm" style="margin:0 0 10px -8px">${ic.back}Все темы</a>
    <span class="cat" style="display:block">${CATS[t.category]}${place(t) ? ' · ' + place(t) : ''}</span>
    <h1 style="margin:6px 0 14px;font-size:clamp(1.4rem,4vw,1.9rem)">${esc(t.title)}</h1>
    <div style="display:flex;align-items:center;gap:6px"><div style="flex:1;min-width:0">${who(t.author, ago(t.createdAt))}</div>
      <button class="iconbtn" id="shT" aria-label="Поделиться">${ic.share}</button>
      ${own ? `<button class="iconbtn" id="dT" aria-label="Удалить тему">${ic.trash}</button>` : `<button class="iconbtn" data-report="thread:${t.id}" aria-label="Пожаловаться">${ic.flag}</button>`}</div>
    <p style="white-space:pre-wrap;margin:16px 0 22px;overflow-wrap:anywhere">${esc(t.body)}</p>
    <h2>${t.replies.length} ${plural(t.replies.length, 'ответ', 'ответа', 'ответов')}</h2>
    <div>${t.replies.map((r) => `<div class="reply">${ava(r.author, 34)}<div style="min-width:0"><a href="${userLink(r.author)}"><b>${esc(r.author?.name)}</b></a> <span class="small muted">${ago(r.createdAt)}</span><p>${esc(r.text)}</p></div></div>`).join('')}</div>
    <form class="form" id="rF" style="margin-top:14px"><label class="label" for="r-t">Ваш ответ</label>
      <textarea class="input" id="r-t" name="text" maxlength="2000" placeholder="Подскажите, где найти, или предложите помощь"></textarea>
      <button class="btn primary" style="align-self:flex-start">Ответить</button></form></article>`;
  bindReports(view());
  $('#shT').onclick = () => share(`#/forum/${t.id}`, t.title);
  $('#rF').onsubmit = (e) => {
    e.preventDefault();
    const text = $('#r-t').value.trim();
    if (!text) return toast('Напишите ответ');
    requireAuth(async () => {
      try { await api(`/forum/${id}/replies`, { body: { text } }); await pageThread(id); window.scrollTo(0, document.body.scrollHeight); } catch (err) { toast(err.message); }
    });
  };
  $('#dT')?.addEventListener('click', confirmTwice(async () => {
    await api('/forum/' + id, { method: 'DELETE' });
    toast('Тема удалена');
    location.hash = '#/forum';
  }, 'Нажмите ещё раз, чтобы удалить тему'));
}

/* ================= мероприятия ================= */
const TYPES = { festival: 'Фестиваль', contest: 'Соревнование', event: 'Ивент', party: 'Вечеринка', meetup: 'Сходка', workshop: 'Мастер-класс' };
const PLACES = ['Гран-при', '1 место', '2 место', '3 место', 'Спецприз', 'Победитель'];
function downloadIcs(e) {
  const d = e.date.replace(/-/g, '');
  const nd = new Date(e.date + 'T00:00:00'); nd.setDate(nd.getDate() + 1);
  const end = `${nd.getFullYear()}${String(nd.getMonth() + 1).padStart(2, '0')}${String(nd.getDate()).padStart(2, '0')}`;
  const x = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cosplaygram//RU', 'BEGIN:VEVENT', `UID:${e.id}@cosplaygram`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${x(e.title)}`, `LOCATION:${x([e.place, e.city, C.name(e.country)].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${x([e.note, e.link].filter(Boolean).join(' '))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'cosplaygram-event.ics';
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function pageEvents(params) {
  const country = C.valid(params.get('country'));
  const city = params.get('city') || '';
  const past = params.get('past') === '1';
  const major = params.get('major') === '1';
  const { events } = await api('/events');
  const today = todayLocal();
  const when = events.filter((e) => (past ? e.date < today : e.date >= today));
  const cities = country ? [...new Set(when.filter((e) => e.country === country).map((e) => e.city).filter(Boolean))] : [];
  let list = when.filter((e) => (!country || e.country === country) && (!city || e.city === city) && (!major || e.major));
  if (past) list = list.reverse();
  const qs = (o) => { const q = new URLSearchParams(); if (o.country) q.set('country', o.country); if (o.city) q.set('city', o.city); if (o.past) q.set('past', '1'); if (o.major) q.set('major', '1'); const s = q.toString(); return '#/events' + (s ? '?' + s : ''); };
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Мероприятия</h1><p class="muted">Фестивали, ивенты, вечеринки, сходки.</p></div>
    <button class="btn primary" id="ne">${ic.plus}Добавить</button></div>
    <div class="chips" style="margin-bottom:6px"><a class="chip ${past ? '' : 'on'}" href="${qs({ country, city, major })}">Предстоящие</a><a class="chip ${past ? 'on' : ''}" href="${qs({ country, city, past: 1, major })}">Прошедшие</a>
      <a class="chip ${major ? 'on' : ''}" href="${qs({ country, city, past, major: !major })}">★ Крупные фестивали</a></div>
    <div class="chips" style="margin-bottom:6px">${countryChips(events.map((e) => e.country), country, (c) => qs({ country: c, past }))}</div>
    ${cities.length > 1 ? `<div class="chips" style="margin-bottom:6px"><a class="chip ${!city ? 'on' : ''}" href="${qs({ country, past })}">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="${qs({ country, city: c, past })}">${esc(c)}</a>`).join('')}</div>` : ''}
    <div>${list.map((e) => {
      const own = state.me && (state.me.id === e.authorId || isMod(state.me));
      return `<div class="ev ${e.major ? 'major' : ''}"><div class="date"><b class="num">${+e.date.slice(8)}</b><span>${MONTHS[+e.date.slice(5, 7) - 1]}</span></div>
        <div style="min-width:0">${e.major ? '<span class="pill major-pill">★ Крупный фестиваль</span> ' : ''}<span class="etype">${TYPES[e.type] || 'Мероприятие'}${place(e) ? ' · ' + place(e) : ''}</span>${e.demo ? ' <span class="pill">Пример</span>' : ''}
          <h3 style="margin-top:2px">${esc(e.title)}</h3>
          ${e.place ? `<div class="small muted" style="display:flex;gap:4px;align-items:center"><span style="width:15px;display:inline-flex">${ic.pin}</span>${esc(e.place)}</div>` : ''}
          ${e.note ? `<p class="small" style="margin-top:4px">${esc(e.note)}</p>` : ''}
          <div class="acts">${past ? '' : `<button class="btn sm ${e.going ? 'on' : ''}" data-go="${e.id}" aria-pressed="${!!e.going}">${e.going ? ic.check + 'Я пойду' : 'Пойду'} · <span class="num">${e.goingCount}</span></button>`}
            <button class="btn sm ghost" data-ics="${e.id}">${ic.calendar}В календарь</button>
            ${e.link ? `<a class="btn sm ghost" href="${esc(e.link)}" target="_blank" rel="noopener">Организатор</a>` : ''}
            ${past || e.resultsCount ? `<button class="btn sm ${past ? 'primary' : ''}" data-results="${e.id}">${ic.trophy}Итоги${e.resultsCount ? ' · ' + e.resultsCount : ''}</button>` : ''}
            ${isMod(state.me) ? `<button class="btn sm ghost" data-major="${e.id}">${e.major ? 'Снять «крупный»' : '★ Крупный'}</button>` : ''}
            ${own ? `<button class="btn sm ghost danger" data-dele="${e.id}" aria-label="Удалить мероприятие">${ic.trash}</button>` : ''}</div></div></div>`;
    }).join('') || `<div class="empty"><h2>${past ? 'Прошедших мероприятий нет' : 'Ближайших мероприятий нет'}</h2><p>Знаете о фестивале или встрече? Добавьте, чтобы о нём узнали другие.</p></div>`}</div></div>`;
  $('#ne').onclick = () => requireAuth(openNewEvent);
  $$('[data-ics]').forEach((b) => (b.onclick = () => downloadIcs(events.find((e) => e.id === b.dataset.ics))));
  $$('[data-go]').forEach((b) => (b.onclick = () => requireAuth(async () => {
    try {
      const r = await api(`/events/${b.dataset.go}/going`, { method: 'POST' });
      b.classList.toggle('on', r.going);
      b.setAttribute('aria-pressed', String(r.going));
      b.innerHTML = `${r.going ? ic.check + 'Я пойду' : 'Пойду'} · <span class="num">${r.goingCount}</span>`;
      if (r.going) toast('Отлично! Добавьте мероприятие в календарь, чтобы не забыть');
    } catch (e) { toast(e.message); }
  })));
  $$('[data-results]').forEach((b) => (b.onclick = () => { const e = events.find((x) => x.id === b.dataset.results); openResults(e, !!state.me && (state.me.id === e.authorId || isMod(state.me))); }));
  const op = events.find((x) => x.id === params.get('open'));
  if (op) openResults(op, !!state.me && (state.me.id === op.authorId || isMod(state.me)));
  $$('[data-major]').forEach((b) => (b.onclick = async () => { await api(`/admin/events/${b.dataset.major}/major`, { method: 'POST' }); route(); }));
  $$('[data-dele]').forEach((b) => (b.onclick = confirmTwice(async () => {
    await api('/events/' + b.dataset.dele, { method: 'DELETE' });
    toast('Мероприятие удалено');
    route();
  }, 'Нажмите ещё раз, чтобы удалить мероприятие')));
}
async function openResults(e, canEdit) {
  const o = openOverlay(sheet('Итоги', `<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px"><p class="muted"><b style="color:var(--ink)">${esc(e.title)}</b> · ${+e.date.slice(8)} ${MONTHS[+e.date.slice(5, 7) - 1]} ${e.date.slice(0, 4)}</p>
      <button class="btn sm" id="rsSh">${ic.share}Поделиться</button></div>
    <div id="rsL"><div class="skel" style="height:80px"></div></div>
    ${canEdit ? `<form class="form" id="rsF" style="margin-top:16px"><h3>Добавить победителя</h3>
      <div class="row"><div class="field"><label for="rs-n">Номинация</label><input class="input" id="rs-n" name="nomination" required maxlength="100" list="rsNoms" placeholder="Лучшая схожесть"><datalist id="rsNoms"></datalist></div>
        <div class="field"><label for="rs-p">Место</label><select class="input" id="rs-p" name="place">${PLACES.map((x) => `<option>${x}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field"><label for="rs-w">Участник</label><input class="input" id="rs-w" name="who" required maxlength="80" autocapitalize="none" placeholder="@ник на Cosplaygram или имя"></div>
        <div class="field"><label for="rs-l">Instagram</label><input class="input" id="rs-l" name="link" maxlength="200" autocapitalize="none" placeholder="Необязательно"></div></div>
      <p class="hint">Если указать @ник участника Cosplaygram, победа появится у него в профиле в «Достижениях».</p>
      <p class="error" id="rsE" role="alert" hidden></p><button class="btn primary">Добавить</button></form>` : ''}`));
  const draw = (results) => {
    const noms = [...new Set(results.map((r) => r.nomination))];
    $('#rsL', o).innerHTML = noms.length ? noms.map((n) => `<div class="res-nom"><h3>${esc(n)}</h3>${results.filter((r) => r.nomination === n).map((r) => `<div class="res-row"><span class="pl">${esc(r.place || '—')}</span>
      <span class="nm">${r.user ? `<a href="${userLink(r.user)}">${esc(r.user.name)}${vmark(r.user)}</a> <span class="muted small">@${esc(r.user.username)}</span>` : esc(r.name)}</span>
      ${r.link ? `<a class="iconbtn" href="${esc(r.link)}" target="_blank" rel="noopener" aria-label="Instagram">${ic.link}</a>` : ''}
      ${canEdit ? `<button class="iconbtn" data-drs="${r.id}" aria-label="Удалить">${ic.trash}</button>` : ''}</div>`).join('')}</div>`).join('')
      : `<div class="empty" style="padding:18px 0"><p>${canEdit ? 'Итогов пока нет. Добавьте победителей по номинациям.' : 'Организатор ещё не добавил итоги.'}</p></div>`;
    const dl = $('#rsNoms', o); if (dl) dl.innerHTML = noms.map((n) => `<option value="${esc(n)}">`).join('');
    $$('[data-drs]', o).forEach((b) => (b.onclick = async () => draw((await api('/results/' + b.dataset.drs, { method: 'DELETE' })).results)));
  };
  $('#rsSh', o).onclick = () => share(`#/e/${e.id}`, `${e.title} — итоги`);
  draw((await api(`/events/${e.id}/results`)).results);
  $('#rsF', o)?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target, err = $('#rsE', o);
    err.hidden = true;
    try {
      draw((await api(`/events/${e.id}/results`, { body: Object.fromEntries(new FormData(f)) })).results);
      f.who.value = ''; f.link.value = ''; f.who.focus();
      toast('Добавлено');
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  });
}
function openNewEvent() {
  const o = openOverlay(sheet('Новое мероприятие', `<form class="form" id="neF" novalidate>
    <div class="field"><label for="ne-t">Название</label><input class="input" id="ne-t" name="title" required maxlength="120"></div>
    <div class="row"><div class="field"><label for="ne-d">Дата</label><input class="input" id="ne-d" type="date" name="date" required min="${todayLocal()}"></div>
      <div class="field"><label for="ne-ty">Тип</label><select class="input" id="ne-ty" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field"><label for="ne-co">Страна</label><select class="input" id="ne-co" name="country">${countryOptions(state.me?.country || '', 'Онлайн или не указана')}</select></div>
      <div class="field"><label for="ne-c">Город</label><input class="input" id="ne-c" name="city" value="${esc(state.me?.city || '')}" maxlength="40"></div></div>
    <div class="field"><label for="ne-p">Место</label><input class="input" id="ne-p" name="place" maxlength="120" placeholder="Площадка или адрес"></div>
    <div class="field"><label for="ne-l">Ссылка на организатора</label><input class="input" id="ne-l" name="link" type="url" inputmode="url" placeholder="https://"></div>
    <div class="field"><label for="ne-n">Описание</label><textarea class="input" id="ne-n" name="note" maxlength="300" placeholder="Номинации, взнос, как участвовать"></textarea></div>
    ${isMod(state.me) ? '<label class="check"><input type="checkbox" name="major" value="1"> ★ Крупный фестиваль</label>' : ''}
    <p class="error" id="neE" role="alert" hidden></p><button class="btn primary lg block">Добавить мероприятие</button></form>`));
  $('#neF', o).onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const err = $('#neE', o);
    err.hidden = true;
    if (!fd.title.trim() || !fd.date) { err.textContent = 'Укажите название и дату'; err.hidden = false; return; }
    if (fd.date < todayLocal()) { err.textContent = 'Дата уже прошла. Выберите сегодняшнюю или будущую.'; err.hidden = false; return; }
    if (fd.link && !/^https?:\/\//.test(fd.link)) fd.link = 'https://' + fd.link;
    try {
      await api('/events', { body: fd });
      closeOverlay({ silent: true });
      toast('Мероприятие добавлено');
      route();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  };
}

function openOrder(u, services, serviceId) {
  if (state.me?.id === u.id) return;
  const sel = services.find((x) => x.id === serviceId);
  const o = openOverlay(sheet('Заявка мастеру', `<p class="muted" style="margin-bottom:12px">Мастер: <b style="color:var(--ink)">${esc(u.name)}</b> @${esc(u.username)}. Он увидит заявку и ответит в «Заказах».</p>
    <form class="form" id="ordF">
      ${services.length ? `<div class="field"><label for="or-s">Услуга</label><select class="input" id="or-s" name="serviceId"><option value="">Другое</option>${services.map((x) => `<option value="${x.id}" ${x.id === serviceId ? 'selected' : ''}>${esc(x.title)} — ${priceText(x)}</option>`).join('')}</select></div>` : ''}
      <div class="field"><label for="or-t">Что нужно сделать</label><input class="input" id="or-t" name="title" required maxlength="120" value="${esc(sel?.title || '')}" placeholder="Парик Фрирен под мой размер"></div>
      <div class="field"><label for="or-d">Подробности</label><textarea class="input" id="or-d" name="details" maxlength="2000" placeholder="Персонаж, размеры, референсы, к какому фесту"></textarea></div>
      <div class="row"><div class="field"><label for="or-b">Бюджет</label><input class="input" id="or-b" name="budget" maxlength="60" placeholder="Например, 30 000 ₸"></div>
        <div class="field"><label for="or-dl">Нужно к</label><input class="input" id="or-dl" name="deadline" type="date" min="${todayLocal()}"></div></div>
      <p class="error" id="orE" role="alert" hidden></p><button class="btn primary lg block">Отправить заявку</button></form>`));
  $('#or-s', o)?.addEventListener('change', (e) => { const x = services.find((y) => y.id === e.target.value); if (x && !$('#or-t', o).value) $('#or-t', o).value = x.title; });
  $('#ordF', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/users/${encodeURIComponent(u.username)}/orders`, { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay({ silent: true }); toast('Заявка отправлена мастеру'); location.hash = '#/orders?t=out';
    } catch (err) { const p = $('#orE', o); p.textContent = err.message; p.hidden = false; }
  };
}
const OST = { new: 'Новая заявка', accepted: 'В работе', declined: 'Отклонён', done: 'Выполнен', cancelled: 'Отменён' };
async function pageOrders(params) {
  const { incoming, outgoing } = await api('/orders');
  const tab = params.get('t') || (incoming.length || !outgoing.length ? 'in' : 'out');
  const list = tab === 'in' ? incoming : outgoing;
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Заказы</h1><p class="muted">Заявки мастерам и от заказчиков.</p></div>
      <a class="btn" href="#/people?orders=1">${ic.users}Найти мастера</a></div>
    <div class="tabs-line" role="tablist"><a class="${tab === 'in' ? 'on' : ''}" href="#/orders?t=in">Мне заказали · ${incoming.length}</a><a class="${tab === 'out' ? 'on' : ''}" href="#/orders?t=out">Мои заказы · ${outgoing.length}</a></div>
    <div>${list.map((o) => {
      const other = tab === 'in' ? o.client : o.master;
      const acts = tab === 'in'
        ? (o.status === 'new' ? `<button class="btn sm primary" data-st="accepted" data-id="${o.id}">Принять</button><button class="btn sm ghost" data-st="declined" data-id="${o.id}">Отклонить</button>` : o.status === 'accepted' ? `<button class="btn sm primary" data-st="done" data-id="${o.id}">${ic.check}Выполнен</button>` : '')
        : (['new', 'accepted'].includes(o.status) ? `<button class="btn sm ghost" data-st="cancelled" data-id="${o.id}">Отменить</button>` : '');
      return `<div class="ord"><div class="ord-h">${who(other, tab === 'in' ? 'заказчик' : 'мастер')}<span class="pill st-${o.status}">${OST[o.status]}</span></div>
        <h3>${esc(o.title)}</h3>${o.details ? `<p class="small" style="white-space:pre-wrap">${esc(o.details)}</p>` : ''}
        <div class="meta small muted">${[o.budget ? 'Бюджет: ' + esc(o.budget) : '', o.deadline ? 'Срок: ' + o.deadline.split('-').reverse().join('.') : '', ago(o.createdAt)].filter(Boolean).join(' · ')}</div>
        <div class="acts">${acts}<a class="btn sm ghost" href="#/messages/${encodeURIComponent(other.username)}">${ic.mail}Написать</a></div>
        ${tab === 'out' && o.status === 'done' ? (o.review ? `<div class="review">${stars(o.review.rating)}${o.review.text ? `<p>${esc(o.review.text)}</p>` : ''}<span class="muted small">Ваш отзыв</span></div>`
          : `<form class="form rvF" data-id="${o.id}"><label class="label">Оцените работу мастера</label><div class="rate" role="radiogroup" aria-label="Оценка">${[1, 2, 3, 4, 5].map((i) => `<label><input type="radio" name="rating" value="${i}" ${i === 5 ? 'checked' : ''}><span>${ic.star}</span></label>`).join('')}</div>
            <textarea class="input" name="text" maxlength="1000" placeholder="Что понравилось, качество, сроки"></textarea><button class="btn primary sm" style="align-self:flex-start">Оставить отзыв</button></form>`) : ''}</div>`;
    }).join('') || `<div class="empty"><h2>${tab === 'in' ? 'Заявок пока нет' : 'Вы ещё ничего не заказывали'}</h2><p>${tab === 'in' ? 'Включите «Принимаю заказы» в настройках и добавьте услуги с ценами.' : 'Найдите мастера с отметкой «Принимает заказы».'}</p>
      <a class="btn" href="${tab === 'in' ? '#/settings' : '#/people?orders=1'}">${tab === 'in' ? 'Настроить заказы' : 'Найти мастера'}</a></div>`}</div></div>`;
  $$('[data-st]').forEach((b) => (b.onclick = async () => { try { await api(`/orders/${b.dataset.id}/status`, { body: { status: b.dataset.st } }); toast('Готово'); route(); } catch (e) { toast(e.message); } }));
  $$('.rvF').forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); try { await api(`/orders/${f.dataset.id}/review`, { body: Object.fromEntries(new FormData(f)) }); toast('Спасибо за отзыв!'); route(); } catch (x) { toast(x.message); } }));
}
function openAchievement() {
  const y = new Date().getFullYear();
  const o = openOverlay(sheet('Новое достижение', `<form class="form" id="achF">
    <div class="field"><label for="ac-k">Что это</label><select class="input" id="ac-k" name="kind">${Object.entries(ACH).map(([k, [e, n]]) => `<option value="${k}">${e} ${n}</option>`).join('')}</select></div>
    <div class="row"><div class="field"><label for="ac-e">Фестиваль или мероприятие</label><input class="input" id="ac-e" name="event" required maxlength="100" placeholder="Например, Flavi Fest"></div>
      <div class="field"><label for="ac-y">Год</label><input class="input" id="ac-y" name="year" inputmode="numeric" maxlength="4" value="${y}"></div></div>
    <div class="field"><label for="ac-t">Подробнее</label><input class="input" id="ac-t" name="title" maxlength="120" placeholder="2 место — лучшая схожесть"></div>
    <p class="error" id="acE" role="alert" hidden></p><button class="btn primary lg block">Добавить</button></form>`));
  $('#achF', o).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('/me/achievements', { body: Object.fromEntries(new FormData(e.target)) }); closeOverlay({ silent: true }); toast('Достижение добавлено'); route(); }
    catch (err) { const p = $('#acE', o); p.textContent = err.message; p.hidden = false; }
  };
}

/* ================= настройки ================= */
async function pageSettings() {
  const u = state.me;
  const t = themeOf(u);
  let avatar = null;
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Настройки</h1></div><a class="btn sm" href="${userLink(u)}">Мой профиль</a></div>
    <section class="section"><h2 style="margin-bottom:12px">Персонаж</h2>
      <div class="cur-char">${charCard(t, true)}<div class="stack" style="gap:8px"><p class="muted">Сайт оформлен в стиле <b style="color:var(--ink)">${esc(t.name)}</b>. Обложка вашего профиля тоже в этом стиле.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn" data-act="picker">${ic.palette}Сменить персонажа</button><button class="btn" data-act="mychar">${ic.plus}Свой персонаж</button></div>
        <p class="hint">Есть косплей на персонажа, которого нет в каталоге? Сделайте свою тему из фото — с вашими цветами и вашим фото на обложке.</p></div></div>
      <div class="ach-list" id="myThemes" style="margin-top:12px"></div></section>
    <section class="section"><h2 style="margin-bottom:12px">Профиль</h2>
      <form class="form" id="pf">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span id="avP">${ava(u, 84)}</span>
          <div class="stack" style="gap:6px"><label class="btn" for="avF" style="align-self:flex-start">${ic.image}${u.avatar ? 'Сменить фото' : 'Загрузить фото'}</label><input type="file" id="avF" accept="image/*" hidden>
          <span class="hint">Сохранится после нажатия «Сохранить».</span></div></div>
        <div class="field"><label for="s-n">Имя</label><input class="input" id="s-n" name="name" value="${esc(u.name)}" maxlength="60" autocomplete="given-name"></div>
        <div class="row"><div class="field"><label for="s-co">Страна</label><select class="input" id="s-co" name="country">${countryOptions(u.country)}</select></div>
          <div class="field"><label for="s-c">Город</label><input class="input" id="s-c" name="city" value="${esc(u.city)}" maxlength="40"></div></div>
        <div class="field"><label for="s-s">Ваше лучшее качество</label><input class="input" id="s-s" name="specialty" value="${esc(u.specialty)}" maxlength="60" placeholder="Например, вигмейкинг">
          <p class="hint">Крафт, вигмейкинг, грим, сценическое выступление, макияж и т. д.</p></div>
        <div class="field"><label for="s-b">О себе</label><textarea class="input" id="s-b" name="bio" maxlength="300">${esc(u.bio)}</textarea></div>
        <fieldset class="socials-f"><legend class="label">Соцсети</legend><p class="hint" style="margin-bottom:8px">Ник или ссылка на профиль.</p>
          <div class="soc-grid">${Object.entries(SOCIAL).map(([k, [n]]) => `<div class="field"><label for="so-${k}">${n}</label><input class="input" id="so-${k}" name="so_${k}" value="${esc(u.socials?.[k] || '')}" maxlength="200" autocapitalize="none" spellcheck="false" placeholder="@ник"></div>`).join('')}</div></fieldset>
        <button class="btn primary" style="align-self:flex-start">Сохранить</button>
      </form></section>
    <section class="section"><h2 style="margin-bottom:6px">Заказы</h2>
      <p class="muted" style="margin-bottom:10px">Шьёте, делаете парики, броню или фотосессии на заказ? Включите заказы и укажите цены — в профиле появится кнопка «Заказать».</p>
      <label class="check" style="margin-bottom:12px"><input type="checkbox" id="ordOpen" ${u.ordersOpen ? 'checked' : ''}> Принимаю заказы</label>
      <div class="ach-list" id="svL"></div>
      <form class="form" id="svF" style="margin-top:12px"><div class="row"><div class="field"><label for="sv-t">Услуга</label><input class="input" id="sv-t" name="title" required maxlength="80" placeholder="Парик с укладкой"></div>
        <div class="field"><label for="sv-p">Цена от</label><div style="display:flex;gap:6px"><input class="input" id="sv-p" name="price" inputmode="numeric" maxlength="12" placeholder="0 — договорная"><select class="input" name="currency" aria-label="Валюта" style="width:auto">${Object.entries(CUR).map(([k, v]) => `<option value="${k}" ${k === curFor(u.country) ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div></div>
        <div class="row"><div class="field"><label for="sv-d">Срок, дней</label><input class="input" id="sv-d" name="days" inputmode="numeric" maxlength="3"></div>
          <div class="field"><label for="sv-n">Примечание</label><input class="input" id="sv-n" name="note" maxlength="200" placeholder="Материалы мои / ваши"></div></div>
        <button class="btn" style="align-self:flex-start">${ic.plus}Добавить услугу</button></form></section>
    <section class="section" id="idSec" hidden><h2 style="margin-bottom:6px">Вход через Google и Telegram</h2>
      <p class="muted" style="margin-bottom:10px">Привяжите аккаунт — и входите в Cosplaygram одной кнопкой, без пароля.</p>
      <div class="ach-list" id="idL"></div><div class="social" id="idBox" hidden style="margin-top:12px"></div></section>
    <section class="section"><h2 style="margin-bottom:12px" id="pwH">Пароль</h2>
      <form class="form" id="pw"><input type="text" name="username" value="${esc(u.username)}" autocomplete="username" hidden>
        <p class="hint" id="pwNo" hidden>Сейчас вы входите через Google или Telegram. Задайте пароль, чтобы входить и по нику.</p>
        <div class="row"><div class="field" id="pwCur"><label for="pw-c">Текущий пароль</label>${pwField('pw-c', 'current', 'current-password', '')}</div>
          <div class="field"><label for="pw-n">Новый пароль</label>${pwField('pw-n', 'next', 'new-password', 'Не короче 8 символов')}</div></div>
        <button class="btn" style="align-self:flex-start">Сменить пароль</button></form></section>
    <section class="section"><h2 style="margin-bottom:6px">Язык</h2>
      <p class="muted" style="margin-bottom:10px">Сейчас: <b class="notranslate" translate="no" style="color:var(--ink)">${esc(CGLang.name(CGLang.current()))}</b>. Доступно ${CGLang.LANGS.length} языков, перевод автоматический.</p>
      <button class="btn" data-act="lang">${ic.globe}Выбрать язык</button></section>
    <section class="section"><h2 style="margin-bottom:6px">Приложение на телефоне</h2>
      <p class="muted" style="margin-bottom:10px">${isStandalone() ? 'Cosplaygram уже установлен на этом устройстве.' : 'Добавьте Cosplaygram на экран телефона — он будет открываться как обычное приложение.'}</p>
      ${isStandalone() ? '' : `<button class="btn" data-act="install">${ic.phone}Установить</button>`}</section>
    <section class="section"><button class="btn ghost danger" data-act="logout">${ic.logout}Выйти из аккаунта</button></section></div>`;
  bindEyes(view());
  // Мои персонажи
  const mineT = CG.THEMES.filter((x) => x.custom && x.mine && x.id !== 'my-preview');
  $('#myThemes').innerHTML = mineT.map((x) => `<div class="ach-item"><span class="tm-mini" style="${CG.styleAttr(x)}">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : ''}</span>
    <span class="at"><b>${esc(x.name)}</b><span>${esc(x.from || CG.CATS[x.cat] || '')} · ${T_STATUS[x.status] || ''}</span></span>
    <span style="display:flex;gap:6px">${x.id === t.id ? '' : `<button class="btn sm" data-tuse="${x.id}">Включить</button>`}<button class="btn sm ghost" data-tedit="${x.id}">Изменить</button></span></div>`).join('');
  $$('[data-tuse]').forEach((b) => (b.onclick = async () => { await saveTheme(b.dataset.tuse); toast('Стиль включён'); route(); }));
  $$('[data-tedit]').forEach((b) => (b.onclick = () => openThemeMaker(CG.get(b.dataset.tedit))));
  // Привязанные способы входа
  Promise.all([getProviders(), api('/me/identities')]).then(([pv, r]) => {
    if (!r.hasPassword) { $('#pwCur')?.remove(); $('#pwNo').hidden = false; $('#pwH').textContent = 'Задать пароль'; }
    const linked = r.identities.map((x) => x.provider);
    const missing = Object.keys(PROV).filter((k) => pv[k] && !linked.includes(k));
    if (!linked.length && !missing.length) return;
    $('#idSec').hidden = false;
    $('#idL').innerHTML = r.identities.map((x) => `<div class="ach-item"><span class="at"><b>${PROV[x.provider] || esc(x.provider)} ✓</b><span>${esc(x.label || 'привязан')}</span></span>
      <button class="btn sm ghost" data-unl="${esc(x.provider)}">Отвязать</button></div>`).join('');
    $$('[data-unl]').forEach((b) => (b.onclick = confirmTwice(async () => {
      try { await api('/me/identities/' + b.dataset.unl, { method: 'DELETE' }); toast('Отвязано'); route(); } catch (e) { toast(e.message); }
    }, 'Нажмите ещё раз, чтобы отвязать')));
    if (missing.length) mountSocial($('#idBox'), { link: true, only: missing });
  }).catch(() => {});
  const drawSv = (list) => {
    $('#svL').innerHTML = list.map((x) => `<div class="ach-item"><span class="at"><b>${esc(x.title)}</b><span>${priceText(x)}${x.days ? ` · ${x.days} дн.` : ''}${x.note ? ' · ' + esc(x.note) : ''}</span></span><button class="iconbtn" data-dsv="${x.id}" aria-label="Удалить услугу">${ic.trash}</button></div>`).join('');
    $$('[data-dsv]').forEach((b) => (b.onclick = async () => drawSv((await api('/me/services/' + b.dataset.dsv, { method: 'DELETE' })).services)));
  };
  api('/users/' + encodeURIComponent(u.username)).then((r) => drawSv(r.services || [])).catch(() => {});
  $('#ordOpen').onchange = async (e) => { try { const { user } = await api('/me', { method: 'PATCH', body: { ordersOpen: e.target.checked } }); state.me = user; toast(e.target.checked ? 'Заказы включены' : 'Заказы выключены'); } catch (x) { toast(x.message); } };
  $('#svF').onsubmit = async (e) => {
    e.preventDefault();
    try { drawSv((await api('/me/services', { body: Object.fromEntries(new FormData(e.target)) })).services); e.target.reset(); toast('Услуга добавлена'); }
    catch (x) { toast(x.message); }
  };
  $('#avF').onchange = async (e) => {
    try {
      avatar = await readImage(e.target.files[0], 480);
      $('#avP').innerHTML = `<span class="ava" style="--s:84px"><img src="${avatar}" alt=""></span>`;
    } catch (err) { toast(err.message); }
  };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault();
    const b = e.target.querySelector('button.primary');
    b.disabled = true;
    try {
      const body = Object.fromEntries(new FormData(e.target));
      body.socials = {};
      for (const k of Object.keys(body)) if (k.startsWith('so_')) { body.socials[k.slice(3)] = body[k]; delete body[k]; }
      if (avatar) body.avatar = avatar;
      const { user } = await api('/me', { method: 'PATCH', body });
      state.me = user;
      avatar = null;
      renderChrome();
      toast('Профиль сохранён');
    } catch (err) { toast(err.message); }
    b.disabled = false;
  };
  $('#pw').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/me/password', { body: Object.fromEntries(new FormData(e.target)) });
      e.target.reset();
      toast('Пароль изменён');
    } catch (err) { toast(err.message); }
  };
}

/* ================= модерация ================= */
async function pageAdmin() {
  if (!isMod(state.me)) { view().innerHTML = '<div class="empty"><h2>Раздел только для администрации</h2></div>'; return; }
  const dev = state.me.role === 'dev';
  const { stats, reports } = await api('/admin/reports');
  const kinds = { post: 'Публикация', comment: 'Комментарий', thread: 'Тема форума', message: 'Сообщение', user: 'Профиль', event: 'Мероприятие' };
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Админ-панель</h1><p class="muted">Вы: ${ROLE_LABEL[state.me.role]}. Участники, галочки, жалобы и фото персонажей.</p></div></div>
    <div class="tiles-stats"><div><b class="num">${stats.users}</b><span class="small muted">участников</span></div><div><b class="num">${stats.posts}</b><span class="small muted">публикаций</span></div>
      <div><b class="num">${stats.threads}</b><span class="small muted">тем</span></div><div><b class="num">${stats.messages}</b><span class="small muted">сообщений в чате</span></div></div>
    ${dev ? `<section class="section"><h2 style="margin-bottom:6px">Резервная копия</h2><p class="muted small" style="margin-bottom:10px">Все данные сайта одним файлом (без самих фото и паролей). Скачивайте раз в неделю.</p>
      <a class="btn" href="/api/admin/backup" download>${ic.save}Скачать копию</a></section>` : ''}
    ${dev ? `<section class="section"><h2 style="margin-bottom:6px">Вход через Google и Telegram</h2>
      <p class="muted small" style="margin-bottom:10px">Кнопки «Продолжить с Google» и «Войти через Telegram» появятся на сайте, как только здесь будут ключи.</p>
      <div id="authAdm"><div class="skel" style="height:90px"></div></div></section>` : ''}
    <section class="section"><h2 style="margin-bottom:8px">Участники</h2>
      <input class="input" id="auQ" type="search" placeholder="Ник или имя" aria-label="Найти участника" style="margin-bottom:8px">
      <div class="list" id="auL"><div class="skel" style="height:120px"></div></div></section>
    <h2 style="margin-bottom:4px">Открытые жалобы · ${reports.length}</h2>
    <div class="list section">${reports.map((r) => `<div class="item">${ava(r.reporter, 36)}<span style="min-width:0"><b>${esc(r.reason)}</b>
      <span class="meta" style="display:block">${kinds[r.type] || r.type} · от @${esc(r.reporter?.username)}, ${ago(r.createdAt)}</span>
      ${r.type === 'post' ? `<button class="btn sm" style="margin-top:6px" data-open="${esc(r.targetId)}">Открыть</button>` : r.type === 'thread' ? `<a class="btn sm" style="margin-top:6px" href="#/forum/${esc(r.targetId)}">Открыть</a>` : ''}</span>
      <button class="btn sm" data-res="${r.id}">Закрыть</button></div>`).join('') || '<div class="empty"><p>Жалоб нет.</p></div>'}</div>
    <section class="section"><h2 style="margin-bottom:6px">Персонажи от участников</h2><p class="muted small" style="margin-bottom:12px">Свои персонажи, которых участники предложили в общий каталог. После одобрения появятся у всех в выборе стиля.</p>
      <div class="list" id="adThemes"><div class="skel" style="height:80px"></div></div></section>
    <section class="section"><h2>Арт персонажей</h2><p class="muted small" style="margin:6px 0 12px">Картинка на карточке персонажа вместо эмблемы. Загружайте только изображения, на которые у вас есть права: официальные арты и кадры из аниме, фильмов и игр защищены авторским правом. Косплеи участников показываются по нажатию на карточку.</p>
      <div class="char-grid" id="adChars"></div><input type="file" id="adFile" accept="image/*" hidden></section>
  </div>`;
  bindCards(view());
  const drawUsers = (users) => {
    $('#auL').innerHTML = users.map((u) => {
      const locked = u.role === 'dev' && !dev, self = u.id === state.me.id;
      return `<div class="item adm-u">${ava(u, 40)}<span style="min-width:0"><a href="${userLink(u)}"><b>${esc(u.name)}</b>${vmark(u)}</a> ${rolePill(u)}
        <span class="meta" style="display:block">@${esc(u.username)} · ${u.posts} ${plural(u.posts, 'работа', 'работы', 'работ')}${place(u) ? ' · ' + place(u) : ''}</span>
        <span class="adm-acts">${locked ? '' : `<button class="btn sm ${u.verified ? '' : 'primary'}" data-ver="${u.id}" data-v="${u.verified ? 0 : 1}">${u.verified ? 'Снять галочку' : '✓ Дать галочку'}</button>`}
          ${dev && !self ? `<select class="input sm" data-role="${u.id}" aria-label="Роль">${[['user', 'Участник'], ['admin', 'Модератор'], ['dev', 'Разработчик']].map(([k, n]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${n}</option>`).join('')}</select>` : ''}
          ${!self && u.role !== 'dev' && (dev || u.role !== 'admin') ? `<button class="btn sm ghost danger" data-delu="${u.id}">${ic.trash}Удалить</button>` : ''}</span></span></div>`;
    }).join('') || '<div class="empty"><p>Никого не нашли.</p></div>';
    $$('[data-ver]').forEach((b) => (b.onclick = async () => { try { await api('/admin/users/' + b.dataset.ver, { body: { verified: b.dataset.v === '1' } }); toast(b.dataset.v === '1' ? 'Галочка выдана' : 'Галочка снята'); loadUsers(); } catch (e) { toast(e.message); } }));
    $$('[data-role]').forEach((sel) => (sel.onchange = async () => { try { await api('/admin/users/' + sel.dataset.role, { body: { role: sel.value } }); toast('Роль изменена'); loadUsers(); } catch (e) { toast(e.message); } }));
    $$('[data-delu]').forEach((b) => (b.onclick = confirmTwice(async () => { try { await api('/admin/users/' + b.dataset.delu, { method: 'DELETE' }); toast('Аккаунт удалён'); loadUsers(); } catch (e) { toast(e.message); } }, 'Нажмите ещё раз: аккаунт и все его публикации удалятся')));
  };
  // Ключи входа через Google и Telegram
  const drawAuth = (a) => {
    const box = $('#authAdm');
    if (!box) return;
    const n = (k) => (a.counts?.[k] ? ` · привязано профилей: ${a.counts[k]}` : '');
    box.innerHTML = `<form class="form" id="auF">
      <div class="field"><label for="ak-g">Google — Client ID ${a.google ? '<span class="pill">включён</span>' : ''}</label>
        <input class="input" id="ak-g" name="google" value="${esc(a.google || '')}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="1234567890-abc….apps.googleusercontent.com">
        <p class="hint">Google Cloud → APIs &amp; Services → Credentials → OAuth client ID (Web application). В «Authorized JavaScript origins» добавьте https://cosplaygram.kz${n('google')}</p></div>
      <div class="field"><label for="ak-t">Telegram — токен бота ${a.telegramToken ? `<span class="pill">включён · @${esc(a.telegramBot)}</span>` : ''}</label>
        <input class="input" id="ak-t" name="telegramToken" type="password" autocomplete="off" spellcheck="false" placeholder="${a.telegramToken ? 'Сохранён. Вставьте новый, чтобы заменить' : '1234567890:AAH…'}">
        <p class="hint">В Telegram: @BotFather → /newbot → скопируйте токен сюда. Потом там же /setdomain → выберите бота → cosplaygram.kz${n('telegram')}</p></div>
      <p class="hint" id="auR"></p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" style="align-self:flex-start">Сохранить</button>
        ${a.google ? '<button type="button" class="btn ghost danger" data-aoff="google">Выключить Google</button>' : ''}
        ${a.telegramToken ? '<button type="button" class="btn ghost danger" data-aoff="telegram">Выключить Telegram</button>' : ''}</div></form>`;
    const save = async (body) => {
      const out = $('#auR');
      out.textContent = 'Сохраняю…';
      try {
        const r = await api('/admin/auth', { body });
        providersP = null;
        drawAuth({ ...a, ...r });
        toast('Сохранено');
      } catch (x) { out.textContent = x.message; }
    };
    $('#auF').onsubmit = (e) => { e.preventDefault(); save(Object.fromEntries(new FormData(e.target))); };
    $$('[data-aoff]').forEach((b) => (b.onclick = confirmTwice(() => save({ clear: b.dataset.aoff }), 'Нажмите ещё раз — кнопка пропадёт с сайта')));
  };
  const loadAdThemes = async () => {
    const { themes } = await api('/admin/themes');
    for (const x of themes) CG.add({ ...x, mine: x.mine });
    $('#adThemes').innerHTML = themes.map((x) => `<div class="item adm-u"><span class="tm-mini" style="${CG.styleAttr(CG.get(x.id))}">${x.photo ? `<img src="${esc(x.photo)}" alt="">` : ''}</span>
      <span style="min-width:0"><b>${esc(x.name)}</b> <span class="pill ${x.status === 'public' ? 'accent' : ''}">${T_STATUS[x.status]}</span>
        <span class="meta" style="display:block">${esc(x.from || '')}${x.cat ? ' · ' + CG.CATS[x.cat] : ''} · косплей @${esc(x.by)}</span>
        <span class="adm-acts">${x.status === 'pending' ? `<button class="btn sm primary" data-tok="${x.id}">Одобрить</button><button class="btn sm ghost" data-tno="${x.id}">Отклонить</button>` : `<button class="btn sm ghost" data-tno="${x.id}">Убрать из каталога</button>`}
          ${x.photo ? `<a class="btn sm ghost" href="${esc(x.photo)}" target="_blank" rel="noopener">Фото</a>` : ''}</span></span></div>`).join('') || '<div class="empty"><p>Пока никто не предлагал.</p></div>';
    $$('[data-tok]').forEach((b) => (b.onclick = async () => { try { await api('/admin/themes/' + b.dataset.tok, { body: { status: 'public' } }); toast('Персонаж в каталоге'); loadAdThemes(); } catch (e) { toast(e.message); } }));
    $$('[data-tno]').forEach((b) => (b.onclick = async () => { try { await api('/admin/themes/' + b.dataset.tno, { body: { status: 'rejected' } }); toast('Отклонено'); loadAdThemes(); } catch (e) { toast(e.message); } }));
  };
  loadAdThemes().catch(() => {});
  if (dev) api('/admin/auth').then(drawAuth).catch((x) => { const b = $('#authAdm'); if (b) b.textContent = x.message; });
  let tq;
  const loadUsers = async () => drawUsers((await api('/admin/users?q=' + encodeURIComponent($('#auQ').value.trim()))).users);
  $('#auQ').oninput = () => { clearTimeout(tq); tq = setTimeout(loadUsers, 250); };
  loadUsers();
  $$('[data-res]').forEach((b) => (b.onclick = async () => { await api(`/admin/reports/${b.dataset.res}/resolve`, { method: 'POST' }); b.closest('.item').remove(); toast('Жалоба закрыта'); }));
  await loadChars(true);
  let target = null;
  const drawAd = () => {
    $('#adChars').innerHTML = CG.THEMES.filter((t) => t.cat).map((t) => `<div class="stack" style="gap:6px">${charCard(t, false)}
      <div class="row" style="gap:6px"><button class="btn sm" data-up="${t.id}">${ic.image}Фото</button>${charData.site[t.id]?.cover ? `<button class="btn sm ghost danger" data-rmc="${t.id}" aria-label="Убрать обложку">${ic.trash}</button>` : ''}</div></div>`).join('');
    $$('[data-up]').forEach((b) => (b.onclick = () => { target = b.dataset.up; $('#adFile').click(); }));
    $$('[data-rmc]').forEach((b) => (b.onclick = async () => { await api(`/admin/characters/${b.dataset.rmc}/photo`, { method: 'DELETE' }); await loadChars(true); drawAd(); toast('Обложка убрана'); }));
  };
  drawAd();
  $('#adFile').onchange = async (e) => {
    try {
      const image = await readImage(e.target.files[0], 900);
      await api(`/admin/characters/${target}/photo`, { body: { image } });
      await loadChars(true);
      drawAd();
      toast('Обложка загружена');
    } catch (err) { toast(err.message); }
    e.target.value = '';
  };
}

/* ================= авторы фото ================= */
async function pageCredits() {
  await loadChars(true);
  const rows = Object.entries(charData.commons).filter(([id]) => CG.get(id).id === id);
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Авторы фото</h1>
    <p class="muted">Фото косплея на карточках персонажей взяты с Wikimedia Commons под свободными лицензиями. Спасибо фотографам и косплеерам! Официальные изображения персонажей мы не используем.</p></div></div>
    <div class="list">${rows.map(([id, c]) => `<a class="item" href="${esc(c.page)}" target="_blank" rel="noopener"><img class="thumb" src="/chars/${id}.jpg" alt="">
      <span style="min-width:0"><h3>${esc(CG.get(id).name)}</h3><span class="meta">${esc(c.author)} · ${esc(c.license)}</span></span><span class="muted" style="width:18px;display:inline-flex">${ic.right}</span></a>`).join('') || '<div class="empty"><p>Фото пока не загружены.</p></div>'}</div>
    <p class="hint" style="margin-top:16px">Если вы автор фото и хотите его убрать, напишите модератору в чате «Срочная помощь».</p></div>`;
}

/* ================= роутер ================= */
async function route() {
  clearInterval(state.timers.thread);
  clearInterval(state.timers.convs);
  state.observer?.disconnect();
  state.cleanup?.();
  state.cleanup = null;
  closeOverlay({ silent: true });
  closeMenu();
  const [path, qs] = (location.hash || '#/').slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  renderChrome();
  window.scrollTo(0, 0);
  if (parts[0] === 'credits') { await pageCredits(); document.title = 'Авторы фото — Cosplaygram'; return; }
  // Гостю открыты профили, работы, мероприятия и форум — чтобы ссылки из Instagram и Telegram открывались
  const GUEST = ['u', 'p', 'events', 'forum'];
  if (!state.me && !GUEST.includes(parts[0])) {
    pageLanding();
    document.title = 'Cosplaygram — выберите персонажа';
    return;
  }
  const pages = {
    '': () => pageFeed(params), process: pageProcess, search: () => pageSearch(params), people: () => pagePeople(params),
    u: () => pageProfile(decodeURIComponent(parts[1] || '')), p: () => pagePost(parts[1]), saved: pageSaved, settings: pageSettings,
    notifications: pageNotifications, messages: () => pageMessages(parts[1] ? decodeURIComponent(parts[1]) : ''),
    forum: () => (parts[1] ? pageThread(parts[1]) : pageForum(params)), events: () => pageEvents(params), chat: () => pageChat(params), admin: pageAdmin, orders: () => pageOrders(params),
  };
  const fn = pages[parts[0] || ''];
  try {
    if (fn) await fn();
    else view().innerHTML = '<div class="empty"><h2>Такой страницы нет</h2><a class="btn" href="#/">В ленту</a></div>';
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Не удалось загрузить</h2><p>${esc(e.message)}</p><button class="btn" id="retry">Повторить</button></div>`;
    $('#retry').onclick = route;
  }
  if (!state.me) view().insertAdjacentHTML('beforeend', `<div class="guest-bar"><span><b>Cosplaygram</b> — костюмы, мастера и фестивали</span><button class="btn primary sm" data-act="register">Присоединиться</button></div>`);
  const titles = { orders: 'Заказы', process: 'Мастерская', search: 'Поиск', people: 'Мастера', saved: 'Сохранённое', settings: 'Настройки', notifications: 'Уведомления', messages: 'Сообщения', forum: 'Форум', events: 'Мероприятия', chat: 'Чат', admin: 'Модерация', p: 'Публикация', u: '@' + decodeURIComponent(parts[1] || '') };
  document.title = parts[0] ? `${titles[parts[0]] || ''} — Cosplaygram` : 'Cosplaygram';
}

window.addEventListener('hashchange', route);
(async () => {
  const pm = /^\/(u|p|e)\/([^/?#]+)\/?$/.exec(location.pathname);
  if (pm) history.replaceState(null, '', '/#/' + (pm[1] === 'e' ? 'events?open=' + pm[2] : `${pm[1]}/${pm[2]}`));
  await refreshMe();
  await loadThemes();
  if (state.me?.theme) { await ensureTheme(state.me.theme); CG.apply(state.me.theme); CG.store(state.me.theme); rememberCustom(state.me.theme); }
  await route();
  if (state.me && !state.me.theme) {
    if (CG.stored()) saveTheme(CG.stored(), true);
    else openPicker({ onboarding: true });
  }
  setInterval(async () => {
    if (!state.me || document.hidden) return;
    const before = state.unread + state.unreadDm;
    await refreshBadges();
    if (state.unread + state.unreadDm > before) toast(state.unreadDm ? 'Новое сообщение' : 'Новое уведомление');
  }, 25000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
