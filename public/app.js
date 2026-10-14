// Cosplaygram — клиент (чистый JS, без сборки)
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { me: null, unread: 0, chatTimer: null, storyTimer: null, notifTimer: null, groups: [] };
const view = () => $('#view');

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || 'Не удалось выполнить запрос. Проверьте интернет и попробуйте ещё раз.');
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
  toast.t = setTimeout(() => (t.hidden = true), 2600);
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
const plural = (n, one, few, many) => {
  const a = n % 10, b = n % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
};

// ---------- иконки ----------
const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ic = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  needle: I('<path d="M4 20 18 6"/><ellipse cx="19.5" cy="4.5" rx="1.6" ry="2.6" transform="rotate(45 19.5 4.5)"/><path d="M8 13c-3 1-4 4-2 5s5-1 6-3" stroke-dasharray="2 2.4"/>'),
  forum: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  bell: I('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 4 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4 20 4 22.4 7.3 21.2 10.7 19.5 15.4 12 20 12 20z"/>'),
  comment: I('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>'),
  save: I('<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  flag: I('<path d="M5 21V4h11l-1.5 4L16 12H5"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.07-.4.1-.8.1-1.2z"/>'),
  shield: I('<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/>'),
  logout: I('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>'),
  chevron: I('<path d="m6 9 6 6 6-6"/>'),
  edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9 17h6"/>'),
};

function ava(u, size = 36) {
  if (!u) return `<span class="ava" style="--s:${size}px"></span>`;
  const inner = u.avatar ? `<img src="${esc(u.avatar)}" alt="" loading="lazy">` : esc((u.name || u.username || '?').trim()[0].toUpperCase());
  return `<span class="ava" data-color="${esc(u.color || 'lapis')}" style="--s:${size}px">${inner}</span>`;
}
const userLink = (u) => `#/u/${encodeURIComponent(u?.username || '')}`;
const byline = (u, sub) =>
  `<a class="byline" href="${userLink(u)}">${ava(u, 36)}<span class="t"><b>${esc(u?.name || u?.username)}</b><span>@${esc(u?.username)}${sub ? ' · ' + esc(sub) : ''}</span></span></a>`;

// ---------- шапка и навигация ----------
const NAV = [
  { href: '#/', label: 'Лента', icon: 'home', match: (p) => p === '' },
  { href: '#/process', label: 'Мастерская', icon: 'needle', match: (p) => p === 'process' },
  { href: '#/forum', label: 'Форум', icon: 'forum', match: (p) => p === 'forum' },
  { href: '#/events', label: 'Календарь', icon: 'calendar', match: (p) => p === 'events' },
  { href: '#/chat', label: 'Чат', icon: 'chat', match: (p) => p === 'chat' },
  { href: '#/people', label: 'Мастера', icon: 'user', match: (p) => p === 'people' },
];

function renderChrome() {
  const p = (location.hash.slice(2).split(/[/?]/)[0]) || '';
  const me = state.me;
  $('#topNav').innerHTML = me ? NAV.map((n) => `<a href="${n.href}" class="${n.match(p) ? 'active' : ''}">${n.label}</a>`).join('') : '';
  $('#headerActions').innerHTML = me
    ? `<a class="iconbtn" href="#/search" aria-label="Поиск">${ic.search}</a>
       <a class="iconbtn" href="#/notifications" aria-label="Уведомления">${ic.bell}${state.unread ? `<span class="dot num">${state.unread > 9 ? '9+' : state.unread}</span>` : ''}</a>
       <button class="btn primary sm hide-mobile" data-act="create">${ic.plus}Опубликовать</button>
       <div style="position:relative">
         <button class="me-chip" id="meBtn" aria-haspopup="true" aria-expanded="false" aria-label="Мой профиль и настройки">${ava(me, 34)}<span class="nm">${esc(me.name || me.username)}</span>${ic.chevron}</button>
         <div class="menu" id="meMenu" hidden>
           <div class="menu-head">${ava(me, 44)}<div style="min-width:0"><b>${esc(me.name)}</b><span>@${esc(me.username)}</span></div></div>
           <a href="${userLink(me)}">${ic.user}Мой профиль</a>
           <a href="#/settings">${ic.edit}Настроить профиль и фото</a>
           <a href="#/saved">${ic.save}Сохранённое</a>
           ${me.role === 'admin' ? `<a href="#/admin">${ic.shield}Модерация</a>` : ''}
           <button data-act="theme">${ic.moon}Светлая / тёмная тема</button>
           <hr><button data-act="logout">${ic.logout}Выйти</button>
         </div></div>`
    : `<button class="btn ghost sm" data-act="login">Войти</button><button class="btn primary sm" data-act="register">Регистрация</button>`;
  $('#bottomNav').hidden = !me;
  $('#bottomNav').innerHTML = !me ? '' : [NAV[0], NAV[1]]
    .map((n) => `<a href="${n.href}" class="${n.match(p) ? 'active' : ''}">${ic[n.icon]}${n.label}</a>`)
    .join('') +
    `<button class="create" data-act="create">${ic.plus}Создать</button>` +
    [NAV[2], NAV[4]].map((n) => `<a href="${n.href}" class="${n.match(p) ? 'active' : ''}">${ic[n.icon]}${n.label}</a>`).join('');
  const btn = $('#meBtn');
  if (btn) {
    btn.onclick = (e) => {
      e.stopPropagation();
      const m = $('#meMenu');
      m.hidden = !m.hidden;
      btn.setAttribute('aria-expanded', String(!m.hidden));
    };
  }
}
document.addEventListener('click', (e) => {
  const m = $('#meMenu');
  if (m && !m.hidden && !e.target.closest('#meMenu')) m.hidden = true;
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'create') requireAuth(() => openCreate());
  if (a === 'create-story') requireAuth(() => openCreate('story'));
  if (a === 'login') openAuth('login');
  if (a === 'register') openAuth('register');
  if (a === 'logout') logout();
  if (a === 'theme') toggleTheme();
});

function toggleTheme() {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  r.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('cg-theme', r.dataset.theme); } catch {}
}
try { const t = localStorage.getItem('cg-theme'); if (t) document.documentElement.dataset.theme = t; } catch {}

// ---------- оверлей ----------
function openOverlay(html, onClose) {
  const o = $('#overlay');
  o.innerHTML = `<button class="iconbtn close" aria-label="Закрыть">${ic.close}</button>${html}`;
  o.hidden = false;
  document.body.style.overflow = 'hidden';
  o.onclick = (e) => { if (e.target === o || e.target.closest('.close')) closeOverlay(); };
  o._onClose = onClose;
  return o;
}
function closeOverlay() {
  const o = $('#overlay');
  if (o.hidden) return;
  o.hidden = true;
  o.innerHTML = '';
  document.body.style.overflow = '';
  clearTimeout(state.storyTimer);
  const cb = o._onClose;
  o._onClose = null;
  if (cb) cb();
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

// ---------- вход и регистрация ----------
function requireAuth(fn) {
  if (state.me) return fn();
  openAuth('register', fn);
}

function openAuth(mode = 'login', after) {
  const reg = mode === 'register';
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="authT">
    <div class="modal-head"><h1 id="authT" style="font-size:2rem">${reg ? 'Создать профиль' : 'Вход в Cosplaygram'}</h1>
      <p class="muted" style="margin-top:6px">${reg ? 'Показывайте костюмы, делитесь процессом и находите мастеров рядом.' : 'Введите ник и пароль.'}</p></div>
    <div class="modal-body">
      <form class="form" id="authForm" novalidate>
        <div class="field"><label for="au-user">Ник латиницей</label><input class="input" id="au-user" name="username" autocomplete="username" autocapitalize="none" required placeholder="aru.cos"></div>
        ${reg ? `<div class="field"><label for="au-name">Имя</label><input class="input" id="au-name" name="name" autocomplete="name" placeholder="Аружан"></div>
        <div class="row">
          <div class="field"><label for="au-city">Город</label><input class="input" id="au-city" name="city" placeholder="Актобе"></div>
          <div class="field"><label for="au-spec">Что вы делаете</label><input class="input" id="au-spec" name="specialty" placeholder="Броня из EVA"></div>
        </div>` : ''}
        <div class="field"><label for="au-pass">Пароль</label><input class="input" id="au-pass" type="password" name="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required placeholder="${reg ? 'Не короче 8 символов' : ''}"></div>
        <p class="error" id="authErr" role="alert" hidden></p>
        <button class="btn primary" type="submit">${reg ? 'Создать профиль' : 'Войти'}</button>
      </form>
      <p class="small muted" style="margin-top:14px;text-align:center">${reg ? 'Уже есть профиль?' : 'Ещё нет профиля?'}
        <button class="btn ghost sm" id="authSwitch">${reg ? 'Войти' : 'Создать профиль'}</button></p>
    </div></div>`);
  $('#authSwitch', o).onclick = () => openAuth(reg ? 'login' : 'register', after);
  $('#authForm', o).onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const { user } = await api(reg ? '/register' : '/login', { body: Object.fromEntries(new FormData(e.target)) });
      state.me = user;
      closeOverlay();
      toast(reg ? `Профиль создан. Добро пожаловать, ${user.name}!` : 'Вы вошли');
      await refreshMe();
      if (after) after(); else route();
    } catch (err) {
      const p = $('#authErr', o);
      p.textContent = err.message;
      p.hidden = false;
      btn.disabled = false;
    }
  };
  setTimeout(() => $('#au-user', o)?.focus(), 50);
}

async function logout() {
  await api('/logout', { method: 'POST' }).catch(() => {});
  state.me = null;
  state.unread = 0;
  toast('Вы вышли');
  location.hash = '#/';
  route();
}

async function refreshMe() {
  try {
    const r = await api('/me');
    state.me = r.user;
    state.unread = r.unread || 0;
  } catch {}
  renderChrome();
}

// ---------- фото ----------
function readImage(file, max = 1440) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Выберите файл изображения: JPG, PNG или WEBP'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.84));
    };
    img.onerror = () => reject(new Error('Не удалось открыть фото. Попробуйте другой файл.'));
    img.src = url;
  });
}

// ---------- карточка публикации ----------
const likeWord = (n) => plural(n, 'нравится', 'нравится', 'нравится');
function card(p) {
  const a = p.author || {};
  return `<article class="card" data-post="${p.id}">
    <button class="card-media" data-open="${p.id}" aria-label="Открыть: ${esc(p.character || 'публикация')}">
      <img src="${esc(p.slides[0]?.image)}" alt="" loading="lazy">
    </button>
    <span class="badges">${p.kind === 'process' ? '<span class="tag process">Процесс</span>' : ''}${p.demo ? '<span class="tag demo">Демо</span>' : ''}</span>
    ${p.slides.length > 1 ? `<span class="count num">${p.slides.length} ${p.kind === 'process' ? plural(p.slides.length, 'шаг', 'шага', 'шагов') : 'фото'}</span>` : ''}
    <div class="over">
      <div><div class="t">${esc(p.character || 'Без названия')}</div>
        <div class="f">${esc([p.fandom, p.hours ? `${p.hours} ${plural(p.hours, 'час', 'часа', 'часов')} работы` : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="meta-row">
        <a class="who" href="${userLink(a)}">${ava(a, 28)}<span>${esc(a.username)}</span></a>
        <span class="acts">
          <button class="glass ${p.liked ? 'liked' : ''}" data-like="${p.id}" aria-pressed="${p.liked}" aria-label="Нравится">${ic.heart}<span class="num" data-likes="${p.id}">${p.likeCount}</span></button>
          <button class="glass" data-open="${p.id}" aria-label="Комментарии">${ic.comment}<span class="num">${p.commentCount}</span></button>
          <button class="glass ${p.saved ? 'saved' : ''}" data-save="${p.id}" aria-pressed="${p.saved}" aria-label="${p.saved ? 'Убрать из сохранённого' : 'Сохранить'}">${ic.save}</button>
        </span>
      </div>
    </div>
  </article>`;
}
const likeBtn = (p) =>
  `<button class="act ${p.liked ? 'liked' : ''}" data-like="${p.id}" aria-pressed="${p.liked}" aria-label="Нравится">${ic.heart}<span class="num" data-likes="${p.id}">${p.likeCount}</span></button>`;
const saveBtn = (p) =>
  `<button class="act ${p.saved ? 'saved' : ''}" data-save="${p.id}" aria-pressed="${p.saved}" aria-label="${p.saved ? 'Убрать из сохранённого' : 'Сохранить'}">${ic.save}</button>`;
const tile = (p) =>
  `<button class="tile" data-open="${p.id}" aria-label="${esc(p.character || 'Публикация')}"><img src="${esc(p.slides[0]?.image)}" alt="" loading="lazy">
   <span class="tile-meta"><b>${esc(p.character || '')}</b><span class="num">♥ ${p.likeCount} · ${p.commentCount} комм.</span></span></button>`;

function bindCards(root) {
  $$('[data-open]', root).forEach((b) => (b.onclick = () => openPost(b.dataset.open)));
  $$('[data-like]', root).forEach((b) => (b.onclick = () => requireAuth(async () => {
    try {
      const r = await api(`/posts/${b.dataset.like}/like`, { method: 'POST' });
      $$(`[data-like="${b.dataset.like}"]`).forEach((x) => {
        x.classList.toggle('liked', r.liked);
        x.setAttribute('aria-pressed', r.liked);
        x.classList.remove('pop'); void x.offsetWidth; if (r.liked) x.classList.add('pop');
      });
      $$(`[data-likes="${b.dataset.like}"]`).forEach((x) => (x.textContent = r.likeCount));
    } catch (e) { toast(e.message); }
  })));
  $$('[data-save]', root).forEach((b) => (b.onclick = () => requireAuth(async () => {
    try {
      const r = await api(`/posts/${b.dataset.save}/save`, { method: 'POST' });
      $$(`[data-save="${b.dataset.save}"]`).forEach((x) => {
        x.classList.toggle('saved', r.saved);
        x.setAttribute('aria-pressed', r.saved);
      });
      toast(r.saved ? 'Сохранено. Найти можно в меню профиля.' : 'Убрано из сохранённого');
    } catch (e) { toast(e.message); }
  })));
}

// ---------- детальный просмотр ----------
function carousel(p) {
  const n = p.slides.length;
  return `<div class="carousel" data-i="0" data-n="${n}">
    <div class="track">${p.slides.map((s, i) => `<div class="slide"><img src="${esc(s.image)}" alt="${esc(p.character || 'Фото')} — ${i + 1}">${
      s.caption ? `<div class="step">${p.kind === 'process' ? `<b>Шаг ${i + 1} из ${n}</b>` : ''}${esc(s.caption)}</div>` : ''}</div>`).join('')}</div>
    ${n > 1 ? `<button class="nav prev" aria-label="Предыдущее фото" hidden>‹</button><button class="nav next" aria-label="Следующее фото">›</button>
      <div class="pager">${p.slides.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
  </div>`;
}
function bindCarousel(c) {
  if (!c) return;
  const n = +c.dataset.n;
  const go = (d) => {
    const i = Math.max(0, Math.min(n - 1, +c.dataset.i + d));
    c.dataset.i = i;
    $('.track', c).style.transform = `translateX(-${i * 100}%)`;
    if ($('.prev', c)) { $('.prev', c).hidden = i === 0; $('.next', c).hidden = i === n - 1; }
    $$('.pager i', c).forEach((x, j) => x.classList.toggle('on', j === i));
  };
  $('.prev', c)?.addEventListener('click', () => go(-1));
  $('.next', c)?.addEventListener('click', () => go(1));
  let x0 = null;
  c.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  c.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    x0 = null;
  });
}

const commentHtml = (c, p) => {
  const canDel = state.me && (state.me.id === c.authorId || state.me.id === p.authorId || state.me.role === 'admin');
  return `<div class="comment" data-cid="${c.id}">${ava(c.author, 30)}<div class="t"><a href="${userLink(c.author)}"><b>${esc(c.author?.username)}</b></a>${esc(c.text)}
    <div class="small muted">${ago(c.createdAt)}</div></div>
    ${canDel ? `<button class="iconbtn del" data-delc="${c.id}" aria-label="Удалить комментарий">${ic.trash}</button>` : ''}</div>`;
};

async function openPost(id) {
  let p;
  try { ({ post: p } = await api('/posts/' + id)); } catch (e) { return toast(e.message); }
  const mine = state.me && (state.me.id === p.authorId || state.me.role === 'admin');
  const o = openOverlay(`<div class="detail" role="dialog" aria-modal="true" aria-label="${esc(p.character || 'Публикация')}">
    ${carousel(p)}
    <div class="side">
      <div class="scroll">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">${byline(p.author, ago(p.createdAt))}
          <span style="display:flex">
          ${state.me && !mine ? `<button class="iconbtn" data-report="post:${p.id}" aria-label="Пожаловаться">${ic.flag}</button>` : ''}
          ${mine ? `<button class="iconbtn" id="delPost" aria-label="Удалить публикацию">${ic.trash}</button>` : ''}</span></div>
        ${p.character ? `<div><h2 class="serif">${esc(p.character)}</h2>${p.fandom ? `<div class="muted">${esc(p.fandom)}</div>` : ''}</div>` : ''}
        ${p.caption ? `<p class="caption" style="white-space:pre-wrap">${esc(p.caption)}</p>` : ''}
        ${p.materials.length ? `<div><div class="label" style="margin-bottom:6px">Материалы</div><div class="chips">${p.materials.map((m) => `<a class="chip" href="#/search?q=${encodeURIComponent(m)}">${esc(m)}</a>`).join('')}</div></div>` : ''}
        ${p.hours ? `<div class="facts"><span><b>${p.hours}</b> ${plural(p.hours, 'час', 'часа', 'часов')} работы</span></div>` : ''}
        <div class="label">Комментарии</div>
        <div id="cmts" class="stack" style="gap:12px">${p.comments.map((c) => commentHtml(c, p)).join('') || '<p class="muted small" id="noC">Пока никто не написал. Спросите про материалы или технику!</p>'}</div>
      </div>
      <div class="actions" style="border-top:1px solid var(--line)">${likeBtn(p)}<span class="grow"></span>${saveBtn(p)}</div>
      <form class="cform" id="cForm"><input class="input" name="text" maxlength="500" autocomplete="off" placeholder="${state.me ? 'Написать комментарий' : 'Войдите, чтобы комментировать'}" aria-label="Комментарий">
        <button class="btn primary sm">Отправить</button></form>
    </div></div>`);
  bindCarousel($('.carousel', o));
  bindCards(o);
  bindReports(o);
  $('#cForm', o).onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      const inp = e.target.elements.text;
      const text = inp.value.trim();
      if (!text) return;
      try {
        const { comment } = await api(`/posts/${p.id}/comments`, { body: { text } });
        inp.value = '';
        $('#noC', o)?.remove();
        $('#cmts', o).insertAdjacentHTML('beforeend', commentHtml(comment, p));
        bindCommentDel(o, p);
      } catch (err) { toast(err.message); }
    });
  };
  bindCommentDel(o, p);
  $('#delPost', o)?.addEventListener('click', confirmTwice(async () => {
    await api('/posts/' + p.id, { method: 'DELETE' });
    toast('Публикация удалена');
    closeOverlay();
    route();
  }, 'Нажмите ещё раз, чтобы удалить публикацию'));
}
function bindCommentDel(o, p) {
  $$('[data-delc]', o).forEach((b) => (b.onclick = confirmTwice(async () => {
    await api('/comments/' + b.dataset.delc, { method: 'DELETE' });
    b.closest('.comment').remove();
    toast('Комментарий удалён');
  }, 'Нажмите ещё раз, чтобы удалить комментарий')));
}
function confirmTwice(fn, msg) {
  return async function (e) {
    const b = e.currentTarget;
    if (b.dataset.armed !== '1') {
      b.dataset.armed = '1';
      toast(msg);
      setTimeout(() => delete b.dataset.armed, 3000);
      return;
    }
    try { await fn(); } catch (err) { toast(err.message); }
  };
}
function bindReports(root) {
  $$('[data-report]', root).forEach((b) => (b.onclick = () => {
    const [type, id] = b.dataset.report.split(':');
    const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="repT"><div class="modal-head"><h2 id="repT">Пожаловаться</h2></div>
      <div class="modal-body"><form class="form" id="repF"><div class="field"><label for="rep-r">Что не так?</label>
      <select class="input" id="rep-r" name="reason"><option>Спам или реклама</option><option>Оскорбления</option><option>Чужие фото без указания автора</option><option>Неприемлемый контент</option><option>Другое</option></select></div>
      <button class="btn primary">Отправить жалобу</button></form></div></div>`);
    $('#repF', o).onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/reports', { body: { type, id, reason: e.target.elements.reason.value } });
        closeOverlay();
        toast('Жалоба отправлена модераторам');
      } catch (err) { toast(err.message); }
    };
  }));
}

// ---------- создание ----------
function openCreate(kind = 'costume') {
  const slides = [];
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="crT">
    <div class="modal-head"><h2 id="crT" style="font-size:1.25rem">Новая публикация</h2></div>
    <div class="modal-body"><form class="form" id="crF" novalidate>
      <div class="seg" role="tablist">
        <button type="button" data-kind="costume">Готовый костюм</button>
        <button type="button" data-kind="process">Процесс по шагам</button>
        <button type="button" data-kind="story">В мастерской · 24 ч</button>
      </div>
      <p class="hint" id="crHint"></p>
      <label class="drop" id="drop" for="crFiles"><b>Перетащите фото или нажмите, чтобы выбрать</b><span class="small">JPG, PNG или WEBP · до 10 фото</span></label>
      <input type="file" id="crFiles" accept="image/*" multiple hidden>
      <div class="slides-edit" id="slEd"></div>
      <div id="postF" class="form">
        <div class="row">
          <div class="field"><label for="cr-ch">Персонаж</label><input class="input" id="cr-ch" name="character" placeholder="Томирис"></div>
          <div class="field"><label for="cr-fa">Фандом</label><input class="input" id="cr-fa" name="fandom" placeholder="Ориджинал, Genshin Impact…"></div>
        </div>
        <div class="field"><label for="cr-ca">Описание</label><textarea class="input" id="cr-ca" name="caption" maxlength="2200" placeholder="Что было самым сложным? Что бы сделали иначе?"></textarea></div>
        <div class="row">
          <div class="field"><label for="cr-ma">Материалы через запятую</label><input class="input" id="cr-ma" name="materials" placeholder="EVA 10 мм, бархат, акрил"></div>
          <div class="field" style="flex:0 1 150px"><label for="cr-ho">Часов работы</label><input class="input num" id="cr-ho" name="hours" type="number" min="0" max="5000" placeholder="40"></div>
        </div>
      </div>
      <div id="storyF" class="field" hidden><label for="cr-st">Подпись</label><input class="input" id="cr-st" name="text" maxlength="120" placeholder="Крашу шлем, день 3"></div>
      <p class="error" id="crE" role="alert" hidden></p>
      <button class="btn primary" type="submit" id="crB">Опубликовать</button>
    </form></div></div>`);
  const setKind = (k) => {
    kind = k;
    $$('[data-kind]', o).forEach((b) => b.classList.toggle('on', b.dataset.kind === k));
    $('#postF', o).hidden = k === 'story';
    $('#storyF', o).hidden = k !== 'story';
    $('#crHint', o).textContent =
      k === 'process' ? 'Добавьте фото по порядку и подпишите каждый шаг: выкройка, раскрой, покраска…'
        : k === 'story' ? 'Одно фото, которое исчезнет через 24 часа. Подходит для незаконченной работы и анонсов.'
        : 'Покажите готовый образ. Первое фото станет обложкой.';
    if (k === 'story') slides.splice(1);
    renderSlides();
  };
  const renderSlides = () => {
    $('#slEd', o).innerHTML = slides.map((s, i) => `<div class="slide-edit"><img src="${s.image}" alt="Фото ${i + 1}">
      ${kind === 'process' ? `<input class="input" data-cap="${i}" value="${esc(s.caption)}" placeholder="Шаг ${i + 1}: что здесь происходит?" aria-label="Подпись к шагу ${i + 1}">` : `<span class="small muted">${i === 0 ? 'Обложка' : 'Фото ' + (i + 1)}</span>`}
      <button type="button" class="iconbtn" data-rm="${i}" aria-label="Убрать фото ${i + 1}">${ic.close}</button></div>`).join('');
    $$('[data-cap]', o).forEach((inp) => inp.addEventListener('input', () => (slides[+inp.dataset.cap].caption = inp.value)));
    $$('[data-rm]', o).forEach((b) => (b.onclick = () => { slides.splice(+b.dataset.rm, 1); renderSlides(); }));
    $('#drop', o).hidden = kind === 'story' ? slides.length >= 1 : slides.length >= 10;
  };
  const add = async (files) => {
    const limit = kind === 'story' ? 1 : 10;
    for (const f of [...files].slice(0, limit - slides.length)) {
      try { slides.push({ image: await readImage(f), caption: '' }); } catch (e) { toast(e.message); }
    }
    renderSlides();
  };
  $$('[data-kind]', o).forEach((b) => (b.onclick = () => setKind(b.dataset.kind)));
  $('#crFiles', o).onchange = (e) => add(e.target.files);
  const drop = $('#drop', o);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); add(e.dataTransfer.files); };
  $('#crF', o).onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#crE', o);
    err.hidden = true;
    if (!slides.length) { err.textContent = 'Добавьте хотя бы одно фото'; err.hidden = false; return; }
    const b = $('#crB', o);
    b.disabled = true;
    b.textContent = 'Загружаем фото…';
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      if (kind === 'story') {
        await api('/stories', { body: { image: slides[0].image, text: fd.text } });
        toast('Опубликовано в «Сейчас в мастерской»');
      } else {
        await api('/posts', { body: { ...fd, kind, slides } });
        toast('Опубликовано');
      }
      closeOverlay();
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

// ---------- «Сейчас в мастерской» ----------
function seenMap() { try { return JSON.parse(localStorage.getItem('cg-seen') || '{}'); } catch { return {}; } }
async function wipStrip() {
  const { groups } = await api('/stories');
  state.groups = groups;
  const seen = seenMap();
  if (!groups.length && !state.me) return '';
  return `<div class="section-title"><h2>Сейчас в мастерской</h2><span class="small muted">Работа в процессе, исчезает через 24 часа</span></div>
    <div class="wip">${state.me ? `<button class="wip-card add" data-act="create-story">+ Показать, над чем работаете</button>` : ''}
    ${groups.map((g, i) => `<button class="wip-card ${seen[g.author.id] === g.items.at(-1).id ? 'seen' : ''}" data-story="${i}" aria-label="Работа в процессе: ${esc(g.author.username)}">
      <img class="bg" src="${esc(g.items.at(-1).image)}" alt="" loading="lazy">${ava(g.author, 30)}<span class="who">${esc(g.author.username)}</span></button>`).join('')}</div>`;
}
function bindStories(root) { $$('[data-story]', root).forEach((b) => (b.onclick = () => openStory(+b.dataset.story))); }
function openStory(gi, ii = 0) {
  const g = state.groups[gi];
  if (!g) return closeOverlay();
  const s = g.items[ii];
  if (ii === g.items.length - 1) {
    const m = seenMap();
    m[g.author.id] = s.id;
    try { localStorage.setItem('cg-seen', JSON.stringify(m)); } catch {}
  }
  const o = openOverlay(`<div class="story-view" role="dialog" aria-modal="true" aria-label="Работа в процессе: ${esc(g.author.username)}">
    <img src="${esc(s.image)}" alt="">
    <div class="bars">${g.items.map((_, i) => `<span class="bar"><i style="width:${i < ii ? 100 : 0}%"></i></span>`).join('')}</div>
    <a class="head" href="${userLink(g.author)}">${ava(g.author, 32)}<b>${esc(g.author.username)}</b><span class="small" style="opacity:.85">${ago(s.createdAt)}</span></a>
    ${s.text ? `<div class="txt">${esc(s.text)}</div>` : ''}
    <button class="zone l" aria-label="Назад"></button><button class="zone r" aria-label="Дальше"></button></div>`,
    () => { $$('[data-story]').forEach((b) => { const gg = state.groups[+b.dataset.story]; if (gg && seenMap()[gg.author.id] === gg.items.at(-1).id) b.classList.add('seen'); }); });
  const next = () => (ii + 1 < g.items.length ? openStory(gi, ii + 1) : gi + 1 < state.groups.length ? openStory(gi + 1) : closeOverlay());
  const prev = () => (ii > 0 ? openStory(gi, ii - 1) : gi > 0 ? openStory(gi - 1) : null);
  $('.zone.r', o).onclick = next;
  $('.zone.l', o).onclick = prev;
  const bar = $$('.bar i', o)[ii];
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) requestAnimationFrame(() => { bar.style.transition = 'width 5s linear'; bar.style.width = '100%'; });
  else bar.style.width = '100%';
  clearTimeout(state.storyTimer);
  state.storyTimer = setTimeout(next, 5000);
}

// ---------- боковая колонка ----------
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
async function aside() {
  const [{ month, top }, { events }, { users }] = await Promise.all([api('/contest'), api('/events'), api('/users')]);
  const today = new Date().toISOString().slice(0, 10);
  const next = events.filter((e) => e.date >= today).slice(0, 4);
  return `<aside class="aside">
    <section class="panel pad"><div class="section-title"><h2>Рейтинг месяца</h2></div>
      <p class="small muted" style="margin:-6px 0 8px;text-transform:capitalize">${esc(month)}</p>
      ${top.map((p, i) => `<button class="contest-row" data-open="${p.id}"><span class="place num">${i + 1}</span><img src="${esc(p.slides[0]?.image)}" alt="">
        <span class="t"><b>${esc(p.character || 'Костюм')}</b><span>@${esc(p.author?.username)}</span></span><span class="small muted num">♥ ${p.score}</span></button>`).join('') || '<p class="small muted">Отметьте понравившиеся костюмы — здесь появится рейтинг.</p>'}
      <p class="small muted" style="margin-top:8px">Места считаются по отметкам «нравится» за текущий месяц.</p></section>
    <section class="panel pad"><div class="section-title"><h2>Ближайшие события</h2><a class="link" href="#/events">Все</a></div>
      ${next.map((e) => { const [, m, d] = e.date.split('-'); return `<a class="mini-event" href="#/events"><b>${+d} ${MONTHS[+m - 1]}</b><span>${esc(e.title)}<br><span class="muted small">${esc(e.city)}</span></span></a>`; }).join('') || '<p class="small muted">Пока ничего не запланировано.</p>'}</section>
    <section class="panel pad"><div class="section-title"><h2>Мастера</h2><a class="link" href="#/people">Все</a></div>
      ${users.filter((u) => !state.me || u.id !== state.me.id).slice(0, 5).map((u) => `<a class="person" href="${userLink(u)}">${ava(u, 36)}<span class="t"><b>${esc(u.name)}</b><span>${esc(u.specialty || u.city || '@' + u.username)}</span></span></a>`).join('')}</section>
  </aside>`;
}

// ---------- страницы ----------
function spotlight(top, month) {
  const p = top[0];
  if (!p) return '';
  const a = p.author || {};
  return `<section class="spotlight" aria-label="Костюм месяца">
    <button class="pic" data-open="${p.id}" aria-label="Открыть: ${esc(p.character)}"><img src="${esc(p.slides[0]?.image)}" alt="${esc(p.character)}"></button>
    <div class="body">
      <span class="kicker">${ic.trophy}Костюм месяца · <span style="text-transform:capitalize">${esc(month)}</span></span>
      <h1>${esc(p.character)}</h1>
      ${byline(a, a.city)}
      ${p.caption ? `<p class="quote">${esc(p.caption.length > 220 ? p.caption.slice(0, 220) + '…' : p.caption)}</p>` : ''}
      <div class="facts">
        <div><b class="num">${p.score}</b><span>${plural(p.score, 'голос', 'голоса', 'голосов')} в этом месяце</span></div>
        ${p.hours ? `<div><b class="num">${p.hours}</b><span>${plural(p.hours, 'час', 'часа', 'часов')} работы</span></div>` : ''}
        ${p.materials.length ? `<div><b class="num">${p.materials.length}</b><span>${plural(p.materials.length, 'материал', 'материала', 'материалов')}</span></div>` : ''}
      </div>
      <div class="acts"><button class="btn primary" data-open="${p.id}">Смотреть работу</button>
        <button class="btn ${p.liked ? '' : ''}" data-like="${p.id}" aria-pressed="${p.liked}">${ic.heart}Голосовать · <span class="num" data-likes="${p.id}">${p.likeCount}</span></button></div>
    </div>
  </section>`;
}

async function pageFeed(params) {
  const mode = params.get('mode') === 'following' ? 'following' : 'all';
  view().innerHTML = '<div class="skeleton" style="height:440px;margin-bottom:24px"></div><div class="skeleton" style="height:300px"></div>';
  const [strip, { posts }, contest, side] = await Promise.all([
    wipStrip(), api('/feed' + (mode === 'following' ? '?mode=following' : '')), api('/contest'), aside(),
  ]);
  view().innerHTML = `
    ${mode === 'all' ? spotlight(contest.top, contest.month) : ''}
    <div class="layout"><div style="min-width:0">
      ${strip}
      <div class="section-title"><h2>${mode === 'following' ? 'Ваши подписки' : 'Новые работы'}</h2>
        <div class="seg"><a href="#/" class="${mode === 'all' ? 'on' : ''}">Все</a><a href="#/?mode=following" class="${mode === 'following' ? 'on' : ''}">Подписки</a></div></div>
      ${posts.length ? `<div class="cards" id="cards">${posts.map(card).join('')}</div>${posts.length >= 20 ? '<div style="text-align:center"><button class="btn" id="more">Показать ещё</button></div>' : ''}`
        : `<div class="empty panel"><h2>${mode === 'following' ? 'Здесь появятся работы тех, на кого вы подписаны' : 'Пока нет публикаций'}</h2>
           <p>${mode === 'following' ? 'Загляните в раздел «Мастера» и подпишитесь на интересных косплееров.' : 'Покажите первый костюм.'}</p>
           ${mode === 'following' ? '<a class="btn" href="#/people">Найти мастеров</a>' : '<button class="btn primary" data-act="create">Опубликовать</button>'}</div>`}
    </div>${side}</div>`;
  bindStories(view());
  bindCards(view());
  const more = $('#more');
  if (more) more.onclick = async () => {
    more.disabled = true;
    const r = await api(`/feed?before=${posts.at(-1).createdAt}${mode === 'following' ? '&mode=following' : ''}`);
    posts.push(...r.posts);
    const wrap = document.createElement('div');
    wrap.innerHTML = r.posts.map(card).join('');
    bindCards(wrap);
    $('#cards').append(...wrap.children);
    if (r.posts.length < 20) more.remove(); else more.disabled = false;
  };
}

function pageLanding() {
  const shots = [
    ['tomyris', 'Томирис · aru.cos'], ['knight', 'Рыцарь · dias_props'], ['moon', 'Лунная волшебница'],
    ['silkroad', 'Шёлковый путь'], ['spacehunter', 'Космический охотник'], ['kitsune', 'Лиса-хранительница'],
  ];
  view().innerHTML = `<section class="landing">
    <div>
      <h1>Мастерская косплееров <span class="thread">Казахстана</span> и Центральной Азии</h1>
      <p class="lead">Показывайте костюмы и то, как вы их сделали. Спрашивайте про материалы, находите мастеров в своём городе и не пропускайте конкурсы.</p>
      <div class="cta"><button class="btn primary lg" data-act="register">Зарегистрироваться</button><button class="btn lg" data-act="login">Войти</button></div>
      <div class="perks">
        <div><b>Процесс по шагам</b><span>От выкройки до готового образа</span></div>
        <div><b>Форум и чат</b><span>Материалы, пошив, фотосеты</span></div>
        <div><b>Конкурс месяца</b><span>Голосование отметками</span></div>
      </div>
    </div>
    <div class="collage" aria-hidden="true">${shots.map(([f, c]) => `<figure><img src="/demo/${f}.jpg" alt=""><figcaption>${c}</figcaption></figure>`).join('')}</div>
  </section>`;
}
async function pageProcess() {
  view().innerHTML = '<div class="skeleton" style="height:420px"></div>';
  const { posts } = await api('/feed?kind=process');
  view().innerHTML = `<div class="page-head"><div><h1>Мастерская</h1><p class="muted">Как это сделано: пошаговые фото от выкройки до готового костюма. Лучшее место, чтобы научиться новой технике.</p></div>
    <button class="btn primary" id="np">${ic.plus}Показать свой процесс</button></div>
    ${posts.length ? `<div class="cards">${posts.map(card).join('')}</div>` : '<div class="empty panel"><h2>Пока нет пошаговых публикаций</h2><p>Расскажите, как вы делали свой костюм.</p></div>'}`;
  $('#np').onclick = () => requireAuth(() => openCreate('process'));
  bindCards(view());
}

async function pageSearch(params) {
  const q = params.get('q') || '';
  view().innerHTML = `<div class="page-head"><div><h1>Поиск</h1><p class="muted">Ищите по материалам, персонажам, фандомам, мастерам и городам.</p></div></div>
    <form id="sF" style="margin-bottom:12px"><input class="input" id="sq" type="search" value="${esc(q)}" placeholder="Например: EVA, worbla, парик, Алматы" aria-label="Что ищем"></form>
    <div class="chips" style="margin-bottom:22px">${['EVA', 'worbla', 'парик', 'вышивка', 'бархат', '3D', 'Genshin', 'Алматы', 'Астана'].map((t) => `<a class="chip ${t.toLowerCase() === q.toLowerCase() ? 'on' : ''}" href="#/search?q=${encodeURIComponent(t)}">${t}</a>`).join('')}</div>
    <div id="sR"></div>`;
  $('#sF').onsubmit = (e) => { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent($('#sq').value.trim()); };
  if (!q) { $('#sq').focus(); $('#sR').innerHTML = '<p class="muted">Введите слово или выберите подсказку выше.</p>'; return; }
  const { users, posts } = await api('/search?q=' + encodeURIComponent(q));
  $('#sR').innerHTML =
    (users.length ? `<h2 style="margin-bottom:10px">Мастера</h2><div class="panel list" style="margin-bottom:24px">${users.map(personRow).join('')}</div>` : '') +
    (posts.length ? `<h2 style="margin-bottom:10px">Публикации · ${posts.length}</h2><div class="grid">${posts.map(tile).join('')}</div>`
      : `<div class="empty panel"><h2>По запросу «${esc(q)}» ничего нет</h2><p>Попробуйте другое слово: материал, персонажа или город.</p></div>`);
  bindCards(view());
}

const personRow = (u) => `<div class="item">${ava(u, 44)}<a href="${userLink(u)}" style="min-width:0"><h3>${esc(u.name)}</h3>
  <div class="meta">@${esc(u.username)}${u.specialty ? ' · ' + esc(u.specialty) : ''}${u.city ? ' · ' + esc(u.city) : ''}</div></a>
  <a class="btn sm" href="${userLink(u)}">Профиль</a></div>`;

async function pagePeople(params) {
  const city = params.get('city') || '';
  const { users } = await api('/users');
  const cities = [...new Set(users.map((u) => u.city).filter(Boolean))];
  const list = city ? users.filter((u) => u.city === city) : users;
  view().innerHTML = `<div class="page-head"><div><h1>Мастера</h1><p class="muted">Косплееры, швеи, реквизиторы, мастера париков и фотографы.</p></div></div>
    <div class="chips" style="margin-bottom:16px"><a class="chip ${!city ? 'on' : ''}" href="#/people">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="#/people?city=${encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>
    <div class="panel list">${list.map((u) => `<a class="item" href="${userLink(u)}">${ava(u, 48)}<span style="min-width:0"><h3>${esc(u.name)} ${u.demo ? '<span class="tag demo">Демо</span>' : ''}</h3>
      <span class="meta">@${esc(u.username)}${u.specialty ? ' · ' + esc(u.specialty) : ''}${u.city ? ' · ' + esc(u.city) : ''}</span></span>
      <span class="badge-count"><b class="num">${u.followers}</b><span>${plural(u.followers, 'подписчик', 'подписчика', 'подписчиков')}</span></span></a>`).join('')}</div>`;
}

async function pageProfile(username) {
  view().innerHTML = '<div class="skeleton" style="height:300px"></div>';
  let d;
  try { d = await api('/users/' + encodeURIComponent(username)); }
  catch { view().innerHTML = '<div class="empty"><h2>Такого косплеера нет</h2><a class="btn" href="#/people">Все мастера</a></div>'; return; }
  const { user: u, posts, stats } = d;
  let following = d.isFollowing;
  const mine = state.me?.id === u.id;
  const stat = (n, a, b, c) => `<div><b class="num">${n}</b><span>${plural(n, a, b, c)}</span></div>`;
  view().innerHTML = `<div data-color="${esc(u.color)}"><div class="cover"></div>
    <div class="prof">${ava(u, 120)}
      <div class="prof-info"><h1>${esc(u.name)}</h1><div class="muted">@${esc(u.username)} ${u.role === 'admin' ? '<span class="tag admin">Модератор</span>' : ''} ${u.demo ? '<span class="tag demo">Демо-профиль</span>' : ''}</div></div>
      <div class="prof-actions">${mine ? '<a class="btn" href="#/settings">Редактировать профиль</a>'
        : `<button class="btn ${following ? '' : 'primary'}" id="fol">${following ? 'Вы подписаны' : 'Подписаться'}</button>
           ${state.me ? `<button class="iconbtn" data-report="user:${u.id}" aria-label="Пожаловаться на профиль">${ic.flag}</button>` : ''}`}</div>
    </div>
    <div class="prof-meta">
      ${u.specialty || u.city ? `<div style="font-weight:600">${esc([u.specialty, u.city].filter(Boolean).join(', '))}</div>` : ''}
      ${u.bio ? `<p style="max-width:62ch">${esc(u.bio)}</p>` : ''}
      <div class="stats">${stat(stats.posts, 'публикация', 'публикации', 'публикаций')}<div id="folN"><b class="num">${stats.followers}</b><span>${plural(stats.followers, 'подписчик', 'подписчика', 'подписчиков')}</span></div>${stat(stats.following, 'подписка', 'подписки', 'подписок')}${stat(stats.likes, 'отметка', 'отметки', 'отметок')}</div>
    </div></div>
    <div style="margin:26px 0 14px" class="seg" id="pTabs"><button class="on" data-f="all">Все</button><button data-f="costume">Костюмы</button><button data-f="process">Процесс</button></div>
    <div class="grid" id="pG"></div>`;
  const fill = (f) => {
    const list = posts.filter((p) => f === 'all' || p.kind === f);
    $('#pG').innerHTML = list.length ? list.map(tile).join('') : '';
    if (!list.length) $('#pG').insertAdjacentHTML('afterend', '');
    $('#pG').style.display = list.length ? '' : 'none';
    $('#pE')?.remove();
    if (!list.length) $('#pG').insertAdjacentHTML('afterend', `<div class="empty panel" id="pE"><h2>${mine ? 'Покажите свою первую работу' : 'Здесь пока пусто'}</h2>${mine ? '<button class="btn primary" data-act="create">Опубликовать</button>' : ''}</div>`);
    bindCards($('#pG'));
  };
  fill('all');
  $$('#pTabs button').forEach((b) => (b.onclick = () => { $$('#pTabs button').forEach((x) => x.classList.toggle('on', x === b)); fill(b.dataset.f); }));
  bindReports(view());
  $('#fol')?.addEventListener('click', () => requireAuth(async () => {
    try {
      const r = await api(`/users/${encodeURIComponent(u.username)}/follow`, { method: 'POST' });
      following = r.following;
      const b = $('#fol');
      b.textContent = following ? 'Вы подписаны' : 'Подписаться';
      b.classList.toggle('primary', !following);
      $('#folN').innerHTML = `<b class="num">${r.followers}</b><span>${plural(r.followers, 'подписчик', 'подписчика', 'подписчиков')}</span>`;
    } catch (e) { toast(e.message); }
  }));
}

async function pageSaved() {
  if (!state.me) return needLogin('Сохранённое видно только вам');
  const { posts } = await api('/saved');
  view().innerHTML = `<div class="page-head"><div><h1>Сохранённое</h1><p class="muted">Работы и туториалы, к которым хотите вернуться. Видно только вам.</p></div></div>
    ${posts.length ? `<div class="grid">${posts.map(tile).join('')}</div>` : '<div class="empty panel"><h2>Пока ничего не сохранено</h2><p>Нажмите на закладку под публикацией, чтобы сохранить её.</p></div>'}`;
  bindCards(view());
}

const COLORS = { lapis: 'Лазурит', turquoise: 'Бирюза', garnet: 'Гранат', saffron: 'Шафран', violet: 'Аметист', jade: 'Нефрит' };
async function pageSettings() {
  if (!state.me) return needLogin('Войдите, чтобы изменить профиль');
  const u = state.me;
  let avatar = null;
  let color = u.color;
  view().innerHTML = `<div class="page-head"><div><h1>Настройки профиля</h1><p class="muted">Фото, имя, город и цвет обложки — так вас увидят другие косплееры.</p></div><a class="btn" href="${userLink(u)}">Открыть мой профиль</a></div>
    <div class="stack" style="max-width:680px">
    <section class="panel pad"><h2 style="margin-bottom:14px">Профиль</h2>
      <form class="form" id="pf">
        <div class="avatar-edit"><span id="avP">${ava(u, 96)}</span>
          <div><label class="btn" for="avF">${ic.plus}${u.avatar ? 'Сменить фото' : 'Загрузить фото профиля'}</label><input type="file" id="avF" accept="image/*" hidden>
          <p class="hint" style="margin-top:8px">JPG или PNG, лучше квадратное. Фото сохранится после нажатия «Сохранить профиль».</p></div></div>
        <div class="field"><span class="label" id="clrL">Цвет профиля</span><div class="swatches" role="radiogroup" aria-labelledby="clrL">${Object.entries(COLORS)
          .map(([k, v]) => `<button type="button" class="swatch ${k === color ? 'on' : ''}" data-color="${k}" data-sw="${k}" role="radio" aria-checked="${k === color}" aria-label="${v}" title="${v}"></button>`).join('')}</div></div>
        <div class="field"><label for="s-n">Имя</label><input class="input" id="s-n" name="name" value="${esc(u.name)}" maxlength="60"></div>
        <div class="row"><div class="field"><label for="s-c">Город</label><input class="input" id="s-c" name="city" value="${esc(u.city)}" maxlength="40"></div>
          <div class="field"><label for="s-s">Что вы делаете</label><input class="input" id="s-s" name="specialty" value="${esc(u.specialty)}" maxlength="60" placeholder="Шитьё, броня, парики…"></div></div>
        <div class="field"><label for="s-b">О себе</label><textarea class="input" id="s-b" name="bio" maxlength="300">${esc(u.bio)}</textarea></div>
        <button class="btn primary" style="align-self:flex-start">Сохранить профиль</button>
      </form></section>
    <section class="panel pad"><h2 style="margin-bottom:14px">Пароль</h2>
      <form class="form" id="pw"><input type="text" name="username" value="${esc(u.username)}" autocomplete="username" hidden>
        <div class="row"><div class="field"><label for="pw-c">Текущий пароль</label><input class="input" id="pw-c" type="password" name="current" autocomplete="current-password" required></div>
        <div class="field"><label for="pw-n">Новый пароль</label><input class="input" id="pw-n" type="password" name="next" autocomplete="new-password" required placeholder="Не короче 8 символов"></div></div>
        <button class="btn" style="align-self:flex-start">Сменить пароль</button></form></section>
    <section class="panel pad" style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><h2>Тема оформления</h2><p class="muted small">Светлая или тёмная</p></div><button class="btn" data-act="theme">${ic.moon}Сменить тему</button></section>
    </div>`;
  $$('[data-sw]').forEach((b) => (b.onclick = () => {
    color = b.dataset.sw;
    $$('[data-sw]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); });
    $('#avP .ava').dataset.color = color;
  }));
  $('#avF').onchange = async (e) => {
    try {
      avatar = await readImage(e.target.files[0], 480);
      $('#avP').innerHTML = `<span class="ava" style="--s:96px"><img src="${avatar}" alt=""></span>`;
    } catch (err) { toast(err.message); }
  };
  $('#pf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const body = { ...Object.fromEntries(new FormData(e.target)), color };
      if (avatar) body.avatar = avatar;
      const { user } = await api('/me', { method: 'PATCH', body });
      state.me = user;
      renderChrome();
      toast('Профиль сохранён');
    } catch (err) { toast(err.message); }
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

const NTEXT = { like: 'отметил(а) вашу работу', comment: 'прокомментировал(а) вашу работу', follow: 'подписался(-ась) на вас', reply: 'ответил(а) в вашей теме' };
async function pageNotifications() {
  if (!state.me) return needLogin('Войдите, чтобы видеть уведомления');
  const { items } = await api('/notifications');
  view().innerHTML = `<div class="page-head"><div><h1>Уведомления</h1></div></div>
    <div class="panel list" style="max-width:720px">${items.map((n) => {
      const href = n.postId ? '' : n.threadId ? `#/forum/${n.threadId}` : userLink(n.actor);
      return `<${href ? `a href="${href}"` : `button data-open="${n.postId}" style="width:100%;border:0;background:none;text-align:left"`} class="item notif ${n.read ? '' : 'unread'}">${ava(n.actor, 40)}
        <span style="min-width:0"><b>${esc(n.actor?.name)}</b> ${NTEXT[n.type] || ''}${n.threadTitle ? ` «${esc(n.threadTitle)}»` : ''}<span class="meta" style="display:block">${ago(n.createdAt)}</span></span>
        ${n.postImage ? `<img class="thumb" src="${esc(n.postImage)}" alt="">` : '<span></span>'}</${href ? 'a' : 'button'}>`;
    }).join('') || '<div class="empty"><h2>Пока тихо</h2><p>Здесь появятся отметки, комментарии, подписки и ответы на форуме.</p></div>'}</div>`;
  bindCards(view());
  if (state.unread) { await api('/notifications/read', { method: 'POST' }).catch(() => {}); state.unread = 0; renderChrome(); }
}

const CATS = { materials: 'Ищу материалы', sewing: 'Помощь с пошивом', props: 'Реквизит и броня', wigs: 'Парики и грим', photo: 'Фотосъёмка', other: 'Разное' };
async function pageForum(params) {
  const cat = params.get('c') || '';
  const { threads } = await api('/forum');
  const list = cat ? threads.filter((t) => t.category === cat) : threads;
  view().innerHTML = `<div class="page-head"><div><h1>Форум</h1><p class="muted">Где купить материалы, кто поможет с пошивом, с кем сходить на фотосет.</p></div>
    <button class="btn primary" id="nt">${ic.plus}Новая тема</button></div>
    <div class="chips" style="margin-bottom:16px"><a class="chip ${!cat ? 'on' : ''}" href="#/forum">Все темы</a>${Object.entries(CATS).map(([k, v]) => `<a class="chip ${cat === k ? 'on' : ''}" href="#/forum?c=${k}">${v}</a>`).join('')}</div>
    <div class="panel list">${list.map((t) => `<a class="item" href="#/forum/${t.id}">${ava(t.author, 40)}
      <span style="min-width:0"><span class="cat">${CATS[t.category]}${t.city ? ` · ${esc(t.city)}` : ''}</span><h3>${esc(t.title)}</h3>
      <span class="meta">@${esc(t.author?.username)}, активность ${ago(t.lastAt)}</span></span>
      <span class="badge-count"><b class="num">${t.replyCount}</b><span>${plural(t.replyCount, 'ответ', 'ответа', 'ответов')}</span></span></a>`).join('')
      || '<div class="empty"><h2>В этом разделе пока нет тем</h2><p>Задайте первый вопрос.</p></div>'}</div>`;
  $('#nt').onclick = () => requireAuth(openNewThread);
}
function openNewThread() {
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ntT"><div class="modal-head"><h2 id="ntT">Новая тема</h2></div>
    <div class="modal-body"><form class="form" id="ntF">
      <div class="row"><div class="field"><label for="nt-c">Раздел</label><select class="input" id="nt-c" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label for="nt-ci">Город</label><input class="input" id="nt-ci" name="city" value="${esc(state.me?.city || '')}" placeholder="Необязательно"></div></div>
      <div class="field"><label for="nt-t">Заголовок</label><input class="input" id="nt-t" name="title" required maxlength="140" placeholder="Где купить worbla в Астане?"></div>
      <div class="field"><label for="nt-b">Подробности</label><textarea class="input" id="nt-b" name="body" required maxlength="4000" placeholder="Что ищете, сроки, бюджет"></textarea></div>
      <p class="error" id="ntE" role="alert" hidden></p><button class="btn primary">Создать тему</button></form></div></div>`);
  $('#ntF', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { thread } = await api('/forum', { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay();
      location.hash = '#/forum/' + thread.id;
    } catch (err) { const p = $('#ntE', o); p.textContent = err.message; p.hidden = false; }
  };
}
async function pageThread(id) {
  let t;
  try { ({ thread: t } = await api('/forum/' + id)); }
  catch { view().innerHTML = '<div class="empty"><h2>Тема не найдена</h2><a class="btn" href="#/forum">Ко всем темам</a></div>'; return; }
  const canDel = state.me && (state.me.id === t.authorId || state.me.role === 'admin');
  view().innerHTML = `<a href="#/forum" class="btn ghost sm" style="margin-bottom:12px;padding-left:0">‹ Все темы</a>
    <article class="panel pad" style="max-width:820px">
      <span class="cat">${CATS[t.category]}${t.city ? ` · ${esc(t.city)}` : ''}</span>
      <h1 style="margin:6px 0 14px;font-size:1.6rem">${esc(t.title)}</h1>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">${byline(t.author, ago(t.createdAt))}
        <span>${state.me && !canDel ? `<button class="iconbtn" data-report="thread:${t.id}" aria-label="Пожаловаться">${ic.flag}</button>` : ''}
        ${canDel ? `<button class="iconbtn" id="dT" aria-label="Удалить тему">${ic.trash}</button>` : ''}</span></div>
      <p style="white-space:pre-wrap;margin:16px 0;max-width:65ch;overflow-wrap:anywhere">${esc(t.body)}</p>
      <h2 style="margin-top:8px">${t.replies.length} ${plural(t.replies.length, 'ответ', 'ответа', 'ответов')}</h2>
      <div>${t.replies.map((r) => `<div class="reply">${ava(r.author, 34)}<div style="min-width:0"><a href="${userLink(r.author)}"><b>${esc(r.author?.name)}</b></a> <span class="small muted">@${esc(r.author?.username)}, ${ago(r.createdAt)}</span><p>${esc(r.text)}</p></div></div>`).join('')}</div>
      <form class="form" id="rF" style="margin-top:16px"><label class="label" for="r-t">Ваш ответ</label>
        <textarea class="input" id="r-t" name="text" maxlength="2000" placeholder="Подскажите, где найти, или предложите помощь"></textarea>
        <button class="btn primary" style="align-self:flex-start">Ответить</button></form></article>`;
  bindReports(view());
  $('#rF').onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      try { await api(`/forum/${id}/replies`, { body: { text: $('#r-t').value } }); pageThread(id); } catch (err) { toast(err.message); }
    });
  };
  $('#dT')?.addEventListener('click', confirmTwice(async () => {
    await api('/forum/' + id, { method: 'DELETE' });
    toast('Тема удалена');
    location.hash = '#/forum';
  }, 'Нажмите ещё раз, чтобы удалить тему'));
}

const TYPES = { contest: 'Конкурс', festival: 'Фестиваль', meetup: 'Встреча', workshop: 'Мастер-класс' };
async function pageEvents(params) {
  const city = params.get('city') || '';
  const past = params.get('past') === '1';
  const { events } = await api('/events');
  const today = new Date().toISOString().slice(0, 10);
  const cities = [...new Set(events.map((e) => e.city).filter(Boolean))];
  let list = events.filter((e) => (past ? e.date < today : e.date >= today) && (!city || e.city === city));
  if (past) list = list.reverse();
  view().innerHTML = `<div class="page-head"><div><h1>Календарь</h1><p class="muted">Конкурсы, фестивали, встречи и мастер-классы в городах Казахстана.</p></div>
    <button class="btn primary" id="ne">${ic.plus}Добавить событие</button></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
      <div class="seg"><a href="#/events${city ? '?city=' + encodeURIComponent(city) : ''}" class="${past ? '' : 'on'}">Предстоящие</a><a href="#/events?past=1${city ? '&city=' + encodeURIComponent(city) : ''}" class="${past ? 'on' : ''}">Прошедшие</a></div>
      <div class="chips"><a class="chip ${!city ? 'on' : ''}" href="#/events${past ? '?past=1' : ''}">Все города</a>${cities.map((c) => `<a class="chip ${c === city ? 'on' : ''}" href="#/events?city=${encodeURIComponent(c)}${past ? '&past=1' : ''}">${esc(c)}</a>`).join('')}</div></div>
    <div class="panel list" style="max-width:860px">${list.map((e) => {
      const [, m, d] = e.date.split('-');
      const canDel = state.me && (state.me.id === e.authorId || state.me.role === 'admin');
      return `<div class="item"><div class="date"><b class="num">${+d}</b><span>${MONTHS[+m - 1]}</span></div>
        <div style="min-width:0"><span class="etype ${e.type}">${TYPES[e.type] || 'Событие'}</span> ${e.demo ? '<span class="tag demo">Пример</span>' : ''}<h3>${esc(e.title)}</h3>
        <div class="meta">${esc([e.city, e.place].filter(Boolean).join(', '))}</div>
        ${e.note ? `<p class="small" style="margin-top:4px">${esc(e.note)}</p>` : ''}
        ${e.link ? `<a class="small" style="color:var(--lapis);font-weight:600" href="${esc(e.link)}" target="_blank" rel="noopener">Страница организатора</a>` : ''}</div>
        ${canDel ? `<button class="iconbtn" data-dele="${e.id}" aria-label="Удалить событие">${ic.trash}</button>` : '<span></span>'}</div>`;
    }).join('') || `<div class="empty"><h2>${past ? 'Прошедших событий нет' : 'Ближайших событий нет'}</h2><p>Знаете о конкурсе или встрече? Добавьте её в календарь.</p></div>`}</div>`;
  $('#ne').onclick = () => requireAuth(openNewEvent);
  $$('[data-dele]').forEach((b) => (b.onclick = confirmTwice(async () => {
    await api('/events/' + b.dataset.dele, { method: 'DELETE' });
    toast('Событие удалено');
    route();
  }, 'Нажмите ещё раз, чтобы удалить событие')));
}
function openNewEvent() {
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="neT"><div class="modal-head"><h2 id="neT">Новое событие</h2></div>
    <div class="modal-body"><form class="form" id="neF">
      <div class="field"><label for="ne-t">Название</label><input class="input" id="ne-t" name="title" required maxlength="120"></div>
      <div class="row"><div class="field"><label for="ne-d">Дата</label><input class="input" id="ne-d" type="date" name="date" required></div>
        <div class="field"><label for="ne-ty">Тип</label><select class="input" id="ne-ty" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div></div>
      <div class="row"><div class="field"><label for="ne-c">Город</label><input class="input" id="ne-c" name="city" value="${esc(state.me?.city || '')}"></div>
        <div class="field"><label for="ne-p">Место</label><input class="input" id="ne-p" name="place" maxlength="120"></div></div>
      <div class="field"><label for="ne-l">Ссылка на организатора</label><input class="input" id="ne-l" name="link" type="url" placeholder="https://"></div>
      <div class="field"><label for="ne-n">Описание</label><input class="input" id="ne-n" name="note" maxlength="300" placeholder="Номинации, взнос, как участвовать"></div>
      <p class="error" id="neE" role="alert" hidden></p><button class="btn primary">Добавить в календарь</button></form></div></div>`);
  $('#neF', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/events', { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay();
      toast('Событие добавлено в календарь');
      route();
    } catch (err) { const p = $('#neE', o); p.textContent = err.message; p.hidden = false; }
  };
}

const ROOMS = { general: 'Общий', almaty: 'Алматы', astana: 'Астана', shymkent: 'Шымкент', aktobe: 'Актобе', karaganda: 'Караганда', help: 'Срочная помощь' };
async function pageChat(params) {
  const room = ROOMS[params.get('r')] ? params.get('r') : 'general';
  view().innerHTML = `<div class="panel chat"><nav class="rooms" aria-label="Комнаты">${Object.entries(ROOMS).map(([k, v]) => `<a class="room ${k === room ? 'on' : ''}" href="#/chat?r=${k}"># ${v}</a>`).join('')}</nav>
    <section class="msgs"><div class="msg-list" id="ml" aria-live="polite"></div>
      <form class="msg-form" id="mf"><input class="input" id="mt" autocomplete="off" maxlength="1000" placeholder="${state.me ? 'Сообщение в #' + ROOMS[room] : 'Войдите, чтобы писать в чат'}" aria-label="Сообщение"><button class="btn primary">Отправить</button></form></section></div>`;
  let last = 0;
  const ml = $('#ml');
  const add = (msgs) => {
    const fresh = msgs.filter((m) => m.createdAt > last);
    if (!fresh.length) return;
    $('#mEmpty')?.remove();
    const atBottom = ml.scrollHeight - ml.scrollTop - ml.clientHeight < 80;
    ml.insertAdjacentHTML('beforeend', fresh.map((m) => `<div class="msg ${state.me && m.authorId === state.me.id ? 'mine' : ''}">${ava(m.author, 30)}
      <div class="bubble"><div class="who">${esc(m.author?.name)}</div>${esc(m.text)}</div></div>`).join(''));
    last = Math.max(last, ...fresh.map((m) => m.createdAt));
    if (atBottom || !ml.dataset.init) ml.scrollTop = ml.scrollHeight;
    ml.dataset.init = 1;
  };
  const poll = async () => { try { add((await api(`/chat/${room}?after=${last}`)).messages); } catch {} };
  await poll();
  if (!last) ml.innerHTML = '<div class="empty" id="mEmpty"><p>В этой комнате пока тихо. Напишите первым!</p></div>';
  clearInterval(state.chatTimer);
  state.chatTimer = setInterval(poll, 3000);
  $('#mf').onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      const inp = $('#mt');
      const text = inp.value.trim();
      if (!text) return;
      try {
        const { message } = await api(`/chat/${room}`, { body: { text } });
        inp.value = '';
        add([message]);
        ml.scrollTop = ml.scrollHeight;
      } catch (err) { toast(err.message); }
    });
  };
}

async function pageAdmin() {
  if (state.me?.role !== 'admin') { view().innerHTML = '<div class="empty"><h2>Раздел только для модераторов</h2></div>'; return; }
  const { stats, reports } = await api('/admin/reports');
  view().innerHTML = `<div class="page-head"><div><h1>Модерация</h1><p class="muted">Жалобы пользователей и состояние платформы.</p></div></div>
    <div class="stat-tiles"><div class="panel"><b>${stats.users}</b><span class="small muted">участников</span></div><div class="panel"><b>${stats.posts}</b><span class="small muted">публикаций</span></div>
      <div class="panel"><b>${stats.threads}</b><span class="small muted">тем на форуме</span></div><div class="panel"><b>${stats.messages}</b><span class="small muted">сообщений в чате</span></div></div>
    <h2 style="margin-bottom:10px">Открытые жалобы · ${reports.length}</h2>
    <div class="panel list" style="margin-bottom:24px">${reports.map((r) => `<div class="item">${ava(r.reporter, 36)}<span style="min-width:0"><b>${esc(r.reason)}</b>
      <span class="meta" style="display:block">${{ post: 'Публикация', comment: 'Комментарий', thread: 'Тема форума', message: 'Сообщение', user: 'Профиль', event: 'Событие' }[r.type]} · от @${esc(r.reporter?.username)}, ${ago(r.createdAt)}</span>
      <span style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">${r.type === 'post' ? `<button class="btn sm" data-open="${esc(r.targetId)}">Открыть</button>` : r.type === 'thread' ? `<a class="btn sm" href="#/forum/${esc(r.targetId)}">Открыть</a>` : ''}</span></span>
      <button class="btn sm" data-res="${r.id}">Закрыть жалобу</button></div>`).join('') || '<div class="empty"><p>Жалоб нет.</p></div>'}</div>
    <section class="panel pad"><h2>Демо-контент</h2><p class="muted small" style="margin:6px 0 12px">Когда появятся настоящие участники, уберите демо-профили, их публикации и примеры событий.</p>
      <button class="btn danger" id="clr">Удалить весь демо-контент</button></section>`;
  bindCards(view());
  $$('[data-res]').forEach((b) => (b.onclick = async () => { await api(`/admin/reports/${b.dataset.res}/resolve`, { method: 'POST' }); b.closest('.item').remove(); toast('Жалоба закрыта'); }));
  $('#clr').onclick = confirmTwice(async () => { await api('/admin/demo/clear', { method: 'POST' }); toast('Демо-контент удалён'); location.hash = '#/'; }, 'Нажмите ещё раз: демо-контент удалится без возможности восстановления');
}

function needLogin(text) {
  view().innerHTML = `<div class="empty"><h2>${esc(text)}</h2><button class="btn primary" data-act="login">Войти</button></div>`;
}

// ---------- роутер ----------
async function route() {
  clearInterval(state.chatTimer);
  closeOverlay();
  const [path, qs] = (location.hash || '#/').slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  renderChrome();
  window.scrollTo(0, 0);
  if (!state.me) {
    pageLanding();
    document.title = 'Cosplaygram — мастерская косплееров';
    return;
  }
  const pages = {
    '': () => pageFeed(params), process: pageProcess, search: () => pageSearch(params), people: () => pagePeople(params),
    u: () => pageProfile(decodeURIComponent(parts[1] || '')), saved: pageSaved, settings: pageSettings,
    notifications: pageNotifications, forum: () => (parts[1] ? pageThread(parts[1]) : pageForum(params)),
    events: () => pageEvents(params), chat: () => pageChat(params), admin: pageAdmin,
  };
  const fn = pages[parts[0] || ''];
  try {
    if (fn) await fn();
    else view().innerHTML = '<div class="empty"><h2>Такой страницы нет</h2><a class="btn" href="#/">В ленту</a></div>';
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Не удалось загрузить страницу</h2><p>${esc(e.message)}</p><button class="btn" onclick="route()">Повторить</button></div>`;
  }
  const titles = { process: 'Мастерская', search: 'Поиск', people: 'Мастера', saved: 'Сохранённое', settings: 'Настройки', notifications: 'Уведомления', forum: 'Форум', events: 'Календарь', chat: 'Чат', admin: 'Модерация', u: '@' + (parts[1] || '') };
  document.title = parts[0] ? `${titles[parts[0]] || ''} — Cosplaygram` : 'Cosplaygram';
}

window.addEventListener('hashchange', route);
(async () => {
  await refreshMe();
  route();
  state.notifTimer = setInterval(async () => {
    if (!state.me || document.hidden) return;
    const before = state.unread;
    await refreshMe();
    if (state.unread > before) toast('Новое уведомление');
  }, 30000);
})();
