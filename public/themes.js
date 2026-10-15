// Cosplaygram — темы по персонажам.
// Порядок внутри раздела — по популярности у косплееров: рейтинг Spacomic «кого хотят косплеить» 2025
// и постоянные фавориты конвентов. На сайте сортировка дополнительно учитывает, сколько косплеев
// персонажа уже опубликовано в Cosplaygram.
// Официальные изображения персонажей не используем (авторские права): на карточке — фото косплея
// от участников или обложка, загруженная модератором; без фото — эмблема в цветах персонажа.
(function () {
  'use strict';

  const CATS = { anime: 'Аниме', manga: 'Манга', drama: 'Дорамы', film: 'Фильмы и сериалы', game: 'Игры' };

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  function mix(a, b, k) {
    const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
    const c = (s) => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
    return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1);
  }
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

  // Компактное описание: остальное считается автоматически (поверхности, текст, контраст кнопок).
  function T(id, name, from, cat, mode, bg, accent, accent2, font, pattern) {
    const dark = mode === 'dark';
    const ink = dark ? mix('#FFFFFF', accent, 0.06) : mix('#14141F', accent, 0.08);
    const surface = dark ? mix(bg, '#FFFFFF', 0.05) : '#FFFFFF';
    const muted = mix(bg, ink, dark ? 0.62 : 0.6);
    // на светлых темах акцент должен читаться как текст: затемняем, пока контраст не станет ≥ 3.6
    let acc = accent;
    if (!dark) for (let i = 0; i < 12 && contrast(acc, bg) < 3.6; i++) acc = mix(acc, '#000000', 0.08);
    const onAccent = contrast(acc, '#FFFFFF') >= 3.2 ? '#FFFFFF' : mix('#000000', acc, 0.18);
    return { id, name, from, cat, mode, bg, surface, ink, muted, accent: acc, onAccent, accent2, font, pattern };
  }

  const THEMES = [
    T('classic', 'Классика Cosplaygram', 'Золотая нить на тёмной сцене', '', 'dark', '#0D0E1C', '#F2B33D', '#8C9BFF', 'Yeseva One', 'stitch'),
    T('classic-light', 'Классика, светлая', 'Мастерская при дневном свете', '', 'light', '#F4F3F8', '#A86B00', '#3646C9', 'Yeseva One', 'stitch'),

    // ---------- Аниме ----------
    T('chuya', 'Тюя Накахара', 'Великий из бродячих псов', 'anime', 'dark', '#120D0E', '#E2672E', '#8E1F2F', 'Cormorant Garamond', 'stripes'),
    T('gojo', 'Сатору Годжо', 'Магическая битва', 'anime', 'dark', '#0A0C12', '#5CC8FF', '#E8ECF5', 'Unbounded', 'dots'),
    T('miku', 'Хацунэ Мику', 'Vocaloid', 'anime', 'dark', '#0B1416', '#39C5BB', '#E12885', 'Unbounded', 'grid'),
    T('dazai', 'Осаму Дадзай', 'Великий из бродячих псов', 'anime', 'light', '#F5F1EA', '#9C7A4A', '#3B3B46', 'Cormorant Garamond', 'stripes'),
    T('maomao', 'Маомао', 'Монолог фармацевта', 'anime', 'light', '#F4F4EC', '#4F7F55', '#8E6BAE', 'Cormorant Garamond', 'diamond'),
    T('shinobu', 'Шинобу Кочо', 'Клинок, рассекающий демонов', 'anime', 'dark', '#130F1A', '#B98AF0', '#4FB39A', 'Yeseva One', 'diamond'),
    T('nezuko', 'Нэдзуко Камадо', 'Клинок, рассекающий демонов', 'anime', 'dark', '#15101A', '#F28AB2', '#86B86F', 'Yeseva One', 'diamond'),
    T('marin', 'Марин Китагава', 'Эта фарфоровая кукла влюбилась', 'anime', 'light', '#FFF6F9', '#E0508F', '#E9B530', 'Comfortaa', 'check'),
    T('frieren', 'Фрирен', 'Провожающая в последний путь Фрирен', 'anime', 'light', '#F5F7F2', '#2F7F6F', '#B8921E', 'Cormorant Garamond', 'stars'),
    T('hanako', 'Ханако-кун', 'Туалетный мальчик Ханако-кун', 'anime', 'dark', '#0F0E14', '#EBC04A', '#C23B3B', 'Comfortaa', 'waves'),
    T('levi', 'Леви Аккерман', 'Атака титанов', 'anime', 'dark', '#0F110D', '#9BAE6A', '#8B5E3C', 'Unbounded', 'stripes'),
    T('historia', 'Хистория Рейсс', 'Атака титанов', 'anime', 'light', '#F6F5EF', '#6C7F45', '#C9A74A', 'Cormorant Garamond', 'stars'),
    T('makima', 'Макима', 'Человек-бензопила', 'anime', 'dark', '#140D0D', '#D9534F', '#E8D9A8', 'Cormorant Garamond', 'rings'),
    T('yor', 'Йор Форджер', 'Семья шпиона', 'anime', 'dark', '#0E0B0D', '#C8364E', '#D7B56D', 'Yeseva One', 'diamond'),
    T('anya', 'Аня Форджер', 'Семья шпиона', 'anime', 'light', '#FFF6F8', '#CF4A78', '#2B2024', 'Comfortaa', 'dots'),
    T('rem', 'Рем', 'Re:Zero', 'anime', 'light', '#F4F7FD', '#4F7FD0', '#2B2B3A', 'Comfortaa', 'check'),
    T('zerotwo', 'Зеро Ту', 'Милый во Франксе', 'anime', 'dark', '#130C12', '#F0587F', '#EAD8C0', 'Unbounded', 'grid'),
    T('usagi', 'Усаги Цукино', 'Сейлор Мун', 'anime', 'light', '#FFF5F8', '#D63A72', '#2A3A9A', 'Comfortaa', 'stars'),
    T('chihiro', 'Тихиро Огино', 'Унесённые призраками', 'anime', 'dark', '#10161C', '#E05A55', '#3FA7A0', 'Yeseva One', 'waves'),

    // ---------- Манга ----------
    T('kagura', 'Кагура', 'Гинтама', 'manga', 'light', '#FFF6F2', '#D9333F', '#F28C38', 'Comfortaa', 'check'),
    T('gintoki', 'Гинтоки Саката', 'Гинтама', 'manga', 'light', '#F3F5F9', '#3E6FB0', '#9AA3AE', 'Unbounded', 'waves'),
    T('katsura', 'Котаро Кацура', 'Гинтама', 'manga', 'dark', '#0E1210', '#6FB58A', '#E7E2D6', 'Cormorant Garamond', 'stripes'),
    T('luffy', 'Монки Д. Луффи', 'Ван-Пис', 'manga', 'light', '#FFF9EE', '#D7263D', '#D9A520', 'Unbounded', 'stripes'),
    T('naruto', 'Наруто Узумаки', 'Наруто', 'manga', 'dark', '#121521', '#FF8A1F', '#F2D04A', 'Unbounded', 'dots'),
    T('guts', 'Гатс', 'Берсерк', 'manga', 'dark', '#0B0B0C', '#C8323A', '#8A8F98', 'Cormorant Garamond', 'stripes'),
    T('edward', 'Эдвард Элрик', 'Стальной алхимик', 'manga', 'dark', '#120F0D', '#D6413A', '#E3B23C', 'Unbounded', 'rings'),
    T('lawliet', 'Эл', 'Тетрадь смерти', 'manga', 'light', '#F5F5F3', '#2A2A2A', '#8B8B8B', 'JetBrains Mono', 'grid'),
    T('nana', 'Нана Осаки', 'Нана', 'manga', 'dark', '#0E0C0E', '#E8335A', '#C0C0C8', 'Unbounded', 'check'),
    T('vermouth', 'Вермут', 'Детектив Конан', 'manga', 'dark', '#0D0D10', '#D9B76B', '#6B2B3A', 'Cormorant Garamond', 'stars'),

    // ---------- Дорамы ----------
    T('gihun', 'Сон Ки-хун', 'Игра в кальмара', 'drama', 'dark', '#0B1414', '#F0397A', '#2BB39B', 'Unbounded', 'grid'),
    T('wei', 'Вэй Усянь', 'Неукротимый: Повелитель Чэньцин', 'drama', 'dark', '#0F0B0B', '#D23C46', '#E2C17C', 'Cormorant Garamond', 'waves'),
    T('lan', 'Лань Ванцзи', 'Неукротимый: Повелитель Чэньцин', 'drama', 'light', '#F4F8FA', '#36698F', '#A9BFCF', 'Cormorant Garamond', 'waves'),
    T('dongfang', 'Дунфан Цинцан', 'Любовь между феей и дьяволом', 'drama', 'dark', '#0E0B14', '#9B6BF0', '#D9C38A', 'Cormorant Garamond', 'stars'),
    T('kimshin', 'Ким Шин', 'Токкэби', 'drama', 'dark', '#111014', '#D1AB61', '#B23A48', 'Yeseva One', 'stars'),
    T('haein', 'Хон Хэ-ин', 'Королева слёз', 'drama', 'light', '#F8F5F1', '#9A6A4C', '#2F3B4C', 'Cormorant Garamond', 'diamond'),
    T('seri', 'Юн Се-ри', 'Аварийная посадка любви', 'drama', 'light', '#FBF6F3', '#C9614F', '#4E6A86', 'Yeseva One', 'dots'),
    T('donguen', 'Мун Дон-ын', 'Слава', 'drama', 'dark', '#0C0D10', '#8FA3B5', '#B33A3A', 'Unbounded', 'grid'),

    // ---------- Фильмы и сериалы ----------
    T('wednesday', 'Уэнсдэй Аддамс', 'Уэнсдэй', 'film', 'dark', '#0B0B0D', '#CFC8EA', '#6B4E9B', 'Cormorant Garamond', 'check'),
    T('harry', 'Гарри Поттер', 'Гарри Поттер', 'film', 'dark', '#160D0F', '#D9A441', '#A0283A', 'Cormorant Garamond', 'stars'),
    T('miles', 'Майлз Моралес', 'Человек-паук: Через вселенные', 'film', 'dark', '#0B0B10', '#E8384F', '#3A7BFF', 'Unbounded', 'dots'),
    T('elsa', 'Эльза', 'Холодное сердце', 'film', 'light', '#F1F7FC', '#2373AE', '#7CC6EE', 'Cormorant Garamond', 'stars'),
    T('neo', 'Нео', 'Матрица', 'film', 'dark', '#050806', '#3BFF6E', '#1C8C3C', 'JetBrains Mono', 'rain'),
    T('paul', 'Пол Атрейдес', 'Дюна', 'film', 'dark', '#17120D', '#E39B3B', '#5A8FC2', 'Unbounded', 'waves'),
    T('barbie', 'Барби', 'Барби', 'film', 'light', '#FFF2F8', '#D81B80', '#F49AC6', 'Comfortaa', 'check'),
    T('vader', 'Дарт Вейдер', 'Звёздные войны', 'film', 'dark', '#070708', '#E5243B', '#5A5A66', 'Unbounded', 'grid'),
    T('jack', 'Джек Воробей', 'Пираты Карибского моря', 'film', 'dark', '#120E0A', '#C98B4A', '#3E6B6B', 'Cormorant Garamond', 'waves'),
    T('gandalf', 'Гэндальф', 'Властелин колец', 'film', 'light', '#F4F1E8', '#6E6150', '#9AA3A8', 'Cormorant Garamond', 'rings'),
    T('mulan', 'Мулан', 'Мулан', 'film', 'light', '#FFF8F1', '#C2362F', '#2E5E8C', 'Yeseva One', 'waves'),

    // ---------- Игры ----------
    T('wanderer', 'Странник', 'Genshin Impact', 'game', 'dark', '#0B0E16', '#7C93E0', '#A9C7E8', 'Cormorant Garamond', 'waves'),
    T('raiden', 'Райдэн Сёгун', 'Genshin Impact', 'game', 'dark', '#100C18', '#A57BE6', '#E3B3D6', 'Yeseva One', 'diamond'),
    T('hutao', 'Ху Тао', 'Genshin Impact', 'game', 'dark', '#130D0C', '#D9534A', '#E9B44C', 'Comfortaa', 'dots'),
    T('kafka', 'Кафка', 'Honkai: Star Rail', 'game', 'dark', '#120B10', '#D0466F', '#7D5BB8', 'Cormorant Garamond', 'grid'),
    T('acheron', 'Ахерон', 'Honkai: Star Rail', 'game', 'dark', '#0E0A12', '#B067D9', '#D23C4F', 'Yeseva One', 'rain'),
    T('ace', 'Эйс Трапполла', 'Disney Twisted-Wonderland', 'game', 'dark', '#120C10', '#E04A63', '#F2C14E', 'Unbounded', 'check'),
    T('2b', '2B', 'NieR:Automata', 'game', 'dark', '#0E0E0F', '#E2DDCF', '#7D7A73', 'JetBrains Mono', 'grid'),
    T('jinx', 'Джинкс', 'Аркейн / League of Legends', 'game', 'dark', '#0D0E14', '#EC5BAA', '#4FB6E3', 'Unbounded', 'rings'),
    T('link', 'Линк', 'The Legend of Zelda', 'game', 'light', '#F3F7F1', '#3F8F5A', '#2E5E9E', 'Cormorant Garamond', 'diamond'),
    T('geralt', 'Геральт из Ривии', 'Ведьмак', 'game', 'dark', '#0E0F11', '#AEB6C0', '#9A2E2E', 'Cormorant Garamond', 'stripes'),
  ];

  const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  const get = (id) => byId[id] || byId.classic;

  function pattern(t, strength = 0.18) {
    const A = hexA(t.accent, strength);
    switch (t.pattern) {
      case 'dots': return `radial-gradient(${A} 1.4px, transparent 1.8px) 0 0/14px 14px`;
      case 'stars': return `radial-gradient(${A} 1px, transparent 1.5px) 0 0/22px 22px, radial-gradient(${A} 1.8px, transparent 2.2px) 11px 11px/22px 22px`;
      case 'diamond': return `repeating-linear-gradient(60deg, ${A} 0 1px, transparent 1px 14px), repeating-linear-gradient(-60deg, ${A} 0 1px, transparent 1px 14px), repeating-linear-gradient(0deg, ${A} 0 1px, transparent 1px 12px)`;
      case 'check': return `conic-gradient(${A} 25%, transparent 0 50%, ${A} 0 75%, transparent 0) 0 0/18px 18px`;
      case 'stripes': return `repeating-linear-gradient(45deg, ${A} 0 5px, transparent 5px 15px)`;
      case 'grid': return `linear-gradient(${A} 1px, transparent 1px) 0 0/16px 16px, linear-gradient(90deg, ${A} 1px, transparent 1px) 0 0/16px 16px`;
      case 'rain': return `repeating-linear-gradient(90deg, ${A} 0 2px, transparent 2px 11px)`;
      case 'waves': return `radial-gradient(circle at 50% 100%, transparent 8px, ${A} 9px, ${A} 10px, transparent 11px) 0 0/22px 11px`;
      case 'rings': return `radial-gradient(circle, transparent 5px, ${A} 6px, ${A} 7px, transparent 8px) 0 0/20px 20px`;
      default: return `repeating-linear-gradient(135deg, ${A} 0 1.5px, transparent 1.5px 11px)`;
    }
  }

  // CSS-переменные темы; применяются к любому элементу (сайт целиком, карточка, обложка профиля).
  function vars(t) {
    const dark = t.mode === 'dark';
    return {
      '--bg': t.bg,
      '--surface': t.surface,
      '--surface-2': mix(t.surface, t.ink, dark ? 0.07 : 0.045),
      '--line': mix(t.bg, t.ink, dark ? 0.14 : 0.11),
      '--ink': t.ink,
      '--muted': t.muted,
      '--accent': t.accent,
      '--on-accent': t.onAccent,
      '--accent-soft': hexA(t.accent, dark ? 0.16 : 0.11),
      '--accent-2': t.accent2,
      '--pattern': pattern(t),
      '--font-display': `"${t.font}", Georgia, serif`,
      '--shadow': dark ? '0 20px 50px rgba(0,0,0,.5)' : '0 20px 50px rgba(20,20,40,.14)',
      'color-scheme': t.mode,
    };
  }
  const styleAttr = (t) => Object.entries(vars(t)).map(([k, v]) => `${k}:${v}`).join(';');

  function apply(id) {
    const t = get(id);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars(t))) root.style.setProperty(k, v);
    root.dataset.mode = t.mode;
    root.dataset.char = t.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
    return t;
  }
  function stored() { try { return localStorage.getItem('cg-char') || ''; } catch { return ''; } }
  function store(id) { try { localStorage.setItem('cg-char', id); } catch {} }

  window.CG = { THEMES, CATS, get, apply, vars, styleAttr, pattern, stored, store, hexA, contrast };
  apply(stored() || 'classic');
})();
