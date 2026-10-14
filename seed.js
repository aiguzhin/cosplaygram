// Демо-данные Cosplaygram, чтобы новая платформа не выглядела пустой.
// Все образы оригинальные, фото сгенерированы для демонстрации и лежат в public/demo.
// Демо-профили помечены demo = TRUE; модератор может удалить их одной кнопкой.
const crypto = require('crypto');

const SEED_VERSION = 2;
const id = () => crypto.randomBytes(8).toString('hex');
const photo = (name) => `/demo/${name}.jpg`;

const USERS = [
  { username: 'aru.cos', name: 'Аружан', city: 'Алматы', specialty: 'Шитьё и вышивка', color: 'lapis', avatar: 'tomyris',
    bio: 'Шью костюмы по мотивам казахских легенд. Люблю ручную вышивку золотой нитью.' },
  { username: 'dias_props', name: 'Диас', city: 'Астана', specialty: 'Броня и реквизит из EVA', color: 'garnet', avatar: 'hunter',
    bio: 'Делаю броню, мечи и шлемы. Помогаю с выкройками из EVA.' },
  { username: 'kamila.wigs', name: 'Камила', city: 'Шымкент', specialty: 'Парики и стайлинг', color: 'violet', avatar: 'moon',
    bio: 'Укладываю парики любой сложности. Отвечаю на форуме про термостойкие волокна.' },
  { username: 'timur.photo', name: 'Тимур', city: 'Караганда', specialty: 'Фотограф косплея', color: 'saffron', avatar: 'wanderer',
    bio: 'Снимаю косплей на локациях Казахстана: каньоны, степь, горы.' },
  { username: 'madi.craft', name: 'Мади', city: 'Актобе', specialty: '3D-печать и sci-fi броня', color: 'turquoise', avatar: 'spacehunter',
    bio: 'Печатаю шлемы на 3D-принтере и довожу до идеала шпаклёвкой и аэрографом.' },
  { username: 'aisha.sews', name: 'Айша', city: 'Ташкент', specialty: 'Исторический костюм', color: 'jade', avatar: 'silkroad',
    bio: 'Исторический крой, икат и украшения в духе Шёлкового пути.' },
];

const H = 60 * 60 * 1000;
const D = 24 * H;

const POSTS = [
  { who: 'aru.cos', kind: 'costume', character: 'Томирис, царица саков', fandom: 'Ориджинал', hours: 120, ago: 3 * H, likes: 6,
    caption: 'Мой главный проект этого года. Бархатный кафтан, войлочные наплечники и головной убор из латуни. Вышивка полностью ручная.',
    materials: ['бархат', 'войлок', 'металлизированная нить', 'латунь'], photos: ['tomyris'],
    comments: [['aisha.sews', 'Вышивка невероятная! Какой нитью шила?'], ['aru.cos', 'Металлизированная нить в два сложения, игла №9.']] },
  { who: 'dias_props', kind: 'costume', character: 'Рыцарь Северной заставы', fandom: 'Ориджинал', hours: 90, ago: 9 * H, likes: 5,
    caption: 'Полный доспех из EVA 10 мм. Покраска аэрографом, потёртости сухой кистью. Плащ — двойной габардин.',
    materials: ['EVA 10 мм', 'пластидип', 'акрил', 'габардин'], photos: ['knight'],
    comments: [['madi.craft', 'Какое давление ставишь на аэрографе?']] },
  { who: 'kamila.wigs', kind: 'costume', character: 'Лунная волшебница', fandom: 'Ориджинал', hours: 28, ago: 20 * H, likes: 4,
    caption: 'Укладка на термобигуди, косы на каркасе. Украшения-полумесяцы из термопластика.',
    materials: ['термостойкий парик', 'термопластик', 'лак сильной фиксации'], photos: ['moon'], comments: [] },
  { who: 'timur.photo', kind: 'costume', character: 'Странник пустыни', fandom: 'Фотосет', hours: 6, ago: 30 * H, likes: 6,
    caption: 'Закат на Чарыне. Ехали четыре часа ради двадцати минут золотого света, и оно того стоило.',
    materials: ['локация', 'отражатель'], photos: ['wanderer'], comments: [] },
  { who: 'madi.craft', kind: 'costume', character: 'Космический охотник', fandom: 'Ориджинал', hours: 70, ago: 2 * D, likes: 5,
    caption: 'Шлем напечатан PLA за 31 час, затем шпаклёвка, шлифовка и покраска. Подсветка — светодиодная лента.',
    materials: ['PLA', 'шпаклёвка', 'акрил', 'LED-лента'], photos: ['spacehunter'], comments: [] },
  { who: 'aisha.sews', kind: 'costume', character: 'Принцесса Шёлкового пути', fandom: 'Ориджинал', hours: 140, ago: 3 * D, likes: 6,
    caption: 'Икат, бархатный жилет с вышивкой и головной убор с монетками. Каждую подвеску собирала вручную.',
    materials: ['икат', 'бархат', 'бисер', 'латунь'], photos: ['silkroad'], comments: [] },
  { who: 'aru.cos', kind: 'costume', character: 'Лиса-хранительница', fandom: 'Ориджинал', hours: 45, ago: 5 * D, likes: 4,
    caption: 'Кимоно из хлопка с трафаретной росписью, хвост из искусственного меха на каркасе.',
    materials: ['хлопок', 'трафарет', 'искусственный мех'], photos: ['kitsune'], comments: [] },
  { who: 'dias_props', kind: 'costume', character: 'Охотник на чудовищ', fandom: 'Ориджинал', hours: 60, ago: 7 * D, likes: 4,
    caption: 'Кожаная куртка, амулет и два меча из EVA с деревянными рукоятями.',
    materials: ['кожзам', 'EVA 5 мм', 'дерево'], photos: ['hunter'], comments: [] },
  { who: 'kamila.wigs', kind: 'costume', character: 'Певица неонового города', fandom: 'Ориджинал', hours: 22, ago: 9 * D, likes: 3,
    caption: 'Хвосты по 90 см с проволочным каркасом внутри, вставки в костюме со светодиодами.',
    materials: ['парик', 'проволока', 'LED-лента'], photos: ['neon'], comments: [] },
  { who: 'aru.cos', kind: 'process', character: 'Как я шила кафтан Томирис', fandom: 'Туториал', hours: 120, ago: 4 * D, likes: 6,
    caption: 'От бумажной выкройки до готового кафтана: четыре главных этапа.',
    materials: ['бархат', 'войлок', 'нить'], comments: [],
    photos: ['step-pattern', 'step-cut', 'step-embroidery', 'step-kaftan'],
    captions: [
      'Снимаю мерки, строю выкройку и шью макет из бязи, чтобы проверить посадку.',
      'Кроим бархат по долевой. Войлок — для вставок на плечах.',
      'Вышиваю орнамент золотой нитью. Самый долгий этап, около 60 часов.',
      'Собираю, пришиваю подклад и тесьму по краю. Готово!',
    ] },
  { who: 'dias_props', kind: 'process', character: 'Наплечник из EVA за вечер', fandom: 'Туториал', hours: 5, ago: 6 * D, likes: 4,
    caption: 'Самый простой способ сделать броню по фигуре.',
    materials: ['EVA 5 мм', 'строительный фен', 'контактный клей'], comments: [],
    photos: ['eva-template', 'eva-heat', 'eva-paint'],
    captions: [
      'Обматываю плечо плёнкой и малярным скотчем, рисую линии и снимаю шаблон.',
      'Прогреваю EVA феном и формую по изгибу.',
      'Три слоя грунта, затем акрил, патина и заклёпки.',
    ] },
];

const STORIES = [
  { who: 'kamila.wigs', photo: 'wip-wigs', text: 'Три парика к фестивалю', ago: 2 * H },
  { who: 'madi.craft', photo: 'wip-printer', text: 'Принтер работает 14-й час', ago: 5 * H },
  { who: 'aru.cos', photo: 'step-embroidery', text: 'Вышивка, день 6', ago: 7 * H },
  { who: 'dias_props', photo: 'eva-paint', text: 'Крашу новый наплечник', ago: 11 * H },
];

const THREADS = [
  { who: 'madi.craft', category: 'materials', city: 'Актобе', title: 'Где в Актобе купить EVA 10 мм?',
    body: 'Ищу листы EVA 10 мм и 5 мм. В строительных только тонкий. Может, кто-то заказывает оптом?',
    replies: [['dias_props', 'В Астане беру на маркетплейсе, доставка 3–4 дня. Скину ссылку в чат.']] },
  { who: 'aisha.sews', category: 'sewing', city: '', title: 'Бархат ползёт при втачивании рукава',
    body: 'Какие лапки и иглы используете для бархата?',
    replies: [['aru.cos', 'Лапка с верхним транспортёром и игла 90 для стрейча. Смётывай обязательно!']] },
  { who: 'kamila.wigs', category: 'wigs', city: 'Шымкент', title: 'Ищу модель для съёмки укладки',
    body: 'Нужна модель на 2 часа в Шымкенте для фото укладки парика.', replies: [] },
  { who: 'timur.photo', category: 'photo', city: 'Караганда', title: 'Совместная фотопрогулка в октябре',
    body: 'Предлагаю собраться на фотосет в парке. Кто хочет — отпишитесь, согласуем дату.',
    replies: [['madi.craft', 'Я бы приехал в броне!']] },
];

const EVENTS = [
  { title: 'Косплей-конкурс на аниме-фестивале', days: 10, city: 'Алматы', place: 'Уточняется', type: 'contest' },
  { title: 'Встреча косплееров в парке', days: 17, city: 'Астана', place: 'Центральный парк', type: 'meetup' },
  { title: 'Мастер-класс по EVA', days: 24, city: 'Актобе', place: 'Коворкинг', type: 'workshop' },
  { title: 'Фестиваль поп-культуры', days: 31, city: 'Шымкент', place: 'Уточняется', type: 'festival' },
  { title: 'Зимнее косплей-дефиле', days: 55, city: 'Караганда', place: 'Уточняется', type: 'contest' },
];

const CHAT = {
  general: [['aru.cos', 'Всем привет! Кто едет на фестиваль в Алматы?'], ['dias_props', 'Я! Везу новую броню'], ['kamila.wigs', 'Могу помочь с париками прямо на месте']],
  help: [['madi.craft', 'Кто знает, чем лучше шпаклевать PLA?']],
};

async function seedDb({ query, exec }) {
  await exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const v = await query("SELECT value FROM meta WHERE key = 'seed_version'");
  const current = v.length ? Number(v[0].value) : 0;
  if (current >= SEED_VERSION) return false;

  // убираем прежние демо-данные; настоящие участники и их публикации остаются
  await query('DELETE FROM events WHERE demo = TRUE');
  await query('DELETE FROM users WHERE demo = TRUE');
  await query("DELETE FROM images WHERE mime = 'image/svg+xml'");

  const t = Date.now();
  const U = {};
  for (const [i, u] of USERS.entries()) {
    U[u.username] = id();
    await query(
      `INSERT INTO users (id, username, password, name, city, specialty, bio, avatar_id, color, demo, created_at)
       VALUES ($1,$2,NULL,$3,$4,$5,$6,$7,$8,TRUE,$9)`,
      [U[u.username], u.username, u.name, u.city, u.specialty, u.bio, photo(u.avatar), u.color, t - (40 - i) * D]
    );
  }
  const ids = Object.values(U);
  const pick = (k) => [...ids].sort(() => Math.random() - 0.5).slice(0, k);

  for (const p of POSTS) {
    const pid = id();
    const created = t - p.ago;
    await query(
      `INSERT INTO posts (id, author_id, kind, character, fandom, caption, materials, hours, demo, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9)`,
      [pid, U[p.who], p.kind, p.character, p.fandom, p.caption, JSON.stringify(p.materials), p.hours, created]
    );
    for (const [i, ph] of p.photos.entries())
      await query('INSERT INTO post_images (post_id, idx, image_id, caption) VALUES ($1,$2,$3,$4)', [pid, i, photo(ph), p.captions?.[i] || '']);
    for (const uid of pick(p.likes)) await query('INSERT INTO likes (post_id, user_id, created_at) VALUES ($1,$2,$3)', [pid, uid, t - p.ago / 2]);
    for (const [j, [w, text]] of p.comments.entries())
      await query('INSERT INTO comments (id, post_id, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [id(), pid, U[w], text, created + (j + 1) * 20 * 60 * 1000]);
  }
  for (const s of STORIES)
    await query('INSERT INTO stories (id, author_id, image_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [id(), U[s.who], photo(s.photo), s.text, t - s.ago]);
  for (const [i, th] of THREADS.entries()) {
    const tid = id();
    await query('INSERT INTO threads (id, author_id, category, city, title, body, demo, created_at) VALUES ($1,$2,$3,$4,$5,$6,TRUE,$7)',
      [tid, U[th.who], th.category, th.city, th.title, th.body, t - (i + 2) * D]);
    for (const [j, [w, text]] of th.replies.entries())
      await query('INSERT INTO replies (id, thread_id, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [id(), tid, U[w], text, t - (i + 1) * D + j * H]);
  }
  for (const e of EVENTS)
    await query(
      'INSERT INTO events (id, title, date, city, place, type, link, note, demo, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9)',
      [id(), e.title, new Date(t + e.days * D).toISOString().slice(0, 10), e.city, e.place, e.type, '',
        'Пример события. Замените на настоящее с датой и ссылкой организатора.', t]
    );
  for (const [room, msgs] of Object.entries(CHAT))
    for (const [i, [w, text]] of msgs.entries())
      await query('INSERT INTO messages (id, room, author_id, text, created_at) VALUES ($1,$2,$3,$4,$5)', [id(), room, U[w], text, t - (msgs.length - i) * H]);
  for (let i = 0; i < ids.length; i++)
    await query('INSERT INTO follows (follower_id, followee_id, created_at) VALUES ($1,$2,$3)', [ids[i], ids[(i + 1) % ids.length], t]);

  await query(
    "INSERT INTO meta (key, value) VALUES ('seed_version', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    [String(SEED_VERSION)]
  );
  return true;
}

module.exports = { seedDb };
