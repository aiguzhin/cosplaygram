// Cosplaygram — клиент (без сборки, чистый JS)
'use strict';

// ---------- утилиты ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { me: null, chatTimer: null, storyTimer: null };

async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Что-то пошло не так. Попробуйте ещё раз.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2400);
}

function ago(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'только что';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' мин';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч';
  const d = Math.floor(h / 24);
  if (d < 7) return d + ' дн';
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
const plural = (n, a, b, c) => {
  const m10 = n % 10, m100 = n % 100;
  return n + ' ' + (m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c);
};

// ---------- иконки ----------
const I = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const icons = {
  home: I('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  needle: I('<path d="M4 20 18 6"/><ellipse cx="19.5" cy="4.5" rx="1.6" ry="2.6" transform="rotate(45 19.5 4.5)"/><path d="M8 13c-3 1-4 4-2 5s5-1 6-3" stroke-dasharray="2 2.4"/>'),
  forum: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  chat: I('<path d="M4 5h16v11H9l-5 4z"/>'),
  plus: I('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>'),
  heart: I('<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 4 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4 20 4 22.4 7.3 21.2 10.7 19.5 15.4 12 20 12 20z"/>'),
  comment: I('<path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z"/>'),
  bookmark: I('<path d="M6 3.5h12v17l-6-4.2-6 4.2z"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  layers: I('<rect x="7" y="7" width="13" height="13" rx="2" fill="currentColor"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9 17h6"/>'),
  logout: I('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l-4-4 4-4M6 12h10"/>'),
  moon: I('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
};

function avatar(u, size = 36) {
  if (!u) return `<span class="avatar" style="--s:${size}px"></span>`;
  const inner = u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u.name || u.username || '?').trim()[0].toUpperCase());
  return `<span class="avatar" style="--s:${size}px;--h:${Number(u.hue) || 300}">${inner}</span>`;
}

// ---------- навигация ----------
const NAV = [
  { href: '#/', label: 'Лента', icon: 'home', match: /^#\/?$/ },
  { href: '#/explore', label: 'Поиск', icon: 'search', match: /^#\/explore/ },
  { href: '#/process', label: 'Как это сделано', icon: 'needle', match: /^#\/process/ },
  { href: '#/forum', label: 'Форум', icon: 'forum', match: /^#\/forum/ },
  { href: '#/events', label: 'Календарь', icon: 'calendar', match: /^#\/events/ },
  { href: '#/chat', label: 'Чат', icon: 'chat', match: /^#\/chat/ },
];

function renderNav() {
  const h = location.hash || '#/';
  const link = (n) =>
    `<a class="navlink ${n.match.test(h) ? 'active' : ''}" href="${n.href}" aria-label="${n.label}">${icons[n.icon]}<span class="label">${n.label}</span></a>`;
  const me = state.me;
  const create = `<button class="navlink" data-act="create" aria-label="Создать">${icons.plus}<span class="label">Создать</span></button>`;
  const profile = me
    ? `<a class="navlink ${h.startsWith('#/u/' + me.username) ? 'active' : ''}" href="#/u/${esc(me.username)}" aria-label="Профиль">${avatar(me, 24)}<span class="label">Профиль</span></a>`
    : `<button class="navlink" data-act="login" aria-label="Войти">${icons.user}<span class="label">Войти</span></button>`;

  $('#sideNav').innerHTML = NAV.map(link).join('') + create + profile;
  $('#sideFoot').innerHTML =
    `<button class="navlink" data-act="theme" aria-label="Тема">${icons.moon}<span class="label">Сменить тему</span></button>` +
    (me ? `<button class="navlink" data-act="logout" aria-label="Выйти">${icons.logout}<span class="label">Выйти</span></button>` : '');
  $('#bottomNav').innerHTML = [NAV[0], NAV[1]].map(link).join('') + create + link(NAV[3]) + profile;
  $('#topActions').innerHTML =
    `<a class="iconbtn" href="#/events" aria-label="Календарь">${icons.calendar}</a>` +
    `<a class="iconbtn" href="#/chat" aria-label="Чат">${icons.chat}</a>` +
    `<a class="iconbtn" href="#/process" aria-label="Как это сделано">${icons.needle}</a>`;
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'create') requireAuth(openCreate);
  if (act === 'login') openAuth('login');
  if (act === 'logout') logout();
  if (act === 'theme') toggleTheme();
});

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('cg-theme', root.dataset.theme); } catch {}
}
try {
  const t = localStorage.getItem('cg-theme');
  if (t) document.documentElement.dataset.theme = t;
} catch {}

// ---------- оверлей ----------
function openOverlay(html, onClose) {
  const o = $('#overlay');
  o.innerHTML = `<button class="iconbtn close" aria-label="Закрыть">${icons.close}</button>` + html;
  o.hidden = false;
  document.body.style.overflow = 'hidden';
  o.onclick = (e) => {
    if (e.target === o || e.target.closest('.close')) closeOverlay();
  };
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
  if (o._onClose) o._onClose();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeOverlay();
});

// ---------- авторизация ----------
function requireAuth(fn) {
  if (state.me) return fn();
  openAuth('register', fn);
}

function openAuth(mode = 'login', after) {
  const reg = mode === 'register';
  const o = openOverlay(`
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
      <div class="modal-body stack">
        <div>
          <div class="logo" style="font-size:1.8rem">Cosplay<span>gram</span></div>
          <p class="muted" style="margin:6px 0 0">${reg ? 'Создайте профиль косплеера: делитесь костюмами, процессом и находите помощь.' : 'С возвращением! Войдите в свой профиль.'}</p>
        </div>
        <h2 id="authTitle">${reg ? 'Регистрация' : 'Вход'}</h2>
        <form class="form" id="authForm" novalidate>
          <div class="field"><label for="au-user">Ник (латиницей)</label><input class="input" id="au-user" name="username" autocomplete="username" required placeholder="aru.cos"></div>
          ${reg ? `<div class="field"><label for="au-name">Имя</label><input class="input" id="au-name" name="name" placeholder="Аружан"></div>
          <div class="row">
            <div class="field"><label for="au-city">Город</label><input class="input" id="au-city" name="city" placeholder="Алматы"></div>
            <div class="field"><label for="au-spec">Специальность</label><input class="input" id="au-spec" name="specialty" placeholder="Броня из EVA"></div>
          </div>` : ''}
          <div class="field"><label for="au-pass">Пароль</label><input class="input" id="au-pass" type="password" name="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required placeholder="Не короче 6 символов"></div>
          <p class="error" id="authErr" hidden></p>
          <button class="btn primary" type="submit">${reg ? 'Создать профиль' : 'Войти'}</button>
        </form>
        <p class="small muted" style="margin:0;text-align:center">${reg ? 'Уже есть профиль?' : 'Нет профиля?'}
          <button class="btn ghost sm" id="authSwitch">${reg ? 'Войти' : 'Зарегистрироваться'}</button></p>
      </div>
    </div>`);
  $('#authSwitch', o).onclick = () => openAuth(reg ? 'login' : 'register', after);
  $('#authForm', o).onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const { user } = await api(reg ? '/register' : '/login', { body });
      state.me = user;
      closeOverlay();
      renderNav();
      toast(reg ? 'Профиль создан. Добро пожаловать!' : 'Вы вошли');
      renderRail();
      if (after) after();
      else route();
    } catch (err) {
      const p = $('#authErr', o);
      p.textContent = err.message;
      p.hidden = false;
    }
  };
  setTimeout(() => $('#au-user', o)?.focus(), 50);
}

async function logout() {
  await api('/logout', { method: 'POST' }).catch(() => {});
  state.me = null;
  renderNav();
  renderRail();
  toast('Вы вышли');
  route();
}

// ---------- фото: сжатие перед загрузкой ----------
function readImage(file, max = 1080) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Это не изображение'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('Не удалось открыть фото'));
    img.src = url;
  });
}

// ---------- карусель ----------
function carousel(post) {
  const n = post.slides.length;
  return `<div class="carousel" data-i="0" data-n="${n}">
    <div class="track">${post.slides
      .map(
        (s, i) => `<div class="slide"><img src="${esc(s.image)}" alt="${esc(post.character || 'Костюм')} — фото ${i + 1}" loading="lazy">${
          s.caption ? `<div class="cap">${esc(s.caption)}</div>` : ''
        }</div>`
      )
      .join('')}</div>
    ${n > 1 ? `<button class="nav prev" aria-label="Назад" hidden>‹</button><button class="nav next" aria-label="Вперёд">›</button><span class="dots num">1/${n}</span>` : ''}
    <div class="heart">${icons.heart}</div>
  </div>`;
}
function bindCarousel(root) {
  root.querySelectorAll('.carousel').forEach((c) => {
    const n = +c.dataset.n;
    const go = (d) => {
      const i = Math.max(0, Math.min(n - 1, +c.dataset.i + d));
      c.dataset.i = i;
      $('.track', c).style.transform = `translateX(-${i * 100}%)`;
      const p = $('.prev', c), nx = $('.next', c), dots = $('.dots', c);
      if (p) p.hidden = i === 0;
      if (nx) nx.hidden = i === n - 1;
      if (dots) dots.textContent = `${i + 1}/${n}`;
    };
    $('.prev', c)?.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
    $('.next', c)?.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
    let x0 = null;
    c.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    c.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      x0 = null;
    });
  });
}

// ---------- пост ----------
function postCard(p, { full = false } = {}) {
  const a = p.author || {};
  const comments = full ? p.comments : p.comments.slice(-2);
  return `<article class="card post" data-post="${p.id}">
    <div class="post-head">
      <a href="#/u/${esc(a.username)}" class="ring">${avatar(a, 34)}</a>
      <div class="who">
        <a href="#/u/${esc(a.username)}"><b>${esc(a.username)}</b></a>
        <div class="muted">${esc([a.city, p.fandom].filter(Boolean).join(' · '))}</div>
      </div>
      ${p.kind === 'process' ? '<span class="badge process">Процесс</span>' : ''}
      ${p.demo ? '<span class="badge demo" title="Пример контента для запуска">Демо</span>' : ''}
      ${state.me && state.me.id === p.authorId ? `<button class="iconbtn" data-del="${p.id}" aria-label="Удалить пост">${icons.trash}</button>` : ''}
    </div>
    ${carousel(p)}
    <div class="post-actions">
      <button class="iconbtn like ${p.liked ? 'on' : ''}" data-like="${p.id}" aria-label="Нравится" aria-pressed="${p.liked}">${icons.heart}</button>
      <button class="iconbtn" data-open="${p.id}" aria-label="Комментарии">${icons.comment}</button>
      <span class="spacer"></span>
      ${p.hours ? `<span class="small muted num" title="Часов работы">${p.hours} ч работы</span>` : ''}
    </div>
    <div class="post-body">
      <div class="likes num" data-likes="${p.id}">${plural(p.likeCount, 'отметка «нравится»', 'отметки «нравится»', 'отметок «нравится»')}</div>
      ${p.character ? `<div class="eyebrow">${esc(p.character)}</div>` : ''}
      ${p.caption ? `<div class="caption"><b>${esc(a.username)}</b>${esc(p.caption)}</div>` : ''}
      ${p.materials?.length ? `<div class="chips">${p.materials.map((m) => `<a class="chip" href="#/explore?q=${encodeURIComponent(m)}">${esc(m)}</a>`).join('')}</div>` : ''}
      ${!full && p.comments.length > 2 ? `<button class="btn ghost sm" style="align-self:flex-start;padding-left:0" data-open="${p.id}">Смотреть все комментарии (${p.comments.length})</button>` : ''}
      <div class="comments">${comments.map(commentHtml).join('')}</div>
      <div class="small muted">${ago(p.createdAt)}</div>
    </div>
    <form class="comment-form" data-comment="${p.id}">
      <input name="text" placeholder="Добавьте комментарий…" aria-label="Комментарий" maxlength="500" autocomplete="off">
      <button class="btn ghost sm" type="submit">Отправить</button>
    </form>
  </article>`;
}
const commentHtml = (c) =>
  `<div class="comment"><a href="#/u/${esc(c.author?.username)}"><b>${esc(c.author?.username)}</b></a>${esc(c.text)}</div>`;

function bindPosts(root) {
  bindCarousel(root);
  root.querySelectorAll('.carousel').forEach((c) => {
    c.addEventListener('dblclick', () => {
      const id = c.closest('[data-post]')?.dataset.post;
      if (!id) return;
      const btn = root.querySelector(`[data-like="${id}"]`);
      if (btn && !btn.classList.contains('on')) btn.click();
      const h = $('.heart', c);
      h.classList.remove('pop');
      void h.offsetWidth;
      h.classList.add('pop');
    });
  });
  root.querySelectorAll('[data-like]').forEach((b) =>
    b.addEventListener('click', () =>
      requireAuth(async () => {
        const id = b.dataset.like;
        try {
          const r = await api(`/posts/${id}/like`, { method: 'POST' });
          document.querySelectorAll(`[data-like="${id}"]`).forEach((x) => {
            x.classList.toggle('on', r.liked);
            x.setAttribute('aria-pressed', r.liked);
          });
          document.querySelectorAll(`[data-likes="${id}"]`).forEach(
            (x) => (x.textContent = plural(r.likeCount, 'отметка «нравится»', 'отметки «нравится»', 'отметок «нравится»'))
          );
        } catch (e) { toast(e.message); }
      })
    )
  );
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openPost(b.dataset.open)));
  root.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.confirm !== '1') {
        b.dataset.confirm = '1';
        toast('Нажмите ещё раз, чтобы удалить пост');
        setTimeout(() => delete b.dataset.confirm, 3000);
        return;
      }
      try {
        await api(`/posts/${b.dataset.del}`, { method: 'DELETE' });
        toast('Пост удалён');
        closeOverlay();
        route();
      } catch (e) { toast(e.message); }
    })
  );
  root.querySelectorAll('[data-comment]').forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      requireAuth(async () => {
        const input = f.elements.text;
        const text = input.value.trim();
        if (!text) return;
        try {
          const { comment } = await api(`/posts/${f.dataset.comment}/comments`, { body: { text } });
          input.value = '';
          f.closest('[data-post]').querySelector('.comments').insertAdjacentHTML('beforeend', commentHtml(comment));
        } catch (err) { toast(err.message); }
      });
    })
  );
  root.querySelectorAll('.tile[data-tile]').forEach((t) => t.addEventListener('click', () => openPost(t.dataset.tile)));
}

async function openPost(id) {
  try {
    const { post } = await api('/posts/' + id);
    const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-label="Пост">${postCard(post, { full: true })}</div>`);
    $('.post', o).style.margin = 0;
    bindPosts(o);
  } catch (e) { toast(e.message); }
}

function tile(p) {
  return `<button class="tile" data-tile="${p.id}" aria-label="${esc(p.character || 'Пост')} от ${esc(p.author?.username)}">
    <img src="${esc(p.slides[0].image)}" alt="" loading="lazy">
    ${p.slides.length > 1 ? `<span class="multi">${icons.layers}</span>` : ''}
    <span class="tile-meta"><span class="num">♥ ${p.likeCount}</span><span class="num">💬 ${p.comments.length}</span></span>
  </button>`;
}

// ---------- создание поста ----------
function openCreate(kind = 'costume') {
  const slides = [];
  const o = openOverlay(`
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="crTitle">
      <div class="modal-head"><h2 id="crTitle">Новая публикация</h2></div>
      <div class="modal-body">
        <form class="form" id="crForm" novalidate>
          <div class="tabs" role="tablist">
            <button type="button" class="tab" data-kind="costume">Костюм</button>
            <button type="button" class="tab" data-kind="process">Как я это сделал(а)</button>
            <button type="button" class="tab" data-kind="story">История на 24 ч</button>
          </div>
          <p class="small muted" id="crHint" style="margin:0"></p>
          <label class="drop" id="drop" for="crFiles">
            <b>Перетащите фото сюда или нажмите, чтобы выбрать</b>
            <span class="small">До 10 фото · JPG, PNG, WEBP</span>
          </label>
          <input type="file" id="crFiles" accept="image/*" multiple hidden>
          <div class="slides-edit" id="slidesEdit"></div>
          <div id="postFields" class="form">
            <div class="row">
              <div class="field"><label for="cr-char">Персонаж</label><input class="input" id="cr-char" name="character" placeholder="Томирис"></div>
              <div class="field"><label for="cr-fan">Фандом</label><input class="input" id="cr-fan" name="fandom" placeholder="Ориджинал, Genshin…"></div>
            </div>
            <div class="field"><label for="cr-cap">Подпись</label><textarea class="input" id="cr-cap" name="caption" placeholder="Расскажите о костюме"></textarea></div>
            <div class="row">
              <div class="field"><label for="cr-mat">Материалы через запятую</label><input class="input" id="cr-mat" name="materials" placeholder="EVA 10 мм, бархат"></div>
              <div class="field" style="flex:0 1 140px"><label for="cr-hours">Часов работы</label><input class="input num" id="cr-hours" name="hours" type="number" min="0" placeholder="40"></div>
            </div>
          </div>
          <div id="storyFields" class="field" hidden><label for="cr-st">Текст на истории</label><input class="input" id="cr-st" name="text" maxlength="120" placeholder="Крашу шлем"></div>
          <p class="error" id="crErr" hidden></p>
          <button class="btn primary" type="submit" id="crSubmit">Опубликовать</button>
        </form>
      </div>
    </div>`);
  const form = $('#crForm', o);
  const setKind = (k) => {
    kind = k;
    o.querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('active', b.dataset.kind === k));
    $('#postFields', o).hidden = k === 'story';
    $('#storyFields', o).hidden = k !== 'story';
    $('#crHint', o).textContent =
      k === 'process'
        ? 'Добавьте фото по шагам и подпишите каждый шаг: выкройка, раскрой, покраска…'
        : k === 'story'
        ? 'История исчезнет через 24 часа. Подойдёт для WIP и анонсов.'
        : 'Покажите готовый образ. Можно несколько фото.';
    renderSlides();
  };
  const renderSlides = () => {
    $('#slidesEdit', o).innerHTML = slides
      .map(
        (s, i) => `<div class="slide-edit"><img src="${s.image}" alt="Фото ${i + 1}">
        ${kind === 'process' ? `<input class="input" data-cap="${i}" value="${esc(s.caption)}" placeholder="Шаг ${i + 1}: что здесь происходит?">` : `<span class="small muted">Фото ${i + 1}</span>`}
        <button type="button" class="iconbtn" data-rm="${i}" aria-label="Убрать фото">${icons.close}</button></div>`
      )
      .join('');
    o.querySelectorAll('[data-cap]').forEach((inp) => inp.addEventListener('input', () => (slides[+inp.dataset.cap].caption = inp.value)));
    o.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { slides.splice(+b.dataset.rm, 1); renderSlides(); }));
  };
  const addFiles = async (files) => {
    for (const f of [...files].slice(0, 10 - slides.length)) {
      try { slides.push({ image: await readImage(f), caption: '' }); } catch (e) { toast(e.message); }
      if (kind === 'story') break;
    }
    renderSlides();
  };
  o.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => setKind(b.dataset.kind)));
  $('#crFiles', o).addEventListener('change', (e) => addFiles(e.target.files));
  const drop = $('#drop', o);
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#crErr', o);
    err.hidden = true;
    if (!slides.length) { err.textContent = 'Добавьте хотя бы одно фото'; err.hidden = false; return; }
    const btn = $('#crSubmit', o);
    btn.disabled = true;
    btn.textContent = 'Публикуем…';
    const fd = Object.fromEntries(new FormData(form));
    try {
      if (kind === 'story') {
        await api('/stories', { body: { image: slides[0].image, text: fd.text } });
        toast('История опубликована');
      } else {
        await api('/posts', { body: { ...fd, kind, slides } });
        toast('Опубликовано');
      }
      closeOverlay();
      const target = kind === 'process' ? '#/process' : '#/';
      if (location.hash === target || (target === '#/' && !location.hash)) route();
      else location.hash = target;
      renderRail();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Опубликовать';
    }
  };
  setKind(kind);
}

// ---------- сторис ----------
async function storiesBar() {
  const { groups } = await api('/stories');
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem('cg-seen') || '{}'); } catch {}
  state.storyGroups = groups;
  const mine = state.me
    ? `<button class="story" data-act="create-story"><span class="ring seen plus">${avatar(state.me, 62)}</span><span class="name">Ваша история</span></button>`
    : '';
  return `<div class="stories card">${mine}${groups
    .map((g, i) => {
      const last = g.items.at(-1).id;
      return `<button class="story" data-story="${i}"><span class="ring ${seen[g.author.id] === last ? 'seen' : ''}">${avatar(g.author, 62)}</span><span class="name">${esc(g.author.username)}</span></button>`;
    })
    .join('')}${!groups.length && !mine ? '<span class="muted small">Историй пока нет</span>' : ''}</div>`;
}

function openStory(gi, ii = 0) {
  const groups = state.storyGroups || [];
  const g = groups[gi];
  if (!g) return closeOverlay();
  const s = g.items[ii];
  try {
    const seen = JSON.parse(localStorage.getItem('cg-seen') || '{}');
    if (ii === g.items.length - 1) { seen[g.author.id] = s.id; localStorage.setItem('cg-seen', JSON.stringify(seen)); }
  } catch {}
  const o = openOverlay(`<div class="story-view" role="dialog" aria-modal="true" aria-label="История ${esc(g.author.username)}">
    <img src="${esc(s.image)}" alt="">
    <div class="bars">${g.items.map((_, i) => `<span class="bar"><i style="width:${i < ii ? 100 : 0}%"></i></span>`).join('')}</div>
    <div class="head">${avatar(g.author, 32)}<b>${esc(g.author.username)}</b><span class="small" style="opacity:.8">${ago(s.createdAt)}</span></div>
    ${s.text ? `<div class="txt">${esc(s.text)}</div>` : ''}
    <button class="zone l" aria-label="Назад"></button><button class="zone r" aria-label="Дальше"></button>
  </div>`, () => { if (location.hash === '#/' || location.hash === '') softRefreshStories(); });
  const next = () => (ii + 1 < g.items.length ? openStory(gi, ii + 1) : gi + 1 < groups.length ? openStory(gi + 1) : closeOverlay());
  const prev = () => (ii > 0 ? openStory(gi, ii - 1) : gi > 0 ? openStory(gi - 1) : null);
  $('.zone.r', o).onclick = next;
  $('.zone.l', o).onclick = prev;
  const bar = o.querySelectorAll('.bar i')[ii];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => {
    if (!reduce) bar.style.transition = 'width 5s linear';
    bar.style.width = '100%';
  });
  clearTimeout(state.storyTimer);
  state.storyTimer = setTimeout(next, 5000);
}
async function softRefreshStories() {
  const el = $('.stories');
  if (el) { el.outerHTML = await storiesBar(); bindStories(); }
}
function bindStories() {
  document.querySelectorAll('[data-story]').forEach((b) => b.addEventListener('click', () => openStory(+b.dataset.story)));
  document.querySelector('[data-act="create-story"]')?.addEventListener('click', (e) => { e.stopPropagation(); openCreate('story'); });
}

// ---------- страницы ----------
const view = () => $('#view');

async function pageFeed() {
  view().innerHTML = '<div class="skeleton"></div>';
  const [bar, { posts }] = await Promise.all([storiesBar(), api('/feed')]);
  view().innerHTML =
    bar +
    (state.me
      ? ''
      : `<div class="card pad" style="margin-bottom:18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
          <div style="flex:1 1 240px"><h2>Платформа косплееров Казахстана</h2><p class="muted" style="margin:6px 0 0">Выкладывайте костюмы и процесс, ищите материалы и мастеров, следите за конкурсами.</p></div>
          <button class="btn primary" data-act="login-reg">Присоединиться</button></div>`) +
    (posts.length ? posts.map((p) => postCard(p)).join('') : `<div class="empty"><h2>Лента пуста</h2><p>Будьте первым, кто покажет костюм.</p></div>`);
  bindStories();
  bindPosts(view());
  $('[data-act="login-reg"]')?.addEventListener('click', (e) => { e.stopPropagation(); openAuth('register'); });
}

async function pageExplore(params) {
  const q = params.get('q') || '';
  view().innerHTML = `<div class="page-head"><div><h1>Поиск</h1><p class="muted">Костюмы, материалы, мастера и города</p></div></div>
    <form id="sForm" style="margin-bottom:12px"><input class="input" id="sq" name="q" type="search" value="${esc(q)}" placeholder="Например: EVA, парики, Алматы, Genshin" aria-label="Поиск"></form>
    <div class="chips" style="margin-bottom:18px">${['EVA', 'worbla', 'парик', 'вышивка', '3D-печать', 'Алматы', 'Астана', 'Genshin']
      .map((t) => `<a class="chip ${t.toLowerCase() === q.toLowerCase() ? 'active' : ''}" href="#/explore?q=${encodeURIComponent(t)}">${t}</a>`)
      .join('')}</div>
    <div id="sRes"><div class="skeleton" style="height:300px"></div></div>`;
  $('#sForm').onsubmit = (e) => {
    e.preventDefault();
    location.hash = '#/explore?q=' + encodeURIComponent($('#sq').value.trim());
  };
  let users, posts;
  if (q) ({ users, posts } = await api('/search?q=' + encodeURIComponent(q)));
  else {
    [{ users }, { posts }] = await Promise.all([api('/users'), api('/feed')]);
  }
  $('#sRes').innerHTML =
    (users.length
      ? `<h2 style="margin-bottom:8px">${q ? 'Мастера' : 'Косплееры'}</h2><div class="card pad" style="margin-bottom:20px;padding-block:8px">${users
          .slice(0, 8)
          .map(
            (u) => `<a class="who-row" href="#/u/${esc(u.username)}">${avatar(u, 40)}<span class="t"><b>${esc(u.username)}</b><span>${esc([u.specialty, u.city].filter(Boolean).join(' · '))}</span></span></a>`
          )
          .join('')}</div>`
      : '') +
    (posts.length
      ? `<h2 style="margin-bottom:8px">Публикации</h2><div class="grid">${posts.map(tile).join('')}</div>`
      : `<div class="empty"><h2>Ничего не нашлось</h2><p>Попробуйте другое слово: материал, персонажа или город.</p></div>`);
  bindPosts(view());
}

async function pageProcess() {
  view().innerHTML = '<div class="skeleton"></div>';
  const { posts } = await api('/feed?kind=process');
  view().innerHTML = `<div class="page-head"><div><h1>Как это сделано</h1><p class="muted">Пошаговые фото: от выкройки до готового костюма</p></div>
    <button class="btn primary" id="newProc">Показать свой процесс</button></div>
    ${posts.length ? posts.map((p) => postCard(p)).join('') : '<div class="empty"><h2>Пока нет пошаговых постов</h2><p>Покажите, как вы шили свой костюм.</p></div>'}`;
  $('#newProc').onclick = () => requireAuth(() => openCreate('process'));
  bindPosts(view());
}

async function pageProfile(username) {
  view().innerHTML = '<div class="skeleton" style="height:300px"></div>';
  let data;
  try { data = await api('/users/' + encodeURIComponent(username)); }
  catch { view().innerHTML = '<div class="empty"><h2>Косплеер не найден</h2><p><a href="#/explore" class="btn">Найти косплееров</a></p></div>'; return; }
  const { user: u, posts, stats } = data;
  const mine = state.me && state.me.id === u.id;
  const tabsHtml = `<div class="tabs" role="tablist">
      <button class="tab active" data-f="all">Все</button>
      <button class="tab" data-f="costume">Костюмы</button>
      <button class="tab" data-f="process">Процесс</button></div>`;
  view().innerHTML = `<section class="profile">
      <span class="ring">${avatar(u, 120)}</span>
      <div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><h1 style="font-size:1.3rem">${esc(u.username)}</h1>
          ${mine ? '<button class="btn sm" id="editProfile">Редактировать профиль</button>' : ''}
          ${u.demo ? '<span class="badge demo">Демо-профиль</span>' : ''}</div>
        <div class="stats"><span><b>${stats.posts}</b> ${plural(stats.posts, 'публикация', 'публикации', 'публикаций').replace(/^\d+ /, '')}</span><span><b>${stats.likes}</b> отметок</span></div>
        <div><b>${esc(u.name)}</b></div>
        ${u.specialty ? `<div class="eyebrow" style="margin:4px 0">${esc(u.specialty)}</div>` : ''}
        ${u.city ? `<div class="small muted">${esc(u.city)}</div>` : ''}
        ${u.bio ? `<p class="bio" style="margin:8px 0 0">${esc(u.bio)}</p>` : ''}
      </div>
    </section>
    ${tabsHtml}
    <div class="grid" id="pGrid">${posts.map(tile).join('')}</div>
    ${posts.length ? '' : `<div class="empty"><h2>${mine ? 'Покажите первый костюм' : 'Пока нет публикаций'}</h2>${mine ? '<button class="btn primary" data-act="create">Опубликовать</button>' : ''}</div>`}`;
  view().querySelectorAll('.tab[data-f]').forEach((t) =>
    t.addEventListener('click', () => {
      view().querySelectorAll('.tab[data-f]').forEach((x) => x.classList.toggle('active', x === t));
      const f = t.dataset.f;
      $('#pGrid').innerHTML = posts.filter((p) => f === 'all' || p.kind === f).map(tile).join('');
      bindPosts($('#pGrid'));
    })
  );
  bindPosts(view());
  $('#editProfile')?.addEventListener('click', () => openEditProfile(u));
}

function openEditProfile(u) {
  let newAvatar = null;
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="epTitle">
    <div class="modal-head"><h2 id="epTitle">Профиль</h2></div>
    <div class="modal-body"><form class="form" id="epForm">
      <div style="display:flex;gap:14px;align-items:center"><span id="epAv">${avatar(u, 72)}</span>
        <label class="btn sm" for="epFile">Сменить фото</label><input type="file" id="epFile" accept="image/*" hidden></div>
      <div class="field"><label for="ep-name">Имя</label><input class="input" id="ep-name" name="name" value="${esc(u.name)}"></div>
      <div class="row">
        <div class="field"><label for="ep-city">Город</label><input class="input" id="ep-city" name="city" value="${esc(u.city)}"></div>
        <div class="field"><label for="ep-spec">Специальность</label><input class="input" id="ep-spec" name="specialty" value="${esc(u.specialty)}" placeholder="Броня, парики, шитьё…"></div>
      </div>
      <div class="field"><label for="ep-bio">О себе</label><textarea class="input" id="ep-bio" name="bio" maxlength="300">${esc(u.bio)}</textarea></div>
      <button class="btn primary" type="submit">Сохранить</button>
    </form></div></div>`);
  $('#epFile', o).onchange = async (e) => {
    try {
      newAvatar = await readImage(e.target.files[0], 400);
      $('#epAv', o).innerHTML = `<span class="avatar" style="--s:72px"><img src="${newAvatar}" alt=""></span>`;
    } catch (err) { toast(err.message); }
  };
  $('#epForm', o).onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (newAvatar) body.avatar = newAvatar;
    try {
      const { user } = await api('/me', { method: 'PATCH', body });
      state.me = user;
      closeOverlay();
      renderNav();
      toast('Профиль сохранён');
      route();
    } catch (err) { toast(err.message); }
  };
}

const CATS = { materials: 'Ищу материалы', sewing: 'Помощь с пошивом', props: 'Реквизит и броня', wigs: 'Парики и грим', photo: 'Фотосъёмка', other: 'Другое' };

async function pageForum(params) {
  const cat = params.get('c') || '';
  view().innerHTML = '<div class="skeleton" style="height:300px"></div>';
  const { threads } = await api('/forum');
  const list = cat ? threads.filter((t) => t.category === cat) : threads;
  view().innerHTML = `<div class="page-head"><div><h1>Форум</h1><p class="muted">Ищите материалы, мастеров и помощь с пошивом</p></div>
      <button class="btn primary" id="newThread">Новая тема</button></div>
    <div class="chips" style="margin-bottom:14px"><a class="chip ${!cat ? 'active' : ''}" href="#/forum">Все темы</a>${Object.entries(CATS)
      .map(([k, v]) => `<a class="chip ${cat === k ? 'active' : ''}" href="#/forum?c=${k}">${v}</a>`)
      .join('')}</div>
    <div class="card">${
      list.length
        ? list
            .map(
              (t) => `<a class="thread" href="#/forum/${t.id}">${avatar(t.author, 38)}
          <div style="min-width:0"><div class="eyebrow">${CATS[t.category]}${t.city ? ' · ' + esc(t.city) : ''}</div><h3>${esc(t.title)}</h3>
          <div class="small muted">${esc(t.author?.username)} · ${ago(t.lastAt)}</div></div>
          <div class="count"><b>${t.replyCount}</b><span class="small muted">ответ.</span></div></a>`
            )
            .join('')
        : '<div class="empty"><p>В этой категории пока нет тем.</p></div>'
    }</div>`;
  $('#newThread').onclick = () => requireAuth(openNewThread);
}

function openNewThread() {
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="ntTitle">
    <div class="modal-head"><h2 id="ntTitle">Новая тема</h2></div>
    <div class="modal-body"><form class="form" id="ntForm">
      <div class="row">
        <div class="field"><label for="nt-cat">Раздел</label><select class="input" id="nt-cat" name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div class="field"><label for="nt-city">Город (необязательно)</label><input class="input" id="nt-city" name="city" value="${esc(state.me?.city || '')}"></div>
      </div>
      <div class="field"><label for="nt-title">Заголовок</label><input class="input" id="nt-title" name="title" required placeholder="Где купить worbla в Астане?"></div>
      <div class="field"><label for="nt-body">Текст</label><textarea class="input" id="nt-body" name="body" required placeholder="Опишите, что ищете или с чем нужна помощь"></textarea></div>
      <p class="error" id="ntErr" hidden></p>
      <button class="btn primary" type="submit">Создать тему</button>
    </form></div></div>`);
  $('#ntForm', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      const { thread } = await api('/forum', { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay();
      location.hash = '#/forum/' + thread.id;
    } catch (err) { const p = $('#ntErr', o); p.textContent = err.message; p.hidden = false; }
  };
}

async function pageThread(id) {
  let t;
  try { ({ thread: t } = await api('/forum/' + id)); }
  catch { view().innerHTML = '<div class="empty"><h2>Тема не найдена</h2><a class="btn" href="#/forum">К форуму</a></div>'; return; }
  view().innerHTML = `<a href="#/forum" class="btn ghost sm" style="margin-bottom:10px;padding-left:0">← Все темы</a>
    <article class="card pad">
      <div class="eyebrow">${CATS[t.category]}${t.city ? ' · ' + esc(t.city) : ''}</div>
      <h1 style="margin:6px 0 12px">${esc(t.title)}</h1>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">${avatar(t.author, 32)}<a href="#/u/${esc(t.author?.username)}"><b>${esc(t.author?.username)}</b></a><span class="small muted">${ago(t.createdAt)}</span></div>
      <p style="white-space:pre-wrap;margin:0 0 8px;max-width:65ch">${esc(t.body)}</p>
      <div id="replies">${t.replies
        .map((r) => `<div class="reply">${avatar(r.author, 32)}<div><a href="#/u/${esc(r.author?.username)}"><b>${esc(r.author?.username)}</b></a> <span class="small muted">${ago(r.createdAt)}</span><p>${esc(r.text)}</p></div></div>`)
        .join('')}</div>
      <form class="form" id="rpForm" style="margin-top:14px"><label class="eyebrow" for="rp-text">Ваш ответ</label>
        <textarea class="input" id="rp-text" name="text" placeholder="Подскажите, где найти, или предложите помощь"></textarea>
        <button class="btn primary" style="align-self:flex-start">Ответить</button></form>
    </article>`;
  $('#rpForm').onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      try {
        await api(`/forum/${id}/replies`, { body: { text: $('#rp-text').value } });
        pageThread(id);
      } catch (err) { toast(err.message); }
    });
  };
}

const TYPES = { contest: 'Конкурс', festival: 'Фестиваль', meetup: 'Встреча' };
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

async function pageEvents(params) {
  const city = params.get('city') || '';
  const { events } = await api('/events');
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.date >= today && (!city || e.city === city));
  const cities = [...new Set(events.map((e) => e.city).filter(Boolean))];
  view().innerHTML = `<div class="page-head"><div><h1>Календарь</h1><p class="muted">Конкурсы, фестивали и встречи в городах Казахстана</p></div>
      <button class="btn primary" id="newEvent">Добавить событие</button></div>
    <div class="chips" style="margin-bottom:14px"><a class="chip ${!city ? 'active' : ''}" href="#/events">Все города</a>${cities
      .map((c) => `<a class="chip ${city === c ? 'active' : ''}" href="#/events?city=${encodeURIComponent(c)}">${esc(c)}</a>`)
      .join('')}</div>
    <div class="card">${
      upcoming.length
        ? upcoming
            .map((e) => {
              const [y, m, d] = e.date.split('-');
              return `<div class="event"><div class="datebox"><b>${+d}</b><span>${MONTHS[+m - 1]}</span></div>
              <div style="min-width:0"><div class="etype ${e.type}">${TYPES[e.type]}</div><h3 style="font-family:var(--font-body);font-weight:800">${esc(e.title)}</h3>
              <div class="small muted">${esc([e.city, e.place].filter(Boolean).join(' · '))}</div>
              ${e.note ? `<div class="small" style="margin-top:4px">${esc(e.note)}</div>` : ''}
              ${e.link ? `<a class="small" style="color:var(--accent);font-weight:700" href="${esc(e.link)}" target="_blank" rel="noopener">Страница события →</a>` : ''}
              ${e.demo ? '<span class="badge demo" style="margin-top:6px">Пример</span>' : ''}</div></div>`;
            })
            .join('')
        : '<div class="empty"><p>Ближайших событий нет. Добавьте первое!</p></div>'
    }</div>`;
  $('#newEvent').onclick = () => requireAuth(openNewEvent);
}

function openNewEvent() {
  const o = openOverlay(`<div class="modal" role="dialog" aria-modal="true" aria-labelledby="neTitle">
    <div class="modal-head"><h2 id="neTitle">Новое событие</h2></div>
    <div class="modal-body"><form class="form" id="neForm">
      <div class="field"><label for="ne-title">Название</label><input class="input" id="ne-title" name="title" required></div>
      <div class="row">
        <div class="field"><label for="ne-date">Дата</label><input class="input" id="ne-date" type="date" name="date" required></div>
        <div class="field"><label for="ne-type">Тип</label><select class="input" id="ne-type" name="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      </div>
      <div class="row">
        <div class="field"><label for="ne-city">Город</label><input class="input" id="ne-city" name="city" value="${esc(state.me?.city || '')}"></div>
        <div class="field"><label for="ne-place">Место</label><input class="input" id="ne-place" name="place"></div>
      </div>
      <div class="field"><label for="ne-link">Ссылка на организатора</label><input class="input" id="ne-link" name="link" type="url" placeholder="https://"></div>
      <div class="field"><label for="ne-note">Описание</label><input class="input" id="ne-note" name="note" maxlength="300"></div>
      <p class="error" id="neErr" hidden></p>
      <button class="btn primary" type="submit">Добавить</button>
    </form></div></div>`);
  $('#neForm', o).onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/events', { body: Object.fromEntries(new FormData(e.target)) });
      closeOverlay();
      toast('Событие добавлено');
      route();
    } catch (err) { const p = $('#neErr', o); p.textContent = err.message; p.hidden = false; }
  };
}

const ROOMS = { general: 'Общий', almaty: 'Алматы', astana: 'Астана', shymkent: 'Шымкент', aktobe: 'Актобе', help: 'Срочная помощь' };

async function pageChat(params) {
  const room = ROOMS[params.get('r')] ? params.get('r') : 'general';
  view().innerHTML = `<div class="card chat">
    <nav class="rooms" aria-label="Комнаты">${Object.entries(ROOMS)
      .map(([k, v]) => `<a class="room ${k === room ? 'active' : ''}" href="#/chat?r=${k}"># ${v}</a>`)
      .join('')}</nav>
    <section class="msgs"><div class="msg-list" id="msgList" aria-live="polite"></div>
      <form class="msg-form" id="msgForm"><input class="input" id="msgText" autocomplete="off" maxlength="1000" placeholder="${state.me ? 'Сообщение в #' + ROOMS[room] : 'Войдите, чтобы писать в чат'}" aria-label="Сообщение">
      <button class="btn primary">Отправить</button></form></section></div>`;
  let last = 0;
  const list = $('#msgList');
  const add = (msgs) => {
    if (!msgs.length) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.insertAdjacentHTML(
      'beforeend',
      msgs
        .filter((m) => m.createdAt > last)
        .map(
          (m) => `<div class="msg ${state.me && m.authorId === state.me.id ? 'mine' : ''}">${avatar(m.author, 28)}
          <div class="bubble"><div class="who">${esc(m.author?.username)}</div>${esc(m.text)}</div></div>`
        )
        .join('')
    );
    last = Math.max(last, ...msgs.map((m) => m.createdAt));
    if (atBottom || !list.dataset.init) list.scrollTop = list.scrollHeight;
    list.dataset.init = 1;
  };
  const poll = async () => {
    try { add((await api(`/chat/${room}?after=${last}`)).messages); } catch {}
  };
  await poll();
  if (!last) list.innerHTML = '<div class="empty"><p>Здесь пока тихо. Начните разговор!</p></div>';
  clearInterval(state.chatTimer);
  state.chatTimer = setInterval(poll, 3000);
  $('#msgForm').onsubmit = (e) => {
    e.preventDefault();
    requireAuth(async () => {
      const inp = $('#msgText');
      const text = inp.value.trim();
      if (!text) return;
      try {
        if (!last) list.innerHTML = '';
        const { message } = await api(`/chat/${room}`, { body: { text } });
        inp.value = '';
        add([message]);
        list.scrollTop = list.scrollHeight;
      } catch (err) { toast(err.message); }
    });
  };
}

// ---------- правая колонка ----------
async function renderRail() {
  try {
    const [{ month, top }, { events }, { users }] = await Promise.all([api('/contest'), api('/events'), api('/users')]);
    const today = new Date().toISOString().slice(0, 10);
    const next = events.filter((e) => e.date >= today).slice(0, 4);
    $('#rail').innerHTML = `
      ${state.me ? `<a class="who-row" href="#/u/${esc(state.me.username)}">${avatar(state.me, 44)}<span class="t"><b>${esc(state.me.username)}</b><span>${esc(state.me.name)}</span></span></a>` : ''}
      <section class="card rail-card"><div class="eyebrow" style="display:flex;gap:6px;align-items:center;color:var(--gold)">${icons.trophy.replace('<svg', '<svg width="16" height="16"')} Конкурс месяца</div>
        <h2 style="margin:4px 0 10px;text-transform:capitalize">${esc(month)}</h2>
        ${top
          .map(
            (p, i) => `<button class="contest-row" data-tile="${p.id}"><span class="place num">${i + 1}</span><img src="${esc(p.slides[0].image)}" alt="">
            <span class="t"><b>${esc(p.character || 'Костюм')}</b><span>${esc(p.author?.username)}</span></span><span class="small num muted">♥ ${p.likeCount}</span></button>`
          )
          .join('')}
        <p class="small muted" style="margin:8px 0 0">Рейтинг по отметкам «нравится» за месяц</p></section>
      <section class="card rail-card"><h2>Ближайшие события</h2>${next
        .map((e) => { const [, m, d] = e.date.split('-'); return `<a class="rail-event" href="#/events"><b>${+d} ${MONTHS[+m - 1]}</b><span>${esc(e.title)}<br><span class="muted small">${esc(e.city)}</span></span></a>`; })
        .join('') || '<p class="small muted">Пока пусто</p>'}</section>
      <section class="card rail-card"><h2>Косплееры</h2>${users
        .filter((u) => !state.me || u.id !== state.me.id)
        .slice(0, 5)
        .map((u) => `<a class="who-row" href="#/u/${esc(u.username)}">${avatar(u, 34)}<span class="t"><b>${esc(u.username)}</b><span>${esc(u.specialty || u.city)}</span></span></a>`)
        .join('')}</section>
      <p class="small muted" style="padding:0 4px">Cosplaygram · платформа косплееров Казахстана и Центральной Азии</p>`;
    $('#rail').querySelectorAll('[data-tile]').forEach((b) => b.addEventListener('click', () => openPost(b.dataset.tile)));
  } catch {}
}

// ---------- роутер ----------
async function route() {
  clearInterval(state.chatTimer);
  closeOverlay();
  const hash = location.hash || '#/';
  const [path, qs] = hash.slice(1).split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  renderNav();
  window.scrollTo(0, 0);
  try {
    if (!parts.length) await pageFeed();
    else if (parts[0] === 'explore') await pageExplore(params);
    else if (parts[0] === 'process') await pageProcess();
    else if (parts[0] === 'u') await pageProfile(decodeURIComponent(parts[1] || ''));
    else if (parts[0] === 'forum' && parts[1]) await pageThread(parts[1]);
    else if (parts[0] === 'forum') await pageForum(params);
    else if (parts[0] === 'events') await pageEvents(params);
    else if (parts[0] === 'chat') await pageChat(params);
    else view().innerHTML = '<div class="empty"><h2>Страница не найдена</h2><a class="btn" href="#/">В ленту</a></div>';
  } catch (e) {
    view().innerHTML = `<div class="empty"><h2>Не удалось загрузить</h2><p>${esc(e.message)}</p><button class="btn" onclick="route()">Повторить</button></div>`;
  }
  const titles = { explore: 'Поиск', process: 'Как это сделано', forum: 'Форум', events: 'Календарь', chat: 'Чат', u: parts[1] };
  document.title = parts.length ? `${titles[parts[0]] || ''} · Cosplaygram` : 'Cosplaygram';
}

window.addEventListener('hashchange', route);
(async () => {
  try { state.me = (await api('/me')).user; } catch {}
  renderNav();
  route();
  renderRail();
})();
