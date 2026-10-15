// Cosplaygram — язык интерфейса.
// Сайт написан на русском; на остальные языки страница переводится автоматически
// (Google Переводчик, ~110 языков). Выбор хранится в cookie googtrans и в localStorage.
(function () {
  'use strict';
  // [код Google, название на самом языке, название по-русски]
  const LANGS = [
    ['ru', 'Русский', 'русский'], ['en', 'English', 'английский'], ['kk', 'Қазақша', 'казахский'],
    ['uz', 'Oʻzbekcha', 'узбекский'], ['ky', 'Кыргызча', 'киргизский'], ['tg', 'Тоҷикӣ', 'таджикский'],
    ['tk', 'Türkmençe', 'туркменский'], ['az', 'Azərbaycanca', 'азербайджанский'], ['hy', 'Հայերեն', 'армянский'],
    ['ka', 'ქართული', 'грузинский'], ['be', 'Беларуская', 'белорусский'], ['uk', 'Українська', 'украинский'],
    ['mn', 'Монгол', 'монгольский'], ['tt', 'Татарча', 'татарский'], ['ba', 'Башҡортса', 'башкирский'],
    ['ja', '日本語', 'японский'], ['ko', '한국어', 'корейский'], ['zh-CN', '简体中文', 'китайский упрощённый'],
    ['zh-TW', '繁體中文', 'китайский традиционный'], ['th', 'ไทย', 'тайский'], ['vi', 'Tiếng Việt', 'вьетнамский'],
    ['id', 'Bahasa Indonesia', 'индонезийский'], ['ms', 'Bahasa Melayu', 'малайский'], ['tl', 'Filipino', 'филиппинский'],
    ['hi', 'हिन्दी', 'хинди'], ['bn', 'বাংলা', 'бенгальский'], ['ur', 'اردو', 'урду'], ['pa', 'ਪੰਜਾਬੀ', 'панджаби'],
    ['ta', 'தமிழ்', 'тамильский'], ['te', 'తెలుగు', 'телугу'], ['mr', 'मराठी', 'маратхи'], ['gu', 'ગુજરાતી', 'гуджарати'],
    ['kn', 'ಕನ್ನಡ', 'каннада'], ['ml', 'മലയാളം', 'малаялам'], ['si', 'සිංහල', 'сингальский'], ['ne', 'नेपाली', 'непальский'],
    ['my', 'မြန်မာ', 'бирманский'], ['km', 'ខ្មែរ', 'кхмерский'], ['lo', 'ລາວ', 'лаосский'],
    ['tr', 'Türkçe', 'турецкий'], ['ar', 'العربية', 'арабский'], ['fa', 'فارسی', 'персидский'], ['he', 'עברית', 'иврит'],
    ['ku', 'Kurdî', 'курдский'], ['ps', 'پښتو', 'пушту'], ['ug', 'ئۇيغۇرچە', 'уйгурский'],
    ['de', 'Deutsch', 'немецкий'], ['fr', 'Français', 'французский'], ['es', 'Español', 'испанский'],
    ['pt', 'Português', 'португальский'], ['it', 'Italiano', 'итальянский'], ['nl', 'Nederlands', 'нидерландский'],
    ['pl', 'Polski', 'польский'], ['cs', 'Čeština', 'чешский'], ['sk', 'Slovenčina', 'словацкий'],
    ['hu', 'Magyar', 'венгерский'], ['ro', 'Română', 'румынский'], ['bg', 'Български', 'болгарский'],
    ['sr', 'Српски', 'сербский'], ['hr', 'Hrvatski', 'хорватский'], ['bs', 'Bosanski', 'боснийский'],
    ['sl', 'Slovenščina', 'словенский'], ['mk', 'Македонски', 'македонский'], ['sq', 'Shqip', 'албанский'],
    ['el', 'Ελληνικά', 'греческий'], ['sv', 'Svenska', 'шведский'], ['no', 'Norsk', 'норвежский'],
    ['da', 'Dansk', 'датский'], ['fi', 'Suomi', 'финский'], ['is', 'Íslenska', 'исландский'],
    ['et', 'Eesti', 'эстонский'], ['lv', 'Latviešu', 'латышский'], ['lt', 'Lietuvių', 'литовский'],
    ['ga', 'Gaeilge', 'ирландский'], ['cy', 'Cymraeg', 'валлийский'], ['eu', 'Euskara', 'баскский'],
    ['ca', 'Català', 'каталанский'], ['gl', 'Galego', 'галисийский'], ['mt', 'Malti', 'мальтийский'],
    ['lb', 'Lëtzebuergesch', 'люксембургский'], ['fy', 'Frysk', 'фризский'], ['co', 'Corsu', 'корсиканский'],
    ['eo', 'Esperanto', 'эсперанто'], ['la', 'Latina', 'латынь'], ['yi', 'ייִדיש', 'идиш'],
    ['sw', 'Kiswahili', 'суахили'], ['am', 'አማርኛ', 'амхарский'], ['ha', 'Hausa', 'хауса'], ['yo', 'Yorùbá', 'йоруба'],
    ['ig', 'Igbo', 'игбо'], ['zu', 'isiZulu', 'зулу'], ['xh', 'isiXhosa', 'коса'], ['af', 'Afrikaans', 'африкаанс'],
    ['so', 'Soomaali', 'сомали'], ['mg', 'Malagasy', 'малагасийский'], ['rw', 'Kinyarwanda', 'руанда'],
    ['sn', 'chiShona', 'шона'], ['st', 'Sesotho', 'сесото'], ['ny', 'Chichewa', 'чева'],
    ['haw', 'ʻŌlelo Hawaiʻi', 'гавайский'], ['mi', 'Māori', 'маори'], ['sm', 'Gagana Samoa', 'самоанский'],
    ['ht', 'Kreyòl ayisyen', 'гаитянский креольский'], ['qu', 'Runasimi', 'кечуа'], ['gn', 'Avañeʼẽ', 'гуарани'],
    ['jv', 'Basa Jawa', 'яванский'], ['su', 'Basa Sunda', 'сунданский'], ['ceb', 'Cebuano', 'себуанский'],
    ['hmn', 'Hmoob', 'хмонг'], ['sd', 'سنڌي', 'синдхи'], ['or', 'ଓଡ଼ିଆ', 'ория'], ['as', 'অসমীয়া', 'ассамский'],
    ['dv', 'ދިވެހި', 'мальдивский'], ['cv', 'Чӑвашла', 'чувашский'], ['sah', 'Саха тыла', 'якутский'],
  ];
  const RTL = ['ar', 'fa', 'he', 'ur', 'ps', 'ug', 'yi', 'sd', 'dv', 'ku'];
  const known = (c) => LANGS.some(([k]) => k === c);
  const name = (c) => (LANGS.find(([k]) => k === c) || [, c])[1];

  function readCookie() {
    const m = /(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/.exec(document.cookie);
    return m ? decodeURIComponent(m[1]) : '';
  }
  function current() {
    const c = readCookie();
    return known(c) ? c : 'ru';
  }
  function writeCookie(value) {
    const host = location.hostname;
    const exp = value ? 'max-age=31536000' : 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const v = value ? `/ru/${value}` : '';
    document.cookie = `googtrans=${v};path=/;${exp}`;
    if (host.includes('.')) document.cookie = `googtrans=${v};path=/;domain=.${host};${exp}`;
  }
  function set(code) {
    try { localStorage.setItem('cg-lang', code); } catch {}
    writeCookie(code === 'ru' ? '' : code);
    location.reload();
  }

  // Первый визит: язык браузера, если он не русский и мы его знаем
  function autoDetect() {
    let chosen = null;
    try { chosen = localStorage.getItem('cg-lang'); } catch {}
    if (chosen || readCookie()) return;
    const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru']);
    for (const raw of prefs) {
      const l = String(raw);
      const code = /^zh/i.test(l) ? (/TW|HK|Hant/i.test(l) ? 'zh-TW' : 'zh-CN') : l.split('-')[0].toLowerCase();
      if (code === 'ru') return;
      if (known(code)) {
        try { localStorage.setItem('cg-lang', code); } catch {}
        writeCookie(code);
        return;
      }
    }
  }

  function start() {
    autoDetect();
    const lang = current();
    document.documentElement.dataset.lang = lang;
    if (lang === 'ru') return;
    document.documentElement.lang = lang;
    if (RTL.includes(lang)) document.documentElement.dir = 'rtl';
    window.cgTranslateInit = function () {
      try {
        new window.google.translate.TranslateElement({ pageLanguage: 'ru', autoDisplay: false }, 'gt-holder');
      } catch {}
    };
    const holder = document.createElement('div');
    holder.id = 'gt-holder';
    holder.hidden = true;
    (document.body || document.documentElement).appendChild(holder);
    const s = document.createElement('script');
    s.src = 'https://translate.google.com/translate_a/element.js?cb=cgTranslateInit';
    s.async = true;
    document.head.appendChild(s);
  }

  window.CGLang = { LANGS, RTL, current, set, name, known };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
