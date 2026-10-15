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
  if (res.status === 401 && state.me && !['/login', '/register', '/me/password'].includes(path)) {
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
  const url = location.origin + '/' + path;
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
  up: I('<path d="m6 15 6-6 6 6"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
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
const SOURCES = { anime: 'Аниме', manga: 'Манга', drama: 'Дорама', film: 'Фильм', game: 'Игра', original: 'Ориджинал' };
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
const who = (u, sub, size = 36) =>
  `<a class="who" href="${userLink(u)}">${ava(u, size)}<span class="t"><b>${esc(u?.name || u?.username)}</b><span>@${esc(u?.username)}${sub ? ' · ' + esc(sub) : ''}</span></span></a>`;

// Фото персонажа: обложка модератора → лучший косплей участников → свободное фото с Wikimedia Commons → эмблема
const charData = { site: {}, commons: {}, loaded: false };
async function loadChars(force) {
  if (charData.loaded && !force) return charData;
  const [site, commons] = await Promise.all([
    api('/characters').then((r) => r.characters).catch(() => ({})),
    fetch('/chars/credits.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  Object.assign(charData, { site, commons, loaded: true });
  return charData;
}
function charPhoto(id) {
  const s = charData.site[id];
  if (s?.photo) return { src: s.photo, credit: s.cover ? 'Обложка Cosplaygram' : `Косплей: @${s.by}` };
  const c = charData.commons[id];
  if (c) return { src: `/chars/${id}.jpg`, credit: `Фото: ${c.author}, ${c.license}` };
  return null;
}
const charStats = (id) => charData.site[id] || { cosplays: 0, fans: 0 };

function charCard(t, on) {
  const ph = charPhoto(t.id);
  const st = charStats(t.id);
  const meta = [t.from + (t.cat ? ' · ' + CG.CATS[t.cat] : ''), st.cosplays ? `${st.cosplays} ${plural(st.cosplays, 'косплей', 'косплея', 'косплеев')}` : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="char ${on ? 'on' : ''} ${ph ? 'has-photo' : ''}" data-char="${t.id}" style="${CG.styleAttr(t)}" aria-pressed="${!!on}" aria-label="${esc(t.name)}${t.from ? ', ' + esc(t.from) : ''}">
    <span class="art">${ph ? `<img src="${esc(ph.src)}" alt="" loading="lazy" decoding="async"><span class="cr">${esc(ph.credit)}</span>` : `<b>${esc(t.name.trim().charAt(0))}</b>`}<span class="sw"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i><i style="background:${t.ink}"></i></span></span>
    <span class="meta"><span class="nm">${esc(t.name)}</span><span class="fr">${esc(meta)}</span></span>
    <span class="ok">${ic.check}</span></button>`;
}
const CHAR_TABS = [['', 'Популярные'], ['anime', 'Аниме'], ['manga', 'Манга'], ['drama', 'Дорамы'], ['film', 'Фильмы и сериалы'], ['game', 'Игры'], ['classic', 'Классика']];
function charsFor(cat, query = '') {
  const qq = query.trim().toLowerCase();
  let list = CG.THEMES.filter((t) => (cat === '' ? true : cat === 'classic' ? !t.cat : t.cat === cat));
  if (qq) list = CG.THEMES.filter((t) => (t.name + ' ' + t.from).toLowerCase().includes(qq));
  if (cat === '' && !qq) {
    // «Популярные»: сначала те, кого чаще косплеят и выбирают на Cosplaygram, затем общий рейтинг каталога
    const rank = (t) => charStats(t.id).cosplays * 3 + charStats(t.id).fans;
    const order = new Map(CG.THEMES.map((t, i) => [t.id, i]));
    list = [...list].sort((a, b) => (!a.cat) - (!b.cat) || rank(b) - rank(a) || order.get(a.id) - order.get(b.id));
  }
  return list;
}
const charTabs = () => `<input class="input" type="search" data-csearch placeholder="Найти персонажа или произведение" aria-label="Найти персонажа" style="margin-bottom:10px">
  <div class="chips" role="tablist" aria-label="Категории персонажей">${CHAR_TABS.map(([k, v], i) => `<button type="button" class="chip ${i ? '' : 'on'}" data-ctab="${k}">${v}</button>`).join('')}</div>`;

// Сетка выбора: поиск, вкладки и живой предпросмотр темы. holder хранит выбор в data-sel.
function bindCharPicker(holder, onPick) {
  let cat = '';
  const grid = $('.char-grid', holder);
  const search = $('[data-csearch]', holder);
  const draw = () => {
    const list = charsFor(cat, search?.value || '');
    grid.innerHTML = list.map((t) => charCard(t, t.id === holder.dataset.sel)).join('') || '<p class="muted">Такого персонажа пока нет в каталоге. Выберите похожий стиль или «Классику».</p>';
  };
  if (search) search.oninput = draw;
  $$('[data-ctab]', holder).forEach((b) => (b.onclick = () => {
    cat = b.dataset.ctab;
    if (search) search.value = '';
    $$('[data-ctab]', holder).forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  loadChars().then(draw);
  grid.addEventListener('click', (e) => {
    const c = e.target.closest('[data-char]');
    if (!c) return;
    holder.dataset.sel = c.dataset.char;
    $$('.char', grid).forEach((x) => { x.classList.toggle('on', x === c); x.setAttribute('aria-pressed', String(x === c)); });
    CG.apply(c.dataset.char);
    onPick(CG.get(c.dataset.char));
  });
  draw();
}

function openPicker({ onboarding = false } = {}) {
  const prev = state.me?.theme || CG.stored() || 'classic';
  let chosen = false;
  const o = openOverlay(`<div class="sheet wide picker" role="dialog" aria-modal="true" aria-labelledby="pkT" data-sel="${esc(prev)}">
    <div class="grab"></div>
    <div class="head"><h2 class="display" id="pkT" style="font-size:1.7rem">${onboarding ? 'Кто вы сегодня?' : 'Выберите персонажа'}</h2>
      <p class="muted">Сайт оденется в цвета и шрифт персонажа. Поменять можно в любой момент в меню профиля.</p></div>
    <div class="tabs">${charTabs()}</div>
    <div class="body"><div class="char-grid"></div></div>
    <div class="foot"><div class="t"><span class="small muted">Ваш стиль</span><b id="pkN">${esc(CG.get(prev).name)}</b></div>
      <button class="btn primary lg" id="pkOk">Готово</button></div>
  </div>`, {
    onClose: () => {
      if (chosen) return;
      CG.apply(prev);
      if (onboarding) saveTheme(prev, true);
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
  };
}
async function saveTheme(id, silent) {
  CG.store(id);
  CG.apply(id);
  if (!state.me) return;
  try {
    const { user } = await api('/me', { method: 'PATCH', body: { theme: id } });
    state.me = user;
    renderChrome();
  } catch (e) { if (!silent) toast(e.message); }
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
  { k: '', href: '#/', label: 'Лента' },
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
    ? `<a class="iconbtn" href="#/search" aria-label="Поиск">${ic.search}</a>
       <a class="iconbtn desk-only" href="#/messages" aria-label="Сообщения">${ic.mail}${badge(state.unreadDm)}</a>
       <a class="iconbtn" href="#/notifications" aria-label="Уведомления">${ic.bell}${badge(state.unread)}</a>
       <button class="iconbtn plus desk-only" data-act="create" aria-label="Опубликовать">${ic.plus}</button>
       <button class="me-btn" id="meBtn" aria-haspopup="true" aria-label="Меню профиля">${ava(me, 32)}</button>`
    : `<button class="btn ghost sm" data-act="login">Войти</button><button class="btn primary sm" data-act="register">Регистрация</button>`;
  const bn = $('#bottomNav');
  bn.hidden = !me;
  bn.innerHTML = !me ? '' : `
    <a href="#/" class="${k === '' ? 'active' : ''}">${ic.home}Лента</a>
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
    <a href="#/saved">${ic.save}Сохранённое</a>
    <div class="sep mob-only"></div>
    <a href="#/forum" class="mob-only">${ic.forum}Форум</a>
    <a href="#/chat" class="mob-only">${ic.chat}Чат</a>
    <a href="#/people" class="mob-only">${ic.users}Мастера</a>
    <div class="sep"></div>
    <button class="mi" data-act="picker">${ic.palette}Сменить персонажа<span class="r">${esc(t.name)}</span></button>
    <a href="#/settings">${ic.gear}Настройки профиля</a>
    ${canInstall ? `<button class="mi" data-act="install">${ic.phone}Установить приложение</button>` : ''}
    ${me.role === 'admin' ? `<a href="#/admin">${ic.shield}Модерация</a>` : ''}
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
  if (a === 'install') install();
});

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
    <p class="muted" style="margin-bottom:16px">${reg ? `Ваш стиль: <b style="color:var(--accent)">${esc(t.name)}</b>. Его можно поменять потом.` : 'С возвращением! Введите ник и пароль.'}</p>
    <form class="form" id="authForm" novalidate>
      <div class="field"><label for="au-user">Ник</label><input class="input" id="au-user" name="username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required placeholder="например, aru.cos"></div>
      ${reg ? `<div class="row"><div class="field"><label for="au-name">Имя</label><input class="input" id="au-name" name="name" autocomplete="given-name" placeholder="Аружан"></div>
        <div class="field"><label for="au-city">Город</label><input class="input" id="au-city" name="city" autocomplete="address-level2" placeholder="Актобе"></div></div>` : ''}
      <div class="field"><label for="au-pass">Пароль</label>${pwField('au-pass', 'password', reg ? 'new-password' : 'current-password', reg ? 'Не короче 8 символов' : '')}</div>
      ${reg ? '<p class="hint">Ник — латиницей, от 3 символов: буквы, цифры, точка или _.</p>' : ''}
      <p class="error" id="authErr" role="alert" hidden></p>
      <button class="btn primary lg block" type="submit">${reg ? 'Создать профиль' : 'Войти'}</button>
      <button type="button" class="btn ghost block" id="authSwitch">${reg ? 'Уже есть профиль? Войти' : 'Нет профиля? Зарегистрироваться'}</button>
    </form>`));
  bindEyes(o);
  $('#authSwitch', o).onclick = () => openAuth(reg ? 'login' : 'register', after);
  $('#authForm', o).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    const err = $('#authErr', o);
    const body = Object.fromEntries(new FormData(e.target));
    body.username = String(body.username || '').trim().toLowerCase().replace(/^@/, '');
    if (reg) body.theme = CG.stored() || '';
    btn.disabled = true;
    try {
      const { user } = await api(reg ? '/register' : '/login', { body });
      state.me = user;
      closeOverlay();
      toast(reg ? `Добро пожаловать, ${user.name}!` : `Привет, ${user.name}!`);
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

async function afterLogin() {
  await refreshMe();
  if (!state.me) return;
  if (state.me.theme) { CG.apply(state.me.theme); CG.store(state.me.theme); }
  else if (CG.stored()) await saveTheme(CG.stored(), true);
  else setTimeout(() => openPicker({ onboarding: true }), 400);
}

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
  const can = state.me && (state.me.id === c.authorId || state.me.id === p.authorId || state.me.role === 'admin');
  return `<div class="comment">${ava(c.author, 30)}<div class="t"><a href="${userLink(c.author)}"><b>${esc(c.author?.username)}</b></a>${esc(c.text)}
    <div class="small muted">${ago(c.createdAt)}</div></div>
    ${can ? `<button class="iconbtn" data-delc="${c.id}" aria-label="Удалить комментарий">${ic.trash}</button>` : ''}</div>`;
};

function detailHtml(p, page) {
  const own = state.me && (state.me.id === p.authorId || state.me.role === 'admin');
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
const CAT_TO_SOURCE = { anime: 'anime', manga: 'manga', drama: 'drama', film: 'film', game: 'game' };
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
  const shots = [['tomyris', 'Томирис · aru.cos'], ['knight', 'Рыцарь · dias_props'], ['silkroad', 'Шёлковый путь'], ['moon', 'Лунная волшебница']];
  view().innerHTML = `<section class="land">
    <div><h1>Кто вы сегодня?</h1>
      <p class="lead">Выберите персонажа из аниме, манги, дорам, фильмов или игр — Cosplaygram оденется в его стиль. Дальше: ваши костюмы, процесс создания, мастера и мероприятия рядом.</p></div>
    <div id="land" data-sel="${sel}">${charTabs()}<div class="char-grid" style="margin-top:12px"></div></div>
    <div class="land-cta"><div class="t"><span class="small muted">Ваш стиль</span><br><b id="lnN">${esc(CG.get(sel).name)}</b></div>
      <div class="acts"><button class="btn" data-act="login">Войти</button><button class="btn primary" data-act="register">Зарегистрироваться</button></div></div>
    <div><div class="section-title"><h2>Работы участников</h2></div>
      <div class="strip">${shots.map(([f, c]) => `<figure><img src="/demo/${f}.jpg" alt="" loading="lazy"><figcaption>${c}</figcaption></figure>`).join('')}</div></div>
    <div class="perks">
      <div><b>Процесс по шагам</b><span>От выкройки до готового образа, с подписью к каждому фото.</span></div>
      <div><b>Мастера рядом</b><span>Швеи, реквизиторы, мастера париков и фотографы вашего города.</span></div>
      <div><b>Мероприятия</b><span>Фестивали, косплей-шоу и встречи — с отметкой «Пойду».</span></div>
    </div>
    <p class="hint">Фото на карточках — косплей участников и свободные фото с Wikimedia Commons. <a class="link" href="#/credits">Авторы фото</a></p>
  </section>`;
  bindCharPicker($('#land'), (t) => { CG.store(t.id); $('#lnN').textContent = t.name; });
}

/* ================= лента ================= */
const FILTERS = [['', 'Все'], ['following', 'Подписки'], ['process', 'Процесс'], ['anime', 'Аниме'], ['manga', 'Манга'], ['drama', 'Дорамы'], ['film', 'Фильмы'], ['game', 'Игры'], ['original', 'Ориджинал']];
function feedQuery(f, before) {
  const q = new URLSearchParams();
  if (f.startsWith('char:')) q.set('char', f.slice(5));
  else if (f === 'following') q.set('mode', 'following');
  else if (f === 'process') q.set('kind', 'process');
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
  const [wip, { posts }, contest, { events }] = await Promise.all([
    wipRow(), api(feedQuery(f)), f ? { top: [] } : api('/contest'), f ? { events: [] } : api('/events'),
  ]);
  const next = events.find((e) => e.date >= todayLocal());
  const label = FILTERS.find(([k]) => k === f)[1];
  const empty = {
    following: ['Здесь будут работы тех, на кого вы подписаны', 'Найдите мастеров и подпишитесь.', '<a class="btn" href="#/people">Найти мастеров</a>'],
    process: ['Пока нет пошаговых публикаций', 'Покажите, как вы делали свой костюм.', '<button class="btn primary" data-act="create-process">Показать процесс</button>'],
  }[f] || [f ? `Пока нет работ в разделе «${label}»` : 'Пока нет публикаций', 'Станьте первым — покажите свой костюм.', '<button class="btn primary" data-act="create">Опубликовать</button>'];
  view().innerHTML = `
    ${wip}
    ${f ? '' : spotlight(contest.top, contest.month)}
    ${next ? `<a class="next-ev" href="#/events"><span class="muted" style="width:22px;display:inline-flex">${ic.calendar}</span><span class="d">${+next.date.slice(8)} ${MONTHS[+next.date.slice(5, 7) - 1]}</span><span class="t"><b>${esc(next.title)}</b><span>${esc(next.city)}${next.goingCount ? ` · идут ${next.goingCount}` : ''}</span></span><span class="muted" style="width:18px;display:inline-flex">${ic.right}</span></a>` : ''}
    <div class="filters"><div class="chips" role="tablist" aria-label="Фильтр работ">${FILTERS.map(([k, v]) => `<a class="chip ${k === f ? 'on' : ''}" href="#/${k ? '?f=' + k : ''}" role="tab" aria-selected="${k === f}">${v}</a>`).join('')}</div></div>
    ${posts.length ? `<div class="grid" id="cards">${posts.map(card).join('')}</div><div class="more" id="more"></div>`
      : `<div class="empty"><h2>${empty[0]}</h2><p>${empty[1]}</p>${empty[2]}</div>`}`;
  $$('[data-story]').forEach((b) => (b.onclick = () => openStory(+b.dataset.story)));
  bindCards(view());
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
const personItem = (u) => `<a class="item" href="${userLink(u)}">${ava(u, 46)}<span style="min-width:0"><h3>${esc(u.name)}${u.demo ? ' <span class="pill">Демо</span>' : ''}</h3>
  <span class="meta">@${esc(u.username)}${u.specialty ? ' · ' + esc(u.specialty) : ''}${u.city ? ' · ' + esc(u.city) : ''}</span></span>
  ${u.followers != null ? `<span class="count-b"><b class="num">${u.followers}</b>${plural(u.followers, 'подписчик', 'подписчика', 'подписчиков')}</span>` : `<span class="muted" style="width:18px;display:inline-flex">${ic.right}</span>`}</a>`;

async function pageSearch(params) {
  const q = params.get('q') || '';
  view().innerHTML = `<div class="narrow"><form id="sF" role="search" style="margin-bottom:12px"><input class="input" id="sq" type="search" enterkeyhint="search" value="${esc(q)}" placeholder="Материал, персонаж, мастер или город" aria-label="Поиск"></form>
    <div class="chips" style="margin-bottom:22px">${['EVA', 'парик', 'вышивка', 'бархат', 'PLA', 'worbla', 'Алматы', 'Астана'].map((t) => `<a class="chip ${t.toLowerCase() === q.toLowerCase() ? 'on' : ''}" href="#/search?q=${encodeURIComponent(t)}">${t}</a>`).join('')}</div>
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
  const city = params.get('city') || '';
  const { users } = await api('/users');
  const cities = [...new Set(users.map((u) => u.city).filter(Boolean))];
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Мастера</h1><p class="muted">Косплееры, швеи, реквизиторы, мастера париков и фотографы.</p></div></div>
    <input class="input" id="pq" type="search" placeholder="Имя, ник или специальность" aria-label="Найти мастера" style="margin-bottom:10px">
    <div class="chips" style="margin-bottom:8px"><a class="chip ${!city ? 'on' : ''}" href="#/people">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="#/people?city=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
    <div class="list" id="pl"></div></div>`;
  const draw = () => {
    const t = $('#pq').value.trim().toLowerCase();
    const list = users.filter((u) => (!city || u.city === city) && (!t || [u.name, u.username, u.specialty, u.city].join(' ').toLowerCase().includes(t)));
    $('#pl').innerHTML = list.map(personItem).join('') || '<div class="empty"><p>Никого не нашли. Попробуйте другое слово.</p></div>';
  };
  $('#pq').oninput = draw;
  draw();
}

/* ================= профиль ================= */
async function pageProfile(username) {
  let d;
  try { d = await api('/users/' + encodeURIComponent(username)); }
  catch { view().innerHTML = '<div class="empty"><h2>Такого косплеера нет</h2><a class="btn" href="#/people">Все мастера</a></div>'; return; }
  const { user: u, posts, stats } = d;
  let following = d.isFollowing;
  const mine = state.me?.id === u.id;
  const t = themeOf(u);
  const procN = posts.filter((p) => p.kind === 'process').length;
  view().innerHTML = `
    <div class="cover" style="${CG.styleAttr(t)}"><div class="ch"><span>Персонаж</span><b>${esc(t.name)}</b><span>${esc(t.from)}</span></div></div>
    <div class="prof">${ava(u, 96)}<div class="nm"><h1>${esc(u.name)}</h1>
      <div class="muted">@${esc(u.username)} ${u.role === 'admin' ? '<span class="pill">Модератор</span>' : ''} ${u.demo ? '<span class="pill">Демо</span>' : ''}</div></div></div>
    <div class="prof-info">
      ${u.specialty || u.city ? `<div style="font-weight:500">${esc([u.specialty, u.city].filter(Boolean).join(' · '))}</div>` : ''}
      ${u.bio ? `<p style="max-width:62ch">${esc(u.bio)}</p>` : ''}
      <div class="stats"><span><b class="num">${stats.posts}</b>${plural(stats.posts, 'работа', 'работы', 'работ')}</span><span id="folN"><b class="num">${stats.followers}</b>${plural(stats.followers, 'подписчик', 'подписчика', 'подписчиков')}</span><span><b class="num">${stats.following}</b>${plural(stats.following, 'подписка', 'подписки', 'подписок')}</span><span><b class="num">${stats.likes}</b>${plural(stats.likes, 'отметка', 'отметки', 'отметок')}</span></div>
    </div>
    <div class="prof-acts">${mine
      ? `<a class="btn" href="#/settings">${ic.edit}Настроить профиль</a><button class="btn" data-act="picker">${ic.palette}Сменить персонажа</button><button class="btn" id="shP">${ic.share}Поделиться</button>`
      : `<button class="btn ${following ? '' : 'primary'}" id="fol">${following ? 'Вы подписаны' : 'Подписаться'}</button><a class="btn" href="#/messages/${encodeURIComponent(u.username)}">${ic.mail}Написать</a><button class="btn ic" id="shP" aria-label="Поделиться профилем">${ic.share}</button><button class="btn ghost ic" data-report="user:${u.id}" aria-label="Пожаловаться">${ic.flag}</button>`}</div>
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
const ROOMS = { general: 'Общий', almaty: 'Алматы', astana: 'Астана', shymkent: 'Шымкент', aktobe: 'Актобе', karaganda: 'Караганда', help: 'Срочная помощь' };
async function pageChat(params) {
  let room = params.get('r');
  if (!ROOMS[room]) { try { room = localStorage.getItem('cg-room'); } catch {} }
  if (!ROOMS[room]) room = 'general';
  try { localStorage.setItem('cg-room', room); } catch {}
  view().innerHTML = `<div class="msgr chat in-thread"><nav class="rooms" aria-label="Комнаты">${Object.entries(ROOMS).map(([k, v]) => `<a class="room ${k === room ? 'on' : ''}" href="#/chat?r=${k}"># ${v}</a>`).join('')}</nav>
    <section class="thread"><div class="msgs" id="ml" aria-live="polite"></div>
      <form class="composer" id="mf"><textarea class="input" id="mt" rows="1" maxlength="1000" enterkeyhint="send" placeholder="Сообщение в #${ROOMS[room]}" aria-label="Сообщение"></textarea>
        <button class="btn primary" aria-label="Отправить">${ic.send}</button></form></section></div>`;
  $('.room.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  await threadLoop({
    load: (after) => api(`/chat/${room}?after=${after}`),
    send: (text) => api(`/chat/${room}`, { body: { text } }),
    mineOf: (m) => state.me && m.authorId === state.me.id,
    authorOf: (m) => (state.me && m.authorId === state.me.id ? null : m.author),
  });
}

/* ================= уведомления ================= */
const NTEXT = { like: 'отметил(а) вашу работу', comment: 'прокомментировал(а) вашу работу', follow: 'подписался(-ась) на вас', reply: 'ответил(а) в вашей теме' };
async function pageNotifications() {
  const { items } = await api('/notifications');
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Уведомления</h1></div></div>
    <div class="list">${items.map((n) => {
      const inner = `${ava(n.actor, 42)}<span style="min-width:0" class="${n.read ? '' : 'unread'}"><b>${esc(n.actor?.name)}</b> ${NTEXT[n.type] || ''}${n.threadTitle ? ` «${esc(n.threadTitle)}»` : ''}<span class="meta" style="display:block">${ago(n.createdAt)}</span></span>
        ${n.postImage ? `<img class="thumb" src="${esc(n.postImage)}" alt="">` : '<span></span>'}`;
      return n.postId ? `<button class="item" data-open="${n.postId}">${inner}</button>` : `<a class="item" href="${n.threadId ? '#/forum/' + n.threadId : userLink(n.actor)}">${inner}</a>`;
    }).join('') || '<div class="empty"><h2>Пока тихо</h2><p>Здесь появятся отметки, комментарии, подписки и ответы на форуме.</p></div>'}</div></div>`;
  bindCards(view());
  if (state.unread) { await api('/notifications/read', { method: 'POST' }).catch(() => {}); state.unread = 0; renderChrome(); }
}

/* ================= форум ================= */
const CATS = { materials: 'Материалы', sewing: 'Пошив', props: 'Реквизит и броня', wigs: 'Парики и грим', photo: 'Фотосъёмка', other: 'Разное' };
async function pageForum(params) {
  const cat = params.get('c') || '';
  const { threads } = await api('/forum');
  const list = cat ? threads.filter((t) => t.category === cat) : threads;
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Форум</h1><p class="muted">Где купить материалы, кто поможет с пошивом, с кем снять фотосет.</p></div>
    <button class="btn primary" id="nt">${ic.plus}Новая тема</button></div>
    <div class="chips" style="margin-bottom:6px"><a class="chip ${!cat ? 'on' : ''}" href="#/forum">Все</a>${Object.entries(CATS).map(([k, v]) => `<a class="chip ${cat === k ? 'on' : ''}" href="#/forum?c=${k}">${v}</a>`).join('')}</div>
    <div class="list">${list.map((t) => `<a class="item" href="#/forum/${t.id}">${ava(t.author, 40)}
      <span style="min-width:0"><span class="cat">${CATS[t.category]}${t.city ? ` · ${esc(t.city)}` : ''}</span><h3>${esc(t.title)}</h3>
      <span class="meta">@${esc(t.author?.username)} · ${ago(t.lastAt)}</span></span>
      <span class="count-b"><b class="num">${t.replyCount}</b>${plural(t.replyCount, 'ответ', 'ответа', 'ответов')}</span></a>`).join('')
      || '<div class="empty"><h2>Здесь пока нет тем</h2><p>Задайте первый вопрос.</p></div>'}</div></div>`;
  $('#nt').onclick = () => requireAuth(openNewThread);
}
function openNewThread() {
  const o = openOverlay(sheet('Новая тема', `<form class="form" id="ntF">
    <div class="row"><div class="field"><label for="nt-c">Раздел</label><select class="input" id="nt-c" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label for="nt-ci">Город</label><input class="input" id="nt-ci" name="city" value="${esc(state.me?.city || '')}" placeholder="Необязательно"></div></div>
    <div class="field"><label for="nt-t">Вопрос</label><input class="input" id="nt-t" name="title" required maxlength="140" placeholder="Где купить worbla в Астане?"></div>
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
  const own = state.me && (state.me.id === t.authorId || state.me.role === 'admin');
  view().innerHTML = `<article class="narrow">
    <a href="#/forum" class="btn ghost sm" style="margin:0 0 10px -8px">${ic.back}Все темы</a>
    <span class="cat" style="display:block">${CATS[t.category]}${t.city ? ` · ${esc(t.city)}` : ''}</span>
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
const TYPES = { festival: 'Фестиваль', contest: 'Косплей-шоу', meetup: 'Встреча', workshop: 'Мастер-класс' };
function downloadIcs(e) {
  const d = e.date.replace(/-/g, '');
  const nd = new Date(e.date + 'T00:00:00'); nd.setDate(nd.getDate() + 1);
  const end = `${nd.getFullYear()}${String(nd.getMonth() + 1).padStart(2, '0')}${String(nd.getDate()).padStart(2, '0')}`;
  const x = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cosplaygram//RU', 'BEGIN:VEVENT', `UID:${e.id}@cosplaygram`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${end}`, `SUMMARY:${x(e.title)}`, `LOCATION:${x([e.city, e.place].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${x([e.note, e.link].filter(Boolean).join(' '))}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = 'cosplaygram-event.ics';
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
async function pageEvents(params) {
  const city = params.get('city') || '';
  const past = params.get('past') === '1';
  const { events } = await api('/events');
  const today = todayLocal();
  const cities = [...new Set(events.map((e) => e.city).filter(Boolean))];
  let list = events.filter((e) => (past ? e.date < today : e.date >= today) && (!city || e.city === city));
  if (past) list = list.reverse();
  const qs = (o) => { const q = new URLSearchParams(); if (o.city) q.set('city', o.city); if (o.past) q.set('past', '1'); const s = q.toString(); return '#/events' + (s ? '?' + s : ''); };
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Мероприятия</h1><p class="muted">Фестивали, косплей-шоу, встречи и мастер-классы.</p></div>
    <button class="btn primary" id="ne">${ic.plus}Добавить</button></div>
    <div class="chips" style="margin-bottom:6px"><a class="chip ${past ? '' : 'on'}" href="${qs({ city })}">Предстоящие</a><a class="chip ${past ? 'on' : ''}" href="${qs({ city, past: 1 })}">Прошедшие</a>
      <span style="width:1px;background:var(--line);margin:6px 4px;flex:none" aria-hidden="true"></span>
      <a class="chip ${!city ? 'on' : ''}" href="${qs({ past })}">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="${qs({ city: c, past })}">${esc(c)}</a>`).join('')}</div>
    <div>${list.map((e) => {
      const own = state.me && (state.me.id === e.authorId || state.me.role === 'admin');
      return `<div class="ev"><div class="date"><b class="num">${+e.date.slice(8)}</b><span>${MONTHS[+e.date.slice(5, 7) - 1]}</span></div>
        <div style="min-width:0"><span class="etype">${TYPES[e.type] || 'Мероприятие'}${e.city ? ' · ' + esc(e.city) : ''}</span>${e.demo ? ' <span class="pill">Пример</span>' : ''}
          <h3 style="margin-top:2px">${esc(e.title)}</h3>
          ${e.place ? `<div class="small muted" style="display:flex;gap:4px;align-items:center"><span style="width:15px;display:inline-flex">${ic.pin}</span>${esc(e.place)}</div>` : ''}
          ${e.note ? `<p class="small" style="margin-top:4px">${esc(e.note)}</p>` : ''}
          <div class="acts">${past ? '' : `<button class="btn sm ${e.going ? 'on' : ''}" data-go="${e.id}" aria-pressed="${!!e.going}">${e.going ? ic.check + 'Я пойду' : 'Пойду'} · <span class="num">${e.goingCount}</span></button>`}
            <button class="btn sm ghost" data-ics="${e.id}">${ic.calendar}В календарь</button>
            ${e.link ? `<a class="btn sm ghost" href="${esc(e.link)}" target="_blank" rel="noopener">Организатор</a>` : ''}
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
  $$('[data-dele]').forEach((b) => (b.onclick = confirmTwice(async () => {
    await api('/events/' + b.dataset.dele, { method: 'DELETE' });
    toast('Мероприятие удалено');
    route();
  }, 'Нажмите ещё раз, чтобы удалить мероприятие')));
}
function openNewEvent() {
  const o = openOverlay(sheet('Новое мероприятие', `<form class="form" id="neF" novalidate>
    <div class="field"><label for="ne-t">Название</label><input class="input" id="ne-t" name="title" required maxlength="120"></div>
    <div class="row"><div class="field"><label for="ne-d">Дата</label><input class="input" id="ne-d" type="date" name="date" required min="${todayLocal()}"></div>
      <div class="field"><label for="ne-ty">Тип</label><select class="input" id="ne-ty" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
    <div class="row"><div class="field"><label for="ne-c">Город</label><input class="input" id="ne-c" name="city" value="${esc(state.me?.city || '')}"></div>
      <div class="field"><label for="ne-p">Место</label><input class="input" id="ne-p" name="place" maxlength="120"></div></div>
    <div class="field"><label for="ne-l">Ссылка на организатора</label><input class="input" id="ne-l" name="link" type="url" inputmode="url" placeholder="https://"></div>
    <div class="field"><label for="ne-n">Описание</label><textarea class="input" id="ne-n" name="note" maxlength="300" placeholder="Номинации, взнос, как участвовать"></textarea></div>
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

/* ================= настройки ================= */
async function pageSettings() {
  const u = state.me;
  const t = themeOf(u);
  let avatar = null;
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Настройки</h1></div><a class="btn sm" href="${userLink(u)}">Мой профиль</a></div>
    <section class="section"><h2 style="margin-bottom:12px">Персонаж</h2>
      <div class="cur-char">${charCard(t, true)}<div class="stack" style="gap:8px"><p class="muted">Сайт оформлен в стиле <b style="color:var(--ink)">${esc(t.name)}</b>. Обложка вашего профиля тоже в этом стиле.</p>
        <button class="btn" data-act="picker" style="align-self:flex-start">${ic.palette}Сменить персонажа</button></div></div></section>
    <section class="section"><h2 style="margin-bottom:12px">Профиль</h2>
      <form class="form" id="pf">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><span id="avP">${ava(u, 84)}</span>
          <div class="stack" style="gap:6px"><label class="btn" for="avF" style="align-self:flex-start">${ic.image}${u.avatar ? 'Сменить фото' : 'Загрузить фото'}</label><input type="file" id="avF" accept="image/*" hidden>
          <span class="hint">Сохранится после нажатия «Сохранить».</span></div></div>
        <div class="field"><label for="s-n">Имя</label><input class="input" id="s-n" name="name" value="${esc(u.name)}" maxlength="60" autocomplete="given-name"></div>
        <div class="row"><div class="field"><label for="s-c">Город</label><input class="input" id="s-c" name="city" value="${esc(u.city)}" maxlength="40"></div>
          <div class="field"><label for="s-s">Что вы делаете</label><input class="input" id="s-s" name="specialty" value="${esc(u.specialty)}" maxlength="60" placeholder="Шитьё, броня, парики…"></div></div>
        <div class="field"><label for="s-b">О себе</label><textarea class="input" id="s-b" name="bio" maxlength="300">${esc(u.bio)}</textarea></div>
        <button class="btn primary" style="align-self:flex-start">Сохранить</button>
      </form></section>
    <section class="section"><h2 style="margin-bottom:12px">Пароль</h2>
      <form class="form" id="pw"><input type="text" name="username" value="${esc(u.username)}" autocomplete="username" hidden>
        <div class="row"><div class="field"><label for="pw-c">Текущий пароль</label>${pwField('pw-c', 'current', 'current-password', '')}</div>
          <div class="field"><label for="pw-n">Новый пароль</label>${pwField('pw-n', 'next', 'new-password', 'Не короче 8 символов')}</div></div>
        <button class="btn" style="align-self:flex-start">Сменить пароль</button></form></section>
    <section class="section"><h2 style="margin-bottom:6px">Приложение на телефоне</h2>
      <p class="muted" style="margin-bottom:10px">${isStandalone() ? 'Cosplaygram уже установлен на этом устройстве.' : 'Добавьте Cosplaygram на экран телефона — он будет открываться как обычное приложение.'}</p>
      ${isStandalone() ? '' : `<button class="btn" data-act="install">${ic.phone}Установить</button>`}</section>
    <section class="section"><button class="btn ghost danger" data-act="logout">${ic.logout}Выйти из аккаунта</button></section></div>`;
  bindEyes(view());
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
  if (state.me?.role !== 'admin') { view().innerHTML = '<div class="empty"><h2>Раздел только для модераторов</h2></div>'; return; }
  const { stats, reports } = await api('/admin/reports');
  const kinds = { post: 'Публикация', comment: 'Комментарий', thread: 'Тема форума', message: 'Сообщение', user: 'Профиль', event: 'Мероприятие' };
  view().innerHTML = `<div class="narrow"><div class="page-head"><div><h1>Модерация</h1><p class="muted">Жалобы и состояние платформы.</p></div></div>
    <div class="tiles-stats"><div><b class="num">${stats.users}</b><span class="small muted">участников</span></div><div><b class="num">${stats.posts}</b><span class="small muted">публикаций</span></div>
      <div><b class="num">${stats.threads}</b><span class="small muted">тем</span></div><div><b class="num">${stats.messages}</b><span class="small muted">сообщений в чате</span></div></div>
    <h2 style="margin-bottom:4px">Открытые жалобы · ${reports.length}</h2>
    <div class="list section">${reports.map((r) => `<div class="item">${ava(r.reporter, 36)}<span style="min-width:0"><b>${esc(r.reason)}</b>
      <span class="meta" style="display:block">${kinds[r.type] || r.type} · от @${esc(r.reporter?.username)}, ${ago(r.createdAt)}</span>
      ${r.type === 'post' ? `<button class="btn sm" style="margin-top:6px" data-open="${esc(r.targetId)}">Открыть</button>` : r.type === 'thread' ? `<a class="btn sm" style="margin-top:6px" href="#/forum/${esc(r.targetId)}">Открыть</a>` : ''}</span>
      <button class="btn sm" data-res="${r.id}">Закрыть</button></div>`).join('') || '<div class="empty"><p>Жалоб нет.</p></div>'}</div>
    <section class="section"><h2>Фото персонажей</h2><p class="muted small" style="margin:6px 0 12px">Загрузите обложку для карточки персонажа — например, фото косплея участника с его разрешения. Обложка важнее остальных фото.</p>
      <div class="char-grid" id="adChars"></div><input type="file" id="adFile" accept="image/*" hidden></section>
    <section class="section"><h2>Демо-контент</h2><p class="muted small" style="margin:6px 0 12px">Когда появятся настоящие участники, уберите демо-профили, их работы и примеры мероприятий.</p>
      <button class="btn danger" id="clr">Удалить демо-контент</button></section></div>`;
  bindCards(view());
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
  $('#clr').onclick = confirmTwice(async () => { await api('/admin/demo/clear', { method: 'POST' }); toast('Демо-контент удалён'); location.hash = '#/'; }, 'Нажмите ещё раз: демо-контент удалится без возможности восстановления');
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
  if (!state.me) {
    pageLanding();
    document.title = 'Cosplaygram — выберите персонажа';
    return;
  }
  const pages = {
    '': () => pageFeed(params), process: pageProcess, search: () => pageSearch(params), people: () => pagePeople(params),
    u: () => pageProfile(decodeURIComponent(parts[1] || '')), p: () => pagePost(parts[1]), saved: pageSaved, settings: pageSettings,
    notifications: pageNotifications, messages: () => pageMessages(parts[1] ? decodeURIComponent(parts[1]) : ''),
    forum: () => (parts[1] ? pageThread(parts[1]) : pageForum(params)), events: () => pageEvents(params), chat: () => pageChat(params), admin: pageAdmin,
  };
  const fn = pages[parts[0] || ''];
  try {
    if (fn) await fn();
    else view().innerHTML = '<div class="empty"><h2>Такой страницы нет</h2><a class="btn" href="#/">В ленту</a></div>';
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Не удалось загрузить</h2><p>${esc(e.message)}</p><button class="btn" id="retry">Повторить</button></div>`;
    $('#retry').onclick = route;
  }
  const titles = { process: 'Мастерская', search: 'Поиск', people: 'Мастера', saved: 'Сохранённое', settings: 'Настройки', notifications: 'Уведомления', messages: 'Сообщения', forum: 'Форум', events: 'Мероприятия', chat: 'Чат', admin: 'Модерация', p: 'Публикация', u: '@' + decodeURIComponent(parts[1] || '') };
  document.title = parts[0] ? `${titles[parts[0]] || ''} — Cosplaygram` : 'Cosplaygram';
}

window.addEventListener('hashchange', route);
(async () => {
  await refreshMe();
  if (state.me?.theme) { CG.apply(state.me.theme); CG.store(state.me.theme); }
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
