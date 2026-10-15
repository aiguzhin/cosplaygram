// Cosplaygram — страны. Общий список для сервера (require) и сайта (window.COUNTRIES).
// Код — ISO 3166-1 alpha-2, по нему же строится флаг и комната чата.
(function (root) {
  'use strict';
  const LIST = [
    // СНГ и Центральная Азия
    ['KZ', 'Казахстан'], ['RU', 'Россия'], ['UZ', 'Узбекистан'], ['KG', 'Кыргызстан'], ['TJ', 'Таджикистан'],
    ['TM', 'Туркменистан'], ['BY', 'Беларусь'], ['UA', 'Украина'], ['AZ', 'Азербайджан'], ['AM', 'Армения'],
    ['GE', 'Грузия'], ['MD', 'Молдова'], ['MN', 'Монголия'],
    // Азия
    ['JP', 'Япония'], ['KR', 'Южная Корея'], ['CN', 'Китай'], ['TW', 'Тайвань'], ['HK', 'Гонконг'],
    ['TH', 'Таиланд'], ['VN', 'Вьетнам'], ['PH', 'Филиппины'], ['ID', 'Индонезия'], ['MY', 'Малайзия'],
    ['SG', 'Сингапур'], ['IN', 'Индия'], ['TR', 'Турция'], ['AE', 'ОАЭ'], ['SA', 'Саудовская Аравия'],
    ['IL', 'Израиль'], ['IR', 'Иран'], ['PK', 'Пакистан'], ['BD', 'Бангладеш'],
    // Европа
    ['DE', 'Германия'], ['FR', 'Франция'], ['GB', 'Великобритания'], ['IT', 'Италия'], ['ES', 'Испания'],
    ['PT', 'Португалия'], ['NL', 'Нидерланды'], ['BE', 'Бельгия'], ['CH', 'Швейцария'], ['AT', 'Австрия'],
    ['PL', 'Польша'], ['CZ', 'Чехия'], ['SK', 'Словакия'], ['HU', 'Венгрия'], ['RO', 'Румыния'],
    ['BG', 'Болгария'], ['RS', 'Сербия'], ['HR', 'Хорватия'], ['GR', 'Греция'], ['SE', 'Швеция'],
    ['NO', 'Норвегия'], ['FI', 'Финляндия'], ['DK', 'Дания'], ['IE', 'Ирландия'], ['LT', 'Литва'],
    ['LV', 'Латвия'], ['EE', 'Эстония'],
    // Америка
    ['US', 'США'], ['CA', 'Канада'], ['MX', 'Мексика'], ['BR', 'Бразилия'], ['AR', 'Аргентина'],
    ['CL', 'Чили'], ['CO', 'Колумбия'], ['PE', 'Перу'],
    // Африка и Океания
    ['EG', 'Египет'], ['MA', 'Марокко'], ['ZA', 'ЮАР'], ['NG', 'Нигерия'], ['AU', 'Австралия'], ['NZ', 'Новая Зеландия'],
  ];
  const NAMES = Object.fromEntries(LIST);
  const flag = (code) => (/^[A-Z]{2}$/.test(code || '') ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍');
  const valid = (code) => (Object.prototype.hasOwnProperty.call(NAMES, String(code || '').toUpperCase()) ? String(code).toUpperCase() : '');
  const name = (code) => NAMES[code] || '';
  // Сортировка по алфавиту для выпадающих списков
  const sorted = () => [...LIST].sort((a, b) => a[1].localeCompare(b[1], 'ru'));

  // Догадка о стране по часовому поясу и языку браузера (только подсказка, человек может поменять)
  const TZ = {
    Almaty: 'KZ', Qostanay: 'KZ', Aqtobe: 'KZ', Aqtau: 'KZ', Atyrau: 'KZ', Oral: 'KZ', Qyzylorda: 'KZ',
    Moscow: 'RU', Yekaterinburg: 'RU', Novosibirsk: 'RU', Omsk: 'RU', Krasnoyarsk: 'RU', Irkutsk: 'RU', Vladivostok: 'RU',
    Samara: 'RU', Kaliningrad: 'RU', Yakutsk: 'RU', Magadan: 'RU', Kamchatka: 'RU', Volgograd: 'RU', Barnaul: 'RU',
    Tashkent: 'UZ', Samarkand: 'UZ', Bishkek: 'KG', Dushanbe: 'TJ', Ashgabat: 'TM', Minsk: 'BY', Kyiv: 'UA', Kiev: 'UA',
    Baku: 'AZ', Yerevan: 'AM', Tbilisi: 'GE', Chisinau: 'MD', Ulaanbaatar: 'MN', Tokyo: 'JP', Seoul: 'KR', Shanghai: 'CN',
    Taipei: 'TW', Hong_Kong: 'HK', Bangkok: 'TH', Ho_Chi_Minh: 'VN', Manila: 'PH', Jakarta: 'ID', Kuala_Lumpur: 'MY',
    Singapore: 'SG', Kolkata: 'IN', Istanbul: 'TR', Dubai: 'AE', Riyadh: 'SA', Jerusalem: 'IL', Tehran: 'IR',
    Berlin: 'DE', Paris: 'FR', London: 'GB', Rome: 'IT', Madrid: 'ES', Lisbon: 'PT', Amsterdam: 'NL', Brussels: 'BE',
    Zurich: 'CH', Vienna: 'AT', Warsaw: 'PL', Prague: 'CZ', Budapest: 'HU', Bucharest: 'RO', Sofia: 'BG', Belgrade: 'RS',
    Athens: 'GR', Stockholm: 'SE', Oslo: 'NO', Helsinki: 'FI', Copenhagen: 'DK', Dublin: 'IE', Vilnius: 'LT', Riga: 'LV',
    Tallinn: 'EE', Toronto: 'CA', Vancouver: 'CA', Mexico_City: 'MX', Sao_Paulo: 'BR', Buenos_Aires: 'AR', Santiago: 'CL',
    Bogota: 'CO', Lima: 'PE', Cairo: 'EG', Casablanca: 'MA', Johannesburg: 'ZA', Lagos: 'NG', Sydney: 'AU', Melbourne: 'AU',
    Auckland: 'NZ',
  };
  function guess() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const city = tz.split('/').pop();
      if (TZ[city]) return TZ[city];
      if (tz.startsWith('America/') && !/Mexico|Sao|Buenos|Santiago|Bogota|Lima|Toronto|Vancouver/.test(tz)) return 'US';
      const reg = (navigator.language || '').split('-')[1];
      return valid(reg);
    } catch { return ''; }
  }

  const api = { LIST, NAMES, flag, valid, name, sorted, guess };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.COUNTRIES = api;
})(typeof window !== 'undefined' ? window : globalThis);
