// Cosplaygram — темы по персонажам.
// Дорам нет: их почти не косплеят; вместо них — персонажи книг.
  // Порядок внутри раздела — по популярности у косплееров: рейтинг Spacomic «кого хотят косплеить» 2025
// и постоянные фавориты конвентов. На сайте сортировка дополнительно учитывает, сколько косплеев
// персонажа уже опубликовано в Cosplaygram.
// Официальные изображения персонажей не используем (авторские права): на карточке — фото косплея
// от участников или обложка, загруженная модератором; без фото — эмблема в цветах персонажа.
(function () {
  'use strict';

  const CATS = { anime: 'Аниме', manga: 'Манга', book: 'Книги', film: 'Фильмы и сериалы', game: 'Игры' };

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
    T('tanjiro', 'Танджиро Камадо', 'Клинок, рассекающий демонов', 'anime', 'dark', '#0E1311', '#3BA776', '#C8463D', 'Unbounded', 'check'),
    T('zenitsu', 'Зеницу Агацума', 'Клинок, рассекающий демонов', 'anime', 'dark', '#14110A', '#F2C230', '#E07A2F', 'Comfortaa', 'diamond'),
    T('mitsuri', 'Мицури Канродзи', 'Клинок, рассекающий демонов', 'anime', 'dark', '#140F12', '#F07AA8', '#7CC47A', 'Comfortaa', 'dots'),
    T('itadori', 'Юдзи Итадори', 'Магическая битва', 'anime', 'dark', '#0E0D12', '#E25A6A', '#3E4A7A', 'Unbounded', 'dots'),
    T('sukuna', 'Рёмен Сукуна', 'Магическая битва', 'anime', 'dark', '#120A0C', '#C8323A', '#E8D9C0', 'Cormorant Garamond', 'stripes'),
    T('mikasa', 'Микаса Аккерман', 'Атака титанов', 'anime', 'dark', '#120F0E', '#C9443C', '#7D8A5A', 'Cormorant Garamond', 'stripes'),
    T('eren', 'Эрен Йегер', 'Атака титанов', 'anime', 'dark', '#0F100C', '#4FA08B', '#8B5E3C', 'Unbounded', 'stripes'),
    T('power', 'Пауэр', 'Человек-бензопила', 'anime', 'dark', '#130D0D', '#E05A3A', '#F2C14E', 'Unbounded', 'dots'),
    T('denji', 'Дэндзи', 'Человек-бензопила', 'anime', 'dark', '#100E0B', '#F08A24', '#C8323A', 'Unbounded', 'grid'),
    T('asuka', 'Аска Лэнгли', 'Евангелион', 'anime', 'dark', '#140C0C', '#E4362F', '#F28C38', 'Unbounded', 'grid'),
    T('reiayanami', 'Рей Аянами', 'Евангелион', 'anime', 'light', '#F2F5FA', '#4A78C2', '#E0E4EC', 'JetBrains Mono', 'grid'),
    T('violet', 'Вайолет Эвергарден', 'Вайолет Эвергарден', 'anime', 'light', '#F6F4EF', '#2F5E8C', '#C9A74A', 'Cormorant Garamond', 'stars'),
    T('kaguya', 'Кагуя Синомия', 'Госпожа Кагуя: в любви как на войне', 'anime', 'light', '#FDF5F5', '#B8323F', '#2B2B3A', 'Cormorant Garamond', 'diamond'),
    T('bocchi', 'Хитори Гото', 'Одинокий рокер!', 'anime', 'light', '#FFF5F9', '#E2649A', '#F2D04A', 'Comfortaa', 'check'),
    T('aihoshino', 'Ай Хосино', 'Звёздное дитя', 'anime', 'dark', '#120D18', '#E85FA8', '#9B6BF0', 'Comfortaa', 'stars'),
    T('todoroki', 'Сёто Тодороки', 'Моя геройская академия', 'anime', 'dark', '#0D0F14', '#E2463B', '#6FB0E8', 'Unbounded', 'grid'),
    T('deku', 'Изуку Мидория', 'Моя геройская академия', 'anime', 'light', '#F2F7F3', '#2E8B57', '#D7263D', 'Unbounded', 'dots'),
    T('killua', 'Киллуа Золдик', 'Охотник × Охотник', 'anime', 'light', '#F4F5FA', '#5A6ED8', '#C9CCE0', 'Unbounded', 'rings'),
    T('ash', 'Эш Кетчум', 'Покемон', 'anime', 'light', '#FFF9EE', '#D7263D', '#2E5EAA', 'Unbounded', 'dots'),

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
    T('goku', 'Сон Гоку', 'Драгонболл', 'manga', 'light', '#FFF8EE', '#F07A1F', '#2E5EAA', 'Unbounded', 'stars'),
    T('zoro', 'Ророноа Зоро', 'Ван-Пис', 'manga', 'dark', '#0D120E', '#4FAE5A', '#C9A74A', 'Unbounded', 'stripes'),
    T('nami', 'Нами', 'Ван-Пис', 'manga', 'light', '#FFF8F0', '#E8762F', '#3A86C8', 'Comfortaa', 'waves'),
    T('itachi', 'Итачи Учиха', 'Наруто', 'manga', 'dark', '#0E0B0D', '#C8323A', '#2B2B3A', 'Cormorant Garamond', 'rings'),
    T('kakashi', 'Какаши Хатакэ', 'Наруто', 'manga', 'dark', '#0E1014', '#9AA6B8', '#3A6EA5', 'Unbounded', 'grid'),
    T('sasuke', 'Саске Учиха', 'Наруто', 'manga', 'dark', '#0D0C12', '#7B6CD8', '#C8323A', 'Unbounded', 'rings'),
    T('hinata', 'Хината Хьюга', 'Наруто', 'manga', 'light', '#F6F5FB', '#7B6FC8', '#2B2B3A', 'Comfortaa', 'dots'),
    T('ichigo', 'Ичиго Куросаки', 'Блич', 'manga', 'dark', '#0C0C0D', '#F07A1F', '#E8E8EA', 'Unbounded', 'stripes'),
    T('lightyagami', 'Лайт Ягами', 'Тетрадь смерти', 'manga', 'dark', '#0D0C10', '#C8323A', '#D9B76B', 'Cormorant Garamond', 'grid'),

    // ---------- Книги ----------
    T('wei', 'Вэй Усянь', 'Магистр дьявольского культа', 'book', 'dark', '#0F0B0B', '#D23C46', '#E2C17C', 'Cormorant Garamond', 'waves'),
    T('lan', 'Лань Ванцзи', 'Магистр дьявольского культа', 'book', 'light', '#F4F8FA', '#36698F', '#A9BFCF', 'Cormorant Garamond', 'waves'),
    T('xielian', 'Се Лянь', 'Благословение небожителей', 'book', 'light', '#F7F4F7', '#A8668E', '#C9B6D6', 'Cormorant Garamond', 'waves'),
    T('huacheng', 'Хуа Чэн', 'Благословение небожителей', 'book', 'dark', '#120A0C', '#C8323A', '#B8A0D8', 'Cormorant Garamond', 'stars'),
    T('harry', 'Гарри Поттер', 'Гарри Поттер', 'book', 'dark', '#160D0F', '#D9A441', '#A0283A', 'Cormorant Garamond', 'stars'),
    T('hermione', 'Гермиона Грейнджер', 'Гарри Поттер', 'book', 'dark', '#140D0F', '#C9A74A', '#A0283A', 'Cormorant Garamond', 'stars'),
    T('alice', 'Алиса', 'Алиса в Стране чудес', 'book', 'light', '#F2F7FC', '#3A7BD5', '#D9A441', 'Comfortaa', 'check'),
    T('hatter', 'Безумный Шляпник', 'Алиса в Стране чудес', 'book', 'dark', '#120E14', '#D98A2E', '#4FA08B', 'Yeseva One', 'check'),
    T('woland', 'Воланд', 'Мастер и Маргарита', 'book', 'dark', '#0D0B10', '#B8323F', '#D9B76B', 'Cormorant Garamond', 'stars'),
    T('margarita', 'Маргарита', 'Мастер и Маргарита', 'book', 'dark', '#0F0B10', '#D9B76B', '#8E1F2F', 'Cormorant Garamond', 'stars'),
    T('sherlock', 'Шерлок Холмс', 'Приключения Шерлока Холмса', 'book', 'light', '#F4F1EA', '#6B4E2E', '#2E4E6B', 'Cormorant Garamond', 'grid'),
    T('katniss', 'Китнисс Эвердин', 'Голодные игры', 'book', 'dark', '#0E0F0C', '#E07A2F', '#6B7F45', 'Unbounded', 'stripes'),
    T('percy', 'Перси Джексон', 'Перси Джексон', 'book', 'light', '#F2F8FA', '#E8762F', '#2E7FA8', 'Unbounded', 'waves'),
    T('kaz', 'Каз Бреккер', 'Шестёрка воронов', 'book', 'dark', '#0C0D10', '#8A8F98', '#7A2E3A', 'Cormorant Garamond', 'grid'),
    T('inej', 'Инеж Гафа', 'Шестёрка воронов', 'book', 'dark', '#100C14', '#8E6BAE', '#D9B76B', 'Cormorant Garamond', 'diamond'),
    T('dracula', 'Граф Дракула', 'Дракула', 'book', 'dark', '#0C080A', '#B8323F', '#5A5A66', 'Cormorant Garamond', 'rings'),
    T('littleprince', 'Маленький принц', 'Маленький принц', 'book', 'light', '#F5F7FC', '#D9A441', '#4A78C2', 'Comfortaa', 'stars'),

    // ---------- Фильмы и сериалы ----------
    T('gihun', 'Сон Ки-хун', 'Игра в кальмара', 'film', 'dark', '#0B1414', '#F0397A', '#2BB39B', 'Unbounded', 'grid'),
    T('wednesday', 'Уэнсдэй Аддамс', 'Уэнсдэй', 'film', 'dark', '#0B0B0D', '#CFC8EA', '#6B4E9B', 'Cormorant Garamond', 'check'),
    T('miles', 'Майлз Моралес', 'Человек-паук: Через вселенные', 'film', 'dark', '#0B0B10', '#E8384F', '#3A7BFF', 'Unbounded', 'dots'),
    T('elsa', 'Эльза', 'Холодное сердце', 'film', 'light', '#F1F7FC', '#2373AE', '#7CC6EE', 'Cormorant Garamond', 'stars'),
    T('neo', 'Нео', 'Матрица', 'film', 'dark', '#050806', '#3BFF6E', '#1C8C3C', 'JetBrains Mono', 'rain'),
    T('paul', 'Пол Атрейдес', 'Дюна', 'film', 'dark', '#17120D', '#E39B3B', '#5A8FC2', 'Unbounded', 'waves'),
    T('barbie', 'Барби', 'Барби', 'film', 'light', '#FFF2F8', '#D81B80', '#F49AC6', 'Comfortaa', 'check'),
    T('vader', 'Дарт Вейдер', 'Звёздные войны', 'film', 'dark', '#070708', '#E5243B', '#5A5A66', 'Unbounded', 'grid'),
    T('jack', 'Джек Воробей', 'Пираты Карибского моря', 'film', 'dark', '#120E0A', '#C98B4A', '#3E6B6B', 'Cormorant Garamond', 'waves'),
    T('gandalf', 'Гэндальф', 'Властелин колец', 'film', 'light', '#F4F1E8', '#6E6150', '#9AA3A8', 'Cormorant Garamond', 'rings'),
    T('mulan', 'Мулан', 'Мулан', 'film', 'light', '#FFF8F1', '#C2362F', '#2E5E8C', 'Yeseva One', 'waves'),
    T('spiderman', 'Человек-паук', 'Marvel', 'film', 'dark', '#0C0D14', '#E2283B', '#2E5EC8', 'Unbounded', 'grid'),
    T('ironman', 'Железный человек', 'Marvel', 'film', 'dark', '#120C0A', '#D7263D', '#E9B530', 'Unbounded', 'rings'),
    T('loki', 'Локи', 'Marvel', 'film', 'dark', '#0B110E', '#3FA36B', '#D9B76B', 'Cormorant Garamond', 'diamond'),
    T('wanda', 'Алая Ведьма', 'Marvel', 'film', 'dark', '#130A0D', '#D23C5A', '#8B2E4A', 'Yeseva One', 'stars'),
    T('deadpool', 'Дэдпул', 'Marvel', 'film', 'dark', '#110909', '#D7263D', '#8A8F98', 'Unbounded', 'check'),
    T('harley', 'Харли Квинн', 'DC', 'film', 'dark', '#0E0B10', '#E2436A', '#3A86E8', 'Unbounded', 'check'),
    T('joker', 'Джокер', 'DC', 'film', 'dark', '#0D0B10', '#7DBA4A', '#8E4FC8', 'Cormorant Garamond', 'stripes'),
    T('wonderwoman', 'Чудо-женщина', 'DC', 'film', 'dark', '#120C0C', '#D7263D', '#E9B530', 'Yeseva One', 'stars'),
    T('batman', 'Бэтмен', 'DC', 'film', 'dark', '#08090B', '#E9C53A', '#5A5A66', 'Unbounded', 'grid'),
    T('mando', 'Мандалорец', 'Звёздные войны', 'film', 'dark', '#0E0F11', '#AEB6C0', '#C98B4A', 'Unbounded', 'rings'),
    T('rey', 'Рей', 'Звёздные войны', 'film', 'light', '#F7F3EC', '#B08A5A', '#3A7BFF', 'Unbounded', 'dots'),
    T('maleficent', 'Малефисента', 'Малефисента', 'film', 'dark', '#0E0B12', '#7DBA4A', '#8E4FC8', 'Cormorant Garamond', 'stars'),
    T('belle', 'Белль', 'Красавица и чудовище', 'film', 'light', '#FFF9EE', '#C99A1E', '#2E5E8C', 'Cormorant Garamond', 'stars'),
    T('rapunzel', 'Рапунцель', 'Рапунцель', 'film', 'light', '#FBF5FF', '#8E5AC8', '#E9B530', 'Comfortaa', 'dots'),
    T('eleven', 'Одиннадцать', 'Очень странные дела', 'film', 'dark', '#0D0B0F', '#E2283B', '#E9C59A', 'JetBrains Mono', 'grid'),
    T('daenerys', 'Дейенерис Таргариен', 'Игра престолов', 'film', 'dark', '#0F0D0E', '#C8323A', '#D9D3C8', 'Cormorant Garamond', 'waves'),
    T('aang', 'Аанг', 'Аватар: Легенда об Аанге', 'film', 'light', '#F4F7FB', '#E8762F', '#3A86C8', 'Comfortaa', 'waves'),

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
    T('zhongli', 'Чжун Ли', 'Genshin Impact', 'game', 'dark', '#120E0A', '#D9A441', '#6B4E2E', 'Cormorant Garamond', 'diamond'),
    T('venti', 'Венти', 'Genshin Impact', 'game', 'light', '#F2F8F4', '#2E8B7A', '#E9B530', 'Comfortaa', 'waves'),
    T('furina', 'Фурина', 'Genshin Impact', 'game', 'light', '#F2F6FC', '#3A6EC8', '#B8C4D8', 'Cormorant Garamond', 'waves'),
    T('firefly', 'Светлячок', 'Honkai: Star Rail', 'game', 'dark', '#0B1012', '#5CC8B0', '#E8762F', 'Unbounded', 'stars'),
    T('tifa', 'Тифа Локхарт', 'Final Fantasy VII', 'game', 'dark', '#100D0E', '#C8323A', '#9AA6B8', 'Unbounded', 'check'),
    T('cloud', 'Клауд Страйф', 'Final Fantasy VII', 'game', 'dark', '#0B0E14', '#6FB0E8', '#9AA6B8', 'Unbounded', 'grid'),
    T('dva', 'D.Va', 'Overwatch', 'game', 'light', '#FFF4F9', '#E2649A', '#3A86C8', 'Unbounded', 'check'),
    T('ahri', 'Ари', 'League of Legends', 'game', 'dark', '#120B12', '#E2649A', '#D9B76B', 'Cormorant Garamond', 'stars'),
    T('lara', 'Лара Крофт', 'Tomb Raider', 'game', 'dark', '#110F0B', '#4F8F5A', '#C98B4A', 'Unbounded', 'stripes'),
    T('ellie', 'Элли', 'The Last of Us', 'game', 'dark', '#0D100D', '#7DA06A', '#C98B4A', 'Unbounded', 'rain'),
    T('zelda', 'Принцесса Зельда', 'The Legend of Zelda', 'game', 'light', '#F6F5FB', '#2E5EAA', '#C9A74A', 'Cormorant Garamond', 'diamond'),
    T('peach', 'Принцесса Пич', 'Super Mario', 'game', 'light', '#FFF4F8', '#D81B80', '#E9B530', 'Comfortaa', 'stars'),
    T('mario', 'Марио', 'Super Mario', 'game', 'light', '#FFF6F2', '#D7263D', '#2E5EAA', 'Unbounded', 'dots'),
  ];

  const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  const get = (id) => byId[id] || byId.classic;
  const has = (id) => !!byId[id];

  // Свои персонажи участников: тема из фото их косплея (id начинается с «my-»)
  const FONTS = ['Unbounded', 'Cormorant Garamond', 'Yeseva One', 'Comfortaa', 'JetBrains Mono'];
  const PATTERNS = ['dots', 'stars', 'diamond', 'check', 'stripes', 'grid', 'rain', 'waves', 'rings', 'stitch'];
  function add(d) {
    const t = Object.assign(
      T(d.id, d.name, d.from || '', d.cat || '', d.mode === 'light' ? 'light' : 'dark', d.bg, d.accent, d.accent2,
        FONTS.includes(d.font) ? d.font : 'Unbounded', PATTERNS.includes(d.pattern) ? d.pattern : 'dots'),
      { custom: true, photo: d.photo || null, by: d.by || null, status: d.status || 'private', mine: !!d.mine, raw: d });
    const i = THEMES.findIndex((x) => x.id === t.id);
    if (i >= 0) THEMES[i] = t; else THEMES.push(t);
    byId[t.id] = t;
    return t;
  }
  function remove(id) {
    const i = THEMES.findIndex((x) => x.id === id && x.custom);
    if (i >= 0) THEMES.splice(i, 1);
    if (byId[id]?.custom) delete byId[id];
  }
  // Последний выбранный свой персонаж хранится в браузере, чтобы тема включалась сразу, ещё до загрузки с сервера
  try { const c = JSON.parse(localStorage.getItem('cg-custom') || 'null'); if (c && /^my-[a-z0-9]+$/.test(c.id || '')) add(c); } catch {}

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

  window.CG = { THEMES, CATS, FONTS, PATTERNS, get, has, add, remove, apply, vars, styleAttr, pattern, stored, store, hexA, contrast, mix, lum };
  apply(stored() || 'classic');
})();
