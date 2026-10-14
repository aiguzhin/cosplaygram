// Демо-данные Cosplaygram: чтобы новая платформа не выглядела пустой.
// Все демо-профили и события помечены demo: true — их можно удалить, когда придут настоящие косплееры.
const crypto = require('crypto');

const PALETTES = [
  ['#2B1B5A', '#C84B9E', '#F7C948'],
  ['#0E3B43', '#2FA39B', '#F4E3B1'],
  ['#3A0F14', '#C2362F', '#F2B134'],
  ['#14213D', '#3D6CB9', '#E5E5E5'],
  ['#1F2A1C', '#6A994E', '#F2E8CF'],
  ['#2D1E2F', '#7D5BA6', '#F6BD60'],
  ['#102A2F', '#E07A5F', '#F4F1DE'],
  ['#231942', '#5E548E', '#E0B1CB'],
];

// Рисуем «эскиз костюма»: силуэт, плащ, строчка шва и бирка с материалом.
function art(seed, label, sub = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = (n) => ((h = (Math.imul(h, 1103515245) + 12345) >>> 0) >>> 16) % n;
  const [a, b, c] = PALETTES[r(PALETTES.length)];
  const cape = 30 + r(40);
  const crown = r(3);
  const head =
    crown === 0
      ? `<path d="M270 205 l18 -40 l22 30 l22 -30 l18 40z" fill="${c}"/>`
      : crown === 1
      ? `<path d="M262 215 q48 -90 96 0" fill="none" stroke="${c}" stroke-width="10"/>`
      : `<circle cx="310" cy="175" r="16" fill="${c}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 775">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<pattern id="p" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(${r(90)})"><path d="M0 14h28" stroke="${c}" stroke-opacity=".08" stroke-width="2"/></pattern></defs>
<rect width="620" height="775" fill="url(#g)"/><rect width="620" height="775" fill="url(#p)"/>
<circle cx="${120 + r(380)}" cy="${120 + r(200)}" r="${90 + r(80)}" fill="${c}" fill-opacity=".12"/>
<path d="M310 250 L${310 - 150 - cape} 690 Q310 ${640 - r(40)} ${310 + 150 + cape} 690Z" fill="${a}" fill-opacity=".85"/>
<path d="M310 250 L${310 - 150 - cape} 690 Q310 ${640 - r(40)} ${310 + 150 + cape} 690Z" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="10 9"/>
<rect x="262" y="250" width="96" height="250" rx="40" fill="${b}"/>
<circle cx="310" cy="215" r="44" fill="${c}" fill-opacity=".92"/>${head}
<g font-family="Manrope, Arial, sans-serif"><rect x="36" y="660" width="${Math.min(548, 40 + label.length * 17)}" height="76" rx="10" fill="#000" fill-opacity=".35"/>
<text x="56" y="698" fill="#fff" font-size="28" font-weight="700">${label}</text>
<text x="56" y="724" fill="#fff" fill-opacity=".75" font-size="18">${sub}</text></g></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function seed() {
  const id = () => crypto.randomBytes(8).toString('hex');
  const t = Date.now();
  const H = 60 * 60 * 1000;
  const D = 24 * H;

  const users = [
    { username: 'aru.cos', name: 'Аружан', city: 'Алматы', specialty: 'Пошив платьев, вышивка', bio: 'Шью костюмы из аниме и казахских легенд. Люблю сложную вышивку.', hue: 330 },
    { username: 'dias_props', name: 'Диас', city: 'Астана', specialty: 'Броня и реквизит из EVA', bio: 'Делаю броню, мечи и шлемы. Помогу с выкройками из EVA.', hue: 210 },
    { username: 'kamila.wigs', name: 'Камила', city: 'Шымкент', specialty: 'Парики и стайлинг', bio: 'Укладываю парики любой сложности. Отвечаю в форуме про термостойкие волокна.', hue: 280 },
    { username: 'timur.photo', name: 'Тимур', city: 'Караганда', specialty: 'Фотограф косплея', bio: 'Снимаю косплей на локациях Казахстана.', hue: 160 },
    { username: 'madi.craft', name: 'Мади', city: 'Актобе', specialty: 'Worbla, 3D-печать', bio: 'Печатаю детали на 3D-принтере и дорабатываю worbla.', hue: 30 },
    { username: 'aisha.sews', name: 'Айша', city: 'Ташкент', specialty: 'Исторический костюм', bio: 'Из Центральной Азии с любовью к историческому крою.', hue: 10 },
  ].map((u, i) => ({ id: id(), password: null, avatar: null, createdAt: t - (40 - i) * D, demo: true, ...u }));
  const U = Object.fromEntries(users.map((u) => [u.username, u.id]));
  const ids = users.map((u) => u.id);
  const someLikes = (n) => [...ids].sort(() => Math.random() - 0.5).slice(0, n);

  const costume = (who, character, fandom, caption, materials, hours, ago, likes) => ({
    id: id(),
    authorId: U[who],
    kind: 'costume',
    character,
    fandom,
    caption,
    materials,
    hours,
    slides: [{ image: art(character + who, character, fandom), caption: '' }],
    likes: someLikes(likes),
    comments: [],
    createdAt: t - ago,
    demo: true,
  });

  const posts = [
    costume('aru.cos', 'Томирис', 'Ориджинал', 'Образ царицы саков: кафтан с ручной вышивкой и войлочные вставки.', ['войлок', 'бархат', 'золотая тесьма'], 120, 3 * H, 6),
    costume('dias_props', 'Рыцарь Бездны', 'Genshin Impact', 'Полная броня из EVA 10 мм, покраска аэрографом.', ['EVA 10 мм', 'пластидип', 'акрил'], 90, 9 * H, 5),
    costume('kamila.wigs', 'Фрирен', 'Sousou no Frieren', 'Парик с хвостиками, уложен на термобигуди. Посох в процессе.', ['термостойкий парик', 'лак Got2b'], 25, 20 * H, 4),
    costume('timur.photo', 'Странник', 'Ориджинал', 'Съёмка на Чарынском каньоне на закате. Модель: aru.cos.', ['локация', 'отражатель'], 6, 30 * H, 6),
    costume('madi.craft', 'Мандалорец', 'Star Wars', 'Шлем напечатан PLA, шлифовка и хромовая краска.', ['PLA', 'шпатлёвка', 'хром'], 70, 2 * D, 5),
    costume('aisha.sews', 'Принцесса Шелкового пути', 'Ориджинал', 'Икат, ручная вышивка, головной убор с подвесками.', ['икат', 'бисер', 'латунь'], 140, 3 * D, 6),
    costume('aru.cos', 'Нэдзуко', 'Kimetsu no Yaiba', 'Кимоно из хлопка с трафаретной печатью узора асаноха.', ['хлопок', 'трафарет', 'краска по ткани'], 35, 5 * D, 3),
    costume('dias_props', 'Ведьмак', 'The Witcher', 'Кожаная куртка, медальон и два меча из EVA.', ['кожзам', 'EVA 5 мм', 'термоклей'], 60, 7 * D, 4),
    costume('kamila.wigs', 'Мику', 'Vocaloid', 'Хвосты по 90 см, каркас из проволоки внутри.', ['парик', 'проволока', 'фетр'], 18, 9 * D, 2),
  ];

  posts.push({
    id: id(),
    authorId: U['aru.cos'],
    kind: 'process',
    character: 'Томирис',
    fandom: 'Ориджинал',
    caption: 'Как я шила кафтан Томирис: от выкройки до вышивки.',
    materials: ['войлок', 'бархат', 'тесьма'],
    hours: 120,
    slides: [
      { image: art('tom1', 'Шаг 1 · Выкройка', 'Крафт-бумага, макет из бязи'), caption: 'Снимаю мерки и делаю макет из бязи, чтобы проверить посадку.' },
      { image: art('tom2', 'Шаг 2 · Раскрой', 'Бархат + войлок'), caption: 'Кроим бархат по долевой, войлок — для вставок на плечах.' },
      { image: art('tom3', 'Шаг 3 · Вышивка', '≈60 часов вручную'), caption: 'Вышиваю орнамент золотой нитью. Самый долгий этап.' },
      { image: art('tom4', 'Шаг 4 · Сборка', 'Подклад и отделка'), caption: 'Собираю, пришиваю подклад и тесьму по краю.' },
    ],
    likes: someLikes(6),
    comments: [],
    createdAt: t - 4 * D,
    demo: true,
  });
  posts.push({
    id: id(),
    authorId: U['dias_props'],
    kind: 'process',
    character: 'Наплечник из EVA',
    fandom: 'Туториал',
    caption: 'Наплечник за вечер: выкройка, нагрев, грунт.',
    materials: ['EVA 5 мм', 'фен', 'контактный клей'],
    hours: 5,
    slides: [
      { image: art('eva1', 'Шаг 1 · Шаблон', 'Скотч + плёнка'), caption: 'Обматываю плечо плёнкой и скотчем, рисую линии и снимаю шаблон.' },
      { image: art('eva2', 'Шаг 2 · Нагрев', 'Строительный фен'), caption: 'Прогреваю EVA и формую по изгибу.' },
      { image: art('eva3', 'Шаг 3 · Грунт', 'Пластидип, 3 слоя'), caption: 'Три слоя грунта, потом акрил и патина.' },
    ],
    likes: someLikes(4),
    comments: [],
    createdAt: t - 6 * D,
    demo: true,
  });

  posts[0].comments.push(
    { id: id(), authorId: U['aisha.sews'], text: 'Вышивка невероятная! Какой нитью шила?', createdAt: t - 2 * H },
    { id: id(), authorId: U['aru.cos'], text: 'Металлизированная нить, в два сложения.', createdAt: t - 1 * H }
  );
  posts[1].comments.push({ id: id(), authorId: U['madi.craft'], text: 'Какое давление на аэрографе?', createdAt: t - 5 * H });

  const stories = [
    { who: 'dias_props', text: 'Крашу шлем 🔧', label: 'WIP шлем', ago: 2 * H },
    { who: 'kamila.wigs', text: 'Новая партия париков', label: 'Парики', ago: 5 * H },
    { who: 'aru.cos', text: 'Вышивка, день 6', label: 'Вышивка', ago: 7 * H },
    { who: 'madi.craft', text: 'Принтер работает 14 часов', label: '3D-печать', ago: 11 * H },
  ].map((s) => ({ id: id(), authorId: U[s.who], image: art('story' + s.who, s.label, s.text), text: s.text, createdAt: t - s.ago, demo: true }));

  const threads = [
    { who: 'madi.craft', category: 'materials', city: 'Актобе', title: 'Где в Актобе купить EVA 10 мм?', body: 'Ищу листы EVA 10 мм и 5 мм. В строительных только тонкий. Может, кто-то заказывает оптом?', replies: [['dias_props', 'В Астане беру на маркетплейсе, доставка 3–4 дня. Могу скинуть ссылку в чат.']] },
    { who: 'aisha.sews', category: 'sewing', city: '', title: 'Нужна помощь: втачной рукав на бархате', body: 'Бархат ползёт при втачивании рукава. Какие лапки и иглы используете?', replies: [['aru.cos', 'Лапка с верхним транспортёром и игла 90 для стрейча. Смётывай обязательно!']] },
    { who: 'kamila.wigs', category: 'wigs', city: 'Шымкент', title: 'Ищу модель для съёмки укладки', body: 'Нужна модель на 2 часа в Шымкенте для фото укладки парика Фрирен.', replies: [] },
    { who: 'timur.photo', category: 'photo', city: 'Караганда', title: 'Совместная фотопрогулка в октябре', body: 'Предлагаю собраться на фотосет в парке. Кто хочет — отпишитесь, согласуем дату.', replies: [['madi.craft', 'Я бы приехал в Мандалорце!']] },
  ].map((x, i) => ({
    id: id(),
    authorId: U[x.who],
    category: x.category,
    city: x.city,
    title: x.title,
    body: x.body,
    replies: x.replies.map(([w, text], j) => ({ id: id(), authorId: U[w], text, createdAt: t - (i + 1) * D + (j + 1) * H })),
    createdAt: t - (i + 2) * D,
    demo: true,
  }));

  const d = (days) => new Date(t + days * D).toISOString().slice(0, 10);
  const events = [
    { title: 'Косплей-конкурс на аниме-фестивале', date: d(10), city: 'Алматы', place: 'Уточняется', type: 'contest' },
    { title: 'Встреча косплееров в парке', date: d(17), city: 'Астана', place: 'Центральный парк', type: 'meetup' },
    { title: 'Фестиваль поп-культуры', date: d(31), city: 'Шымкент', place: 'Уточняется', type: 'festival' },
    { title: 'Мастер-класс по EVA', date: d(24), city: 'Актобе', place: 'Коворкинг', type: 'meetup' },
    { title: 'Зимний косплей-дефиле', date: d(55), city: 'Караганда', place: 'Уточняется', type: 'contest' },
  ].map((e) => ({ id: id(), link: '', note: 'Пример события. Замените на реальное с датой и ссылкой организатора.', authorId: null, demo: true, ...e }));

  const chat = {
    general: [
      ['aru.cos', 'Всем привет! Кто едет на фестиваль в Алматы?'],
      ['dias_props', 'Я! Везу новую броню 💪'],
      ['kamila.wigs', 'Могу помочь с париками прямо на месте'],
    ].map(([w, text], i) => ({ id: id(), authorId: U[w], text, createdAt: t - (3 - i) * H })),
    help: [['madi.craft', 'Кто знает, чем лучше шпатлевать PLA?']].map(([w, text]) => ({ id: id(), authorId: U[w], text, createdAt: t - 4 * H })),
  };

  return { users, posts, stories, threads, events, chat, sessions: {} };
}

module.exports = { seed, art };
