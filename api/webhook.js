const BOT_TOKEN = "8951253222:AAFzQy0a7hl-u9U1j2wkMeT2GZX6XRBDtcc";

// Owner Telegram user id
const OWNER_ID = 6476497036;
// Access system: owner always has access; others need an active key
const ACCESS_ENABLED = true;


const KEY_PLANS = {
  "1h": { label: "1 час", ms: 3600000 },
  "1d": { label: "1 день", ms: 86400000 },
  "7d": { label: "7 дней", ms: 604800000 },
  "30d": { label: "30 дней", ms: 2592000000 },
  "1y": { label: "1 год", ms: 31536000000 },
  "custom": { label: "Свой срок", ms: 0 }
};

const LANGUAGES = {
  ru: "Русский", en: "English", uk: "Українська",
  de: "Deutsch", fr: "Français", es: "Español",
  it: "Italiano", pt: "Português", zh: "中文",
  ja: "日本語", ko: "한국어", ar: "العربية",
  tr: "Türkçe", pl: "Polski", nl: "Nederlands",
  hi: "हिन्दी", kk: "Қазақша", uz: "O'zbekcha"
};

const TZ_CITIES = {
  "Москва": "Europe/Moscow", "Лондон": "Europe/London", "Нью-Йорк": "America/New_York",
  "Токио": "Asia/Tokyo", "Пекин": "Asia/Shanghai", "Париж": "Europe/Paris",
  "Берлин": "Europe/Berlin", "Дубай": "Asia/Dubai", "Бангкок": "Asia/Bangkok",
  "Сеул": "Asia/Seoul", "Каир": "Africa/Cairo", "Сидней": "Australia/Sydney",
  "Лос-Анджелес": "America/Los_Angeles", "Санкт-Петербург": "Europe/Moscow",
  "Киев": "Europe/Kiev", "Астана": "Asia/Almaty", "Минск": "Europe/Minsk",
  "Стамбул": "Europe/Istanbul", "Рим": "Europe/Rome", "Мадрид": "Europe/Madrid"
};

const userState = {};
const userData = {};
const userPageBg = {};
const userBmi = {};

function getState(uid) { return userState[uid] || null; }
function setState(uid, state) { userState[uid] = state; }
function clearState(uid) { delete userState[uid]; }
function getData(uid) { if (!userData[uid]) userData[uid] = { src: "auto", dst: "ru" }; return userData[uid]; }

async function tg(method, payload) {
  try {
    await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function send(chatId, text, rm) {
  const p = { chat_id: chatId, text: text, parse_mode: "Markdown" };
  if (rm) p.reply_markup = JSON.stringify(rm);
  await tg("sendMessage", p);
}

async function edit(chatId, msgId, text, rm) {
  const p = { chat_id: chatId, message_id: msgId, text: text, parse_mode: "Markdown" };
  if (rm) p.reply_markup = JSON.stringify(rm);
  await tg("editMessageText", p);
}

async function answer(id, text, alert) {
  const p = { callback_query_id: id, text: text || "" };
  if (alert) p.show_alert = true;
  await tg("answerCallbackQuery", p);
}

// ─── STORAGE (in-memory) ───
const db = { owner: OWNER_ID, keys: {}, users: {} };

const GIST_ID = "eaa711e6e3cec707dae00d41e8a0ed3b";
const GIST_FILE = "db.json";

async function gistFetch(url, options) {
  const gh = process.env.GH_TOKEN;
  const res = await fetch(url, Object.assign({}, options || {}, {
    headers: Object.assign({
      "Authorization": "Bearer " + gh,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    }, (options || {}).headers || {})
  }), { signal: AbortSignal.timeout(12000) });
  return res;
}

let _loaded = false;
async function loadDb() {
  if (_loaded) return db;
  try {
    const gh = process.env.GH_TOKEN;
    if (!gh) return db;
    const res = await gistFetch("https://api.github.com/gists/" + GIST_ID);
    if (!res.ok) return db;
    const g = await res.json();
    const raw = (g.files && g.files[GIST_FILE] && g.files[GIST_FILE].content) || "";
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      db.keys = parsed.keys || {};
      db.users = parsed.users || {};
    }
    _loaded = true;
  } catch (e) {
    console.error("loadDb error", e && e.message);
  }
  return db;
}

let _saveBusy = false;
let _lastSave = 0;
let _willSave = null;
async function saveDb() {
  try {
    const gh = process.env.GH_TOKEN;
    if (!gh) {
      try { await tg("sendMessage", { chat_id: OWNER_ID, text: "⚠️ saveDb: GH_TOKEN пуст" }); } catch (e) {}
      return;
    }
    // throttle heavy writes: at most once every 5 seconds, coalescing pending ones
    const now = Date.now();
    if (now - _lastSave < 5000) {
      if (!_willSave) {
        _willSave = setTimeout(function () { _willSave = null; saveDb(); }, 5000 - (now - _lastSave));
      }
      return;
    }
    if (_saveBusy) return;
    _saveBusy = true;
    _lastSave = now;
    const body = JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(db) } } });
    const res = await gistFetch("https://api.github.com/gists/" + GIST_ID, { method: "PATCH", body: body });
    _saveBusy = false;
    if (!res.ok) {
      let txt = "❌ saveDb HTTP " + res.status;
      try { const j = await res.json(); txt += ": " + (j && j.message ? j.message : ""); } catch (e) {}
      try { await tg("sendMessage", { chat_id: OWNER_ID, text: txt }); } catch (e) {}
      console.error("saveDb failed", res.status);
    }
  } catch (e) {
    _saveBusy = false;
    let txt = "❌ saveDb error: " + (e && e.message ? e.message : String(e));
    try { await tg("sendMessage", { chat_id: OWNER_ID, text: txt }); } catch (e2) {}
    console.error("saveDb error", e && e.message);
  }
}

function isOwner(uid) {
  return OWNER_ID === uid;
}

function genKeyCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let k = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) k += "-";
    k += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return k;
}

function activeUntil(uid) {
  const u = db && db.users && db.users[uid];
  if (!u) return 0;
  if (u.expires > Date.now()) return u.expires;
  return 0;
}

// keys: { code: { plan, label, expires (ms), days, usedBy, usedAt, active } }
function createKey(planKey, label, customDays) {
  if (!db) return null;
  const plan = KEY_PLANS[planKey];
  if (!plan) return null;
  let code = genKeyCode();
  while (db.keys[code]) code = genKeyCode();
  const now = Date.now();
  let expires = 0;
  if (planKey !== "custom") expires = now + plan.ms;
  db.keys[code] = { plan: planKey, label: label || plan.label, expires: expires, days: customDays || 0, createdAt: now, usedBy: null, usedAt: null, active: true };
  return code;
}

function createKey2(planKey, label, customDays) {
  return createKey(planKey, label, customDays);
}

function activateKey(code, uid, username) {
  if (!db) return { ok: false, reason: "err" };
  const k = db.keys[code.toUpperCase()];
  if (!k) return { ok: false, reason: "notfound" };
  if (k.usedBy && k.usedBy !== uid) return { ok: false, reason: "used" };
  const now = Date.now();
  // custom keys: expires set on activation
  if (k.plan === "custom") {
    const days = k.days || 1;
    k.expires = now + days * 86400000;
  }
  if (k.expires && k.expires < now) return { ok: false, reason: "expired" };
  k.usedBy = uid;
  k.usedAt = now;
  k.username = username || "";
  db.users[uid] = { expires: (k.expires || (now + 86400000)), plan: k.plan, label: k.label };
  return { ok: true, until: db.users[uid].expires };
}

// ─── TRANSLATE ───
async function translate(text, src, dst) {
  try {
    const sl = src === "auto" ? "auto" : src;
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + dst + "&dt=t&q=" + encodeURIComponent(text);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    if (data && data[0]) return data[0].map(function(p) { return p[0]; }).join("");
  } catch (e) {}
  try {
    const url2 = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + (src === "auto" ? "en" : src) + "|" + dst;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(8000) });
    const data2 = await res2.json();
    if (data2.responseData && data2.responseData.translatedText) return data2.responseData.translatedText;
  } catch (e2) {}
  return "Oшибка перевода";
}

// ─── CURRENCY ───
const FX_CACHE = { at: 0, rates: null };
const FX_NAMES = { USD: "Доллар", EUR: "Евро", RUB: "Рубль", KZT: "Тенге", GBP: "Фунт", CNY: "Юань", UAH: "Гривна", JPY: "Йена" };

async function getFxRates() {
  if (FX_CACHE.rates && (Date.now() - FX_CACHE.at < 6 * 60 * 60 * 1000)) return FX_CACHE.rates;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const r = data.rates || {};
    const rates = {};
    Object.keys(FX_NAMES).forEach(function(c) { rates[c] = r[c] || null; });
    FX_CACHE.rates = rates;
    FX_CACHE.at = Date.now();
    return rates;
  } catch (e) {
    return FX_CACHE.rates;
  }
}

async function showRates(chatId, msgId) {
  const rates = await getFxRates();
  if (!rates) {
    const kb = { inline_keyboard: [[{ text: "Повторить", callback_data: "util_rates" }, { text: "Назад", callback_data: "back_main" }]] };
    return edit(chatId, msgId, "💱 Не удалось получить курс. Попробуй позже.", kb);
  }
  const rub = rates.RUB;
  const kzt = rates.KZT;
  let txt = "💱 *Курс валют* (к 1 USD)\n\n";
  ["EUR", "RUB", "KZT", "GBP", "CNY", "UAH", "JPY"].forEach(function(c) {
    if (rates[c]) txt += FX_NAMES[c] + " (" + c + "): `" + rates[c].toFixed(2) + "`\n";
  });
  if (rub && kzt) {
    txt += "\n🇷🇺 За 1 USD — *" + rub.toFixed(2) + " ₽*\n";
    txt += "🇰🇿 За 1 USD — *" + kzt.toFixed(2) + " ₸*\n";
  }
  const kb = { inline_keyboard: [[{ text: "🔄 Обновить", callback_data: "util_rates" }, { text: "Назад", callback_data: "back_main" }]] };
  return edit(chatId, msgId, txt, kb);
}

// ─── WEATHER ───
async function getWeather(city) {
  try {
    const url = "https://wttr.in/" + encodeURIComponent(city) + "?format=j1&lang=ru";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    const cur = data.current_condition && data.current_condition[0];
    const area = data.nearest_area && data.nearest_area[0];
    if (!cur) return null;
    const today = data.weather && data.weather[0];
    let forecast = null;
    if (data.weather) {
      forecast = data.weather.map(function(w) {
        const d = new Date(w.date);
        const wd = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][d.getDay()];
        let cond = "—";
        if (w.hourly) { const h = w.hourly.find(function(x){ return x.weatherDesc; }); if (h && h.weatherDesc && h.weatherDesc[0]) cond = h.weatherDesc[0].value; }
        return { day: wd, cond: cond, tmin: w.mintempC, tmax: w.maxtempC };
      });
    }
    return {
      city: city,
      temp: Math.round(cur.temp_C),
      feels: Math.round(cur.FeelsLikeC),
      cond: cur.lang_ru && cur.lang_ru[0] ? cur.lang_ru[0].value : (cur.weatherDesc && cur.weatherDesc[0] ? cur.weatherDesc[0].value : "—"),
      humidity: cur.humidity,
      wind: cur.windspeedKmph,
      forecast: forecast ? forecast.slice(0, 4) : null
    };
  } catch (e) {
    return null;
  }
}

// ─── HOLIDAYS ───
const HOLIDAYS = {
  "01-01": ["Новый год", "День ели"],
  "01-07": ["Рождество Христово"],
  "02-14": ["День Святого Валентина", "День всех влюблённых"],
  "02-23": ["День защитника Отечества"],
  "03-08": ["Международный женский день"],
  "03-21": ["Наурыз (Новый год по восточному календарю)"],
  "04-01": ["День смеха"],
  "05-01": ["Праздник весны и труда"],
  "05-09": ["День Победы"],
  "06-01": ["День защиты детей"],
  "06-12": ["День России"],
  "09-01": ["День знаний"],
  "10-05": ["День учителя"],
  "10-31": ["Хэллоуин"],
  "11-04": ["День народного единства"],
  "12-25": ["Рождество (католическое)"],
  "12-31": ["Канун Нового года"],
  "03-22": ["Всемирный день воды"],
  "03-20": ["День Земли"],
  "04-22": ["Международный день Земли"],
  "02-19": ["Всемирный день китов"]
};

async function getHolidays(dd, mm) {
  const key = String(dd).padStart(2, "0") + "-" + String(mm).padStart(2, "0");
  const base = HOLIDAYS[key] || [];
  return base;
}

// ─── WEATHER REGIONS ───
const WEATHER_MAP = {
  "Россия": {
    "Московская обл.": ["Москва", "Подольск", "Химки"],
    "Санкт-Петербург": ["Санкт-Петербург", "Пушкин", "Петрозаводск"],
    "Татарстан": ["Казань", "Набережные Челны", "Альметьевск"],
    "Свердловская обл.": ["Екатеринбург", "Нижний Тагил", "Каменск-Уральский"],
    "Новосибирская обл.": ["Новосибирск", "Бердск", "Искитим"],
    "Нижегородская обл.": ["Нижний Новгород", "Арзамас", "Дзержинск"],
    "Краснодарский край": ["Краснодар", "Сочи", "Новороссийск"],
    "Ростовская обл.": ["Ростов-на-Дону", "Таганрог", "Шахты"],
    "Челябинская обл.": ["Челябинск", "Магнитогорск", "Златоуст"],
    "Самарская обл.": ["Самара", "Тольятти", "Сызрань"],
    "Пермский край": ["Пермь", "Березники", "Соликамск"]
  },
  "Казахстан": {
    "г. Алматы": ["Алматы"],
    "г. Астана": ["Астана"],
    "г. Шымкент": ["Шымкент"],
    "Карагандинская": ["Караганда", "Темиртау", "Балхаш"],
    "Актюбинская": ["Актобе"],
    "Павлодарская": ["Павлодар", "Экибастуз"]
  },
  "Украина": {
    "г. Киев": ["Киев"],
    "Харьковская": ["Харьков"],
    "Одесская": ["Одесса"],
    "Днепропетровская": ["Днепр", "Кривой Рог"],
    "Львовская": ["Львов"]
  },
  "Беларусь": {
    "г. Минск": ["Минск"],
    "Минская обл.": ["Борисов", "Солигорск", "Молодечно"],
    "Гомельская обл.": ["Гомель", "Мозырь", "Речица"],
    "Брестская обл.": ["Брест", "Барановичи", "Пинск"],
    "Витебская обл.": ["Витебск", "Орша", "Полоцк"],
    "Гродненская обл.": ["Гродно", "Лида", "Слоним"],
    "Могилёвская обл.": ["Могилёв", "Бобруйск", "Горки"]
  },
  "Германия": { "Регионы": ["Берлин", "Мюнхен", "Гамбург", "Франкфурт"] },
  "Франция": { "Регионы": ["Париж", "Ницца", "Лион"] },
  "Италия": { "Регионы": ["Рим", "Милан", "Венеция"] },
  "Испания": { "Регионы": ["Мадрид", "Барселона", "Валенсия"] },
  "Турция": { "Регионы": ["Стамбул", "Анталья", "Анкара"] },
  "Великобритания": { "Регионы": ["Лондон", "Манчестер", "Ливерпуль"] },
  "США": { "Регионы": ["Нью-Йорк", "Лос-Анджелес", "Майами", "Чикаго"] },
  "Китай": { "Регионы": ["Пекин", "Шанхай", "Гуанчжоу"] },
  "Япония": { "Регионы": ["Токио", "Осака"] },
  "ОАЭ": { "Регионы": ["Дубай", "Абу-Даби"] }
};

// ─── KEYBOARDS ───
function mainKb(uid) {
  const s = getData(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  const kb = { inline_keyboard: [
    [{ text: "🌐 Переводчик", callback_data: "tr_menu" }],
    [{ text: "📝 " + srcL, callback_data: "tr_src" }, { text: "🔄 " + dstL, callback_data: "tr_dst" }],
    [{ text: "💱 Поменять языки", callback_data: "tr_swap" }],
    [{ text: "──── Утилиты ────", callback_data: "noop" }],
    [{ text: "🎲 Случайное число", callback_data: "util_random" },
     { text: "🧮 Калькулятор", callback_data: "util_calc" }],
    [{ text: "🔐 Пароль", callback_data: "util_pass" },
     { text: "📊 Счётчик", callback_data: "util_count" }],
    [{ text: "📏 Конвертер", callback_data: "util_convert" },
     { text: "💱 Курс валют", callback_data: "util_rates" }],
    [{ text: "🕐 Часы", callback_data: "util_time" },
     { text: "📱 Проверка номера", callback_data: "util_number" }],
    [{ text: "🌤 Погода", callback_data: "util_weather" },
     { text: "📅 Праздники дня", callback_data: "util_holidays" }],
    [{ text: "🔲 QR-код", callback_data: "util_qr" },
     { text: "🖤 Стиль-страница", callback_data: "util_page" }],
    [{ text: "⚖️ BMI", callback_data: "util_bmi" },
     { text: "🪞 Переворот текста", callback_data: "util_flip" }]
  ]};
  if (isOwner(uid)) {
    kb.inline_keyboard.push([{ text: "──── Кнопки ────", callback_data: "noop" }]);
    kb.inline_keyboard.push([{ text: "👑 Админ панель", callback_data: "adm_menu" }]);
  }
  return kb;
}

function langKb(isSrc) {
  const pf = isSrc ? "set_src_" : "set_dst_";
  const btns = [[{ text: "Автоопределение", callback_data: pf + "auto" }]];
  const codes = Object.keys(LANGUAGES);
  for (let i = 0; i < codes.length; i += 2) {
    const row = [{ text: LANGUAGES[codes[i]], callback_data: pf + codes[i] }];
    if (i + 1 < codes.length) row.push({ text: LANGUAGES[codes[i+1]], callback_data: pf + codes[i+1] });
    btns.push(row);
  }
  btns.push([{ text: "Назад", callback_data: "back_main" }]);
  return { inline_keyboard: btns };
}

function backKb() { return { inline_keyboard: [[{ text: "Назад", callback_data: "back_main" }]] }; }

function weatherCountryKb() {
  const kb = { inline_keyboard: [] };
  const countries = Object.keys(WEATHER_MAP);
  let row = [];
  for (let i = 0; i < countries.length; i++) {
    row.push({ text: countries[i], callback_data: "wc" + i });
    if (row.length === 2) { kb.inline_keyboard.push(row); row = []; }
  }
  if (row.length) kb.inline_keyboard.push(row);
  kb.inline_keyboard.push([{ text: "Назад", callback_data: "back_main" }]);
  return kb;
}

function weatherRegionKb(countryIdx) {
  const kb = { inline_keyboard: [] };
  const country = Object.keys(WEATHER_MAP)[countryIdx] || "";
  const regions = Object.keys(WEATHER_MAP[country] || {});
  let row = [];
  for (let i = 0; i < regions.length; i++) {
    row.push({ text: regions[i], callback_data: "wr" + countryIdx + "_" + i });
    if (row.length === 2) { kb.inline_keyboard.push(row); row = []; }
  }
  if (row.length) kb.inline_keyboard.push(row);
  kb.inline_keyboard.push([{ text: "← Страна", callback_data: "weat_back_country" }, { text: "Назад", callback_data: "back_main" }]);
  return kb;
}

function weatherCityKb(countryIdx, regionIdx) {
  const kb = { inline_keyboard: [] };
  const country = Object.keys(WEATHER_MAP)[countryIdx] || "";
  const region = Object.keys(WEATHER_MAP[country] || {})[regionIdx] || "";
  const cities = (WEATHER_MAP[country] && WEATHER_MAP[country][region]) || [];
  let row = [];
  for (let i = 0; i < cities.length; i++) {
    row.push({ text: cities[i], callback_data: "wt" + i + "_" + countryIdx + "_" + regionIdx });
    if (row.length === 2) { kb.inline_keyboard.push(row); row = []; }
  }
  if (row.length) kb.inline_keyboard.push(row);
  kb.inline_keyboard.push([{ text: "← Регион", callback_data: "wc" + countryIdx }, { text: "Назад", callback_data: "back_main" }]);
  return kb;
}

function weatherCityName(countryIdx, regionIdx, cityIdx) {
  const country = Object.keys(WEATHER_MAP)[countryIdx] || "";
  const region = Object.keys(WEATHER_MAP[country] || {})[regionIdx] || "";
  const cities = (WEATHER_MAP[country] && WEATHER_MAP[country][region]) || [];
  return cities[cityIdx] || "";
}

async function weatherResult(chatId, msgId, city) {
  const today = await getWeather(city);
  if (!today) {
    const kb = { inline_keyboard: [[{ text: "← К городам", callback_data: "weat_back_country" }, { text: "Назад", callback_data: "back_main" }]] };
    return edit(chatId, msgId, "Город не найден или сервис недоступен.", kb);
  }
  let txt = "🌤 *" + today.city + "*\n\n";
  txt += "🌡 Температура: *" + today.temp + "°C* (ощущается " + today.feels + "°C)\n";
  txt += "☁️ " + today.cond + "\n";
  txt += "💧 Влажность: " + today.humidity + "%\n";
  txt += "💨 Ветер: " + today.wind + " м/с\n";
  if (today.forecast) {
    txt += "\n📅 *Прогноз:*\n";
    today.forecast.forEach(function(f) {
      txt += f.day + ": " + f.cond + ", " + f.tmin + "° — " + f.tmax + "°\n";
    });
  }
  const kb = { inline_keyboard: [[{ text: "← К городам", callback_data: "weat_back_country" }, { text: "Назад", callback_data: "back_main" }]] };
  return edit(chatId, msgId, txt, kb);
}

function fmtRemaining(ms) {
  if (!ms || ms <= 0) return "—";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  let part = [];
  if (d > 0) part.push(d + " дн");
  if (h > 0) part.push(h + " ч");
  part.push(m + " мин");
  return part.join(", ");
}

function mainText(uid) {
  const s = getData(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  let txt = "Telegram Utils\n\n🌐 Переводчик: " + srcL + " -> " + dstL + "\n\nОтправь текст для перевода или выбери утилиту:";
  const until = activeUntil(uid);
  if (until) {
    txt += "\n\n⏳ *Осталось:* " + fmtRemaining(until - Date.now());
  }
  return txt;
}

function deniedText() {
  return "🚫 *Доступ к боту ограничен*\n\nЧтобы получить доступ, напиши владельцу: @Xomka132";
}

function accessDeniedKb() {
  return { inline_keyboard: [[
    { text: "🔓 Я КУПИЛ", callback_data: "redeem_start" }
  ]]};
}

function ownerKb() {
  return { inline_keyboard: [
    [{ text: "🔑 Создать ключ", callback_data: "adm_key" }],
    [{ text: "📊 Статистика", callback_data: "adm_stats" }],
    [{ text: "➖ Главное меню", callback_data: "back_main" }]
  ]};
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── CALLBACKS ───
async function onCallback(cb) {
  if (!cb || !cb.message) return;
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const uid = cb.from.id;
  const data = cb.data;

  answer(cb.id, "");

  // Redeem flow
  if (data === "redeem_start") {
    clearState(uid);
    setState(uid, "wait_redeem");
    return edit(chatId, msgId, "🔓 Введи твой код доступа.\n\nОн выглядит так: `ABCD-EFGH-JKLM`", backKb());
  }

  const allowed = isOwner(uid) || (ACCESS_ENABLED && !!activeUntil(uid));
  // Access gate: block utility callbacks for non-authorized users
  if (!allowed) {
    answer(cb.id, "Доступ ограничен. Напиши @Xomka132", true);
    return;
  }

  // ─── ADMIN (owner only) ───
  if (isOwner(uid)) {
    if (data === "adm_key") {
      const kb = { inline_keyboard: [] };
      const plans = Object.keys(KEY_PLANS);
      let row = [];
      for (let i = 0; i < plans.length; i++) {
        const lbl = plans[i] === "custom" ? "⚙️ Свой срок" : plans[i] + " · " + KEY_PLANS[plans[i]].label;
        row.push({ text: KEY_PLANS[plans[i]].label, callback_data: "adm_plan_" + plans[i] });
        if (row.length === 2) { kb.inline_keyboard.push(row); row = []; }
      }
      if (row.length) kb.inline_keyboard.push(row);
      kb.inline_keyboard.push([{ text: "← Назад", callback_data: "adm_menu" }]);
      return edit(chatId, msgId, "🔑 *Создать ключ*\n\nВыбери срок действия:", kb);
    }
    if (data.startsWith("adm_plan_")) {
      const plan = data.replace("adm_plan_", "");
      setState(uid, "adm_plan_" + plan);
      if (plan === "custom") {
        return edit(chatId, msgId, "⚙️ Введи срок в днях (целое число):", backKb());
      }
      const code = createKey(plan, KEY_PLANS[plan].label);
      await saveDb();
      const until = plan !== "custom" ? fmtDate(db.keys[code].expires) : "— (при активации)";
      const kb = { inline_keyboard: [[{ text: "➕ Ещё один такой же", callback_data: "adm_plan_" + plan }], [{ text: "🔑 Новый (другой срок)", callback_data: "adm_key" }], [{ text: "← В меню", callback_data: "adm_menu" }]] };
      return edit(chatId, msgId, "🔑 *Ключ создан!*\n\n`" + code + "`\n\n📅 Действует до: *" + until + "*\n\nОтправь этот код покупателю.", kb);
    }
    if (data === "adm_stats") {
      const keys = Object.keys(db.keys);
      const total = keys.length;
      const used = keys.filter(function(k){ return db.keys[k].usedBy; }).length;
      const users = Object.keys(db.users).length;
      let txt = "📊 *Статистика*\n\n";
      txt += "🔑 Создано ключей: *" + total + "*\n";
      txt += "✅ Использовано: *" + used + "*\n";
      txt += "👤 Пользователей: *" + users + "*\n";
      const kb = { inline_keyboard: [[{ text: "← В меню", callback_data: "adm_menu" }]] };
      return edit(chatId, msgId, txt, kb);
    }
    if (data === "adm_menu") {
      clearState(uid);
      return edit(chatId, msgId, "👑 *Панель владельца*\n\nЧто сделать?", ownerKb());
    }
  }

  // translator
  if (data === "tr_menu") {
    clearState(uid);
    return edit(chatId, msgId, mainText(uid), mainKb(uid));
  }
  if (data === "back_main") {
    clearState(uid);
    return edit(chatId, msgId, mainText(uid), mainKb(uid));
  }
  if (data === "noop") { return; }
  if (data === "tr_src") {
    return edit(chatId, msgId, "Выбери исходный язык:", langKb(true));
  }
  if (data === "tr_dst") {
    return edit(chatId, msgId, "Выбери язык перевода:", langKb(false));
  }
  if (data === "tr_swap") {
    const s = getData(uid);
    if (s.src === "auto") { answer(cb.id, "Нельзя при автоопределении", true); return; }
    s.dst = s.src; s.src = "auto";
    return edit(chatId, msgId, mainText(uid), mainKb(uid));
  }
  if (data.startsWith("set_src_")) {
    const code = data.replace("set_src_", "");
    getData(uid).src = code;
    return edit(chatId, msgId, mainText(uid), mainKb(uid));
  }
  if (data.startsWith("set_dst_")) {
    const code = data.replace("set_dst_", "");
    getData(uid).dst = code;
    return edit(chatId, msgId, mainText(uid), mainKb(uid));
  }

  // utilities
  if (data === "util_random") {
    setState(uid, "wait_random");
    return edit(chatId, msgId, "🎲 Введи диапазон:\n\nПример: `1 100` или `-10 10`", backKb());
  }
  if (data === "util_calc") {
    setState(uid, "wait_calc");
    return edit(chatId, msgId, "🧮 Введи выражение:\n\nПример: `2 + 2 * 3`", backKb());
  }
  if (data === "util_pass") {
    setState(uid, "wait_pass");
    return edit(chatId, msgId, "🔐 Введи длину пароля:\n\nПример: `16`", backKb());
  }
  if (data === "util_count") {
    setState(uid, "wait_count");
    return edit(chatId, msgId, "📊 Отправь текст для подсчёта:", backKb());
  }
  if (data === "util_convert") {
    const kb = { inline_keyboard: [
      [{ text: "Длина", callback_data: "conv_len" }, { text: "Вес", callback_data: "conv_wt" }],
      [{ text: "Температура", callback_data: "conv_tmp" }, { text: "💱 Валюта", callback_data: "conv_cur" }],
      [{ text: "Назад", callback_data: "back_main" }]
    ]};
    return edit(chatId, msgId, "📏 Выбери тип конвертации:", kb);
  }
  if (data === "conv_len") {
    setState(uid, "wait_conv_len");
    return edit(chatId, msgId, "📏 Введи значение и единицы:\n\nПример: `100 км в мили`\nДоступно: км, м, см, мм, мили, ярды, футы, дюймы", backKb());
  }
  if (data === "conv_wt") {
    setState(uid, "wait_conv_wt");
    return edit(chatId, msgId, "⚖️ Введи значение и единицы:\n\nПример: `70 кг в фунты`\nДоступно: кг, г, фунты, унции", backKb());
  }
  if (data === "conv_tmp") {
    setState(uid, "wait_conv_tmp");
    return edit(chatId, msgId, "🌡 Введи температуру:\n\nПример: `36.6 C в F` или `0 F в C`", backKb());
  }
  if (data === "conv_cur") {
    setState(uid, "wait_conv_cur");
    return edit(chatId, msgId, "💱 Введи сумму и валюты:\n\nПример: `100 USD в RUB`\n\nВалюты: USD, EUR, RUB, KZT, GBP, CNY, UAH, JPY", backKb());
  }
  if (data === "util_rates") {
    return showRates(chatId, msgId);
  }
  if (data === "util_number") {
    setState(uid, "wait_number");
    return edit(chatId, msgId, "📱 Введи номер телефона в международном формате:\n\nПример: `+79261234567` или `77051234567`", backKb());
  }
  if (data === "util_weather") {
    clearState(uid);
    return edit(chatId, msgId, "🌤 *Погода*\n\nВыбери страну:", weatherCountryKb());
  }
  if (data.startsWith("wc")) {
    const countryIdx = parseInt(data.slice(2), 10);
    if (isNaN(countryIdx)) return;
    const country = Object.keys(WEATHER_MAP)[countryIdx] || "";
    return edit(chatId, msgId, "🌤 *" + country + "*\n\nВыбери регион:", weatherRegionKb(countryIdx));
  }
  if (data.startsWith("wr")) {
    const parts = data.slice(2).split("_");
    const countryIdx = parseInt(parts[0], 10);
    const regionIdx = parseInt(parts[1], 10);
    if (isNaN(countryIdx) || isNaN(regionIdx)) return;
    const country = Object.keys(WEATHER_MAP)[countryIdx] || "";
    const region = Object.keys(WEATHER_MAP[country] || {})[regionIdx] || "";
    return edit(chatId, msgId, "🌤 *" + region + "*\n\nВыбери город:", weatherCityKb(countryIdx, regionIdx));
  }
  if (data.startsWith("wt")) {
    const parts = data.slice(2).split("_");
    const cityIdx = parseInt(parts[0], 10);
    const countryIdx = parseInt(parts[1], 10);
    const regionIdx = parseInt(parts[2], 10);
    if (isNaN(cityIdx) || isNaN(countryIdx) || isNaN(regionIdx)) return;
    const city = weatherCityName(countryIdx, regionIdx, cityIdx);
    if (!city) return;
    clearState(uid);
    return weatherResult(chatId, msgId, city);
  }
  if (data === "weat_back_country") {
    clearState(uid);
    return edit(chatId, msgId, "🌤 *Погода*\n\nВыбери страну:", weatherCountryKb());
  }
  if (data === "util_holidays") {
    setState(uid, "wait_holidays");
    return edit(chatId, msgId, "📅 Введи дату в формате `ДД.ММ` или просто отправь `.` для сегодняшнего дня:", backKb());
  }
  if (data === "util_time") {
    const kb = { inline_keyboard: [] };
    const cities = Object.keys(TZ_CITIES);
    for (let i = 0; i < cities.length; i += 2) {
      const row = [{ text: cities[i], callback_data: "tz_" + cities[i] }];
      if (i + 1 < cities.length) row.push({ text: cities[i+1], callback_data: "tz_" + cities[i+1] });
      kb.inline_keyboard.push(row);
    }
    kb.inline_keyboard.push([{ text: "⏰ Дата / обратный отсчёт", callback_data: "util_reminder" }]);
    kb.inline_keyboard.push([{ text: "Назад", callback_data: "back_main" }]);
    return edit(chatId, msgId, "🕐 Выбери город:", kb);
  }
  if (data === "util_reminder") {
    setState(uid, "wait_reminder");
    return edit(chatId, msgId, "⏰ Введи дату в формате `ДД.ММ.ГГГГ` или `ДД.ММ.ГГГГ 12:30`:\n\nНапример: `25.12.2026`", backKb());
  }
  if (data === "util_qr") {
    setState(uid, "wait_qr");
    return edit(chatId, msgId, "🔲 Введи текст или ссылку для QR-кода:", backKb());
  }
  if (data === "util_page") {
    const kb = { inline_keyboard: [
      [{ text: "⬛ Чёрный", callback_data: "pagebg_000000" }, { text: "⬜ Белый", callback_data: "pagebg_ffffff" }],
      [{ text: "🟥 Красный", callback_data: "pagebg_8e0000" }, { text: "🟦 Синий", callback_data: "pagebg_003399" }],
      [{ text: "🟩 Зелёный", callback_data: "pagebg_006600" }, { text: "🟪 Фиолетовый", callback_data: "pagebg_4b0082" }],
      [{ text: "🟧 Оранжевый", callback_data: "pagebg_cc5500" }, { text: "🟫 Серый", callback_data: "pagebg_333333" }],
      [{ text: "Назад", callback_data: "back_main" }]
    ]};
    return edit(chatId, msgId, "🖤 *Стиль-страница*\n\nВыбери цвет фона:", kb);
  }
  if (data.startsWith("pagebg_")) {
    const bg = data.replace("pagebg_", "");
    setState(uid, "wait_page");
    userPageBg[uid] = bg;
    return edit(chatId, msgId, "🖤 Введи текст для страницы:\n\nЦвет: `#" + bg + "`\n\nОтправь текст:", backKb());
  }
  if (data === "util_bmi") {
    const kb = { inline_keyboard: [
      [{ text: "👨 Мужчина", callback_data: "bmisex_m" }, { text: "👩 Женщина", callback_data: "bmisex_f" }],
      [{ text: "Назад", callback_data: "back_main" }]
    ]};
    return edit(chatId, msgId, "⚖️ *BMI калькулятор*\n\nВыбери пол:", kb);
  }
  if (data === "bmisex_m" || data === "bmisex_f") {
    const sex = data === "bmisex_m" ? "m" : "f";
    setState(uid, "wait_bmi_age");
    userPageBg[uid] = sex;
    return edit(chatId, msgId, "⚖️ Введи возраст (лет):", backKb());
  }
  if (data === "util_myid") {
    const u = cb.from;
    const txt =
      "🆔 *Твои данные:*\n\n" +
      "👤 Имя: " + (u.first_name || "—") + "\n" +
      "🧑 Фамилия: " + (u.last_name || "—") + "\n" +
      "🔗 Username: " + (u.username ? "@" + u.username : "—") + "\n" +
      "🆔 User ID: `" + u.id + "`\n" +
      "💬 Язык: " + (u.language_code || "—") +
      "\n\nСкинь друзьям!";
    return edit(chatId, msgId, txt, backKb());
  }
  if (data === "util_flip") {
    setState(uid, "wait_flip");
    return edit(chatId, msgId, "🪞 Введи текст для переворота:", backKb());
  }
  if (data.startsWith("tz_")) {
    const city = data.replace("tz_", "");
    const tz = TZ_CITIES[city];
    if (!tz) return;
    const now = new Date();
    const time = now.toLocaleTimeString("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
    const date = now.toLocaleDateString("ru-RU", { timeZone: tz, day: "numeric", month: "long", year: "numeric" });
    return edit(chatId, msgId, "🕐 *" + city + "*\n\n⏰ " + time + "\n📅 " + date, backKb());
  }
}

// ─── MESSAGES ───
async function onMessage(msg) {
  if (!msg || !msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id;
  const uid = msg.from.id;
  const text = msg.text || "";
  const st = getState(uid);

  // Redeem state: user sends a key code
  if (st === "wait_redeem") {
    clearState(uid);
    const code = text.trim();
    if (!code) return send(chatId, "Введи код доступа.", accessDeniedKb());
    const r = activateKey(code, uid, msg.from.username || "");
    if (!r.ok) {
      let m = "❌ Код неверный или уже использован.";
      if (r.reason === "notfound") m = "❌ Такого кода нет. Проверь написание.";
      else if (r.reason === "used") m = "❌ Этот код уже использован другим пользователем.";
      else if (r.reason === "expired") m = "❌ Этот код истёк.";
      return send(chatId, m, accessDeniedKb());
    }
    await saveDb();
    const rem = fmtRemaining(r.until - Date.now());
    return send(chatId, "🔓 *Доступ открыт!*\n\n⏳ Осталось: *" + rem + "*\n\nДобро пожаловать!", mainKb(uid));
  }

  // Admin: custom key duration input (owner)
  if (st === "adm_plan_custom") {
    clearState(uid);
    if (!isOwner(uid)) return send(chatId, "Нет доступа.", accessDeniedKb());
    const days = parseInt(text);
    if (!days || days < 1 || days > 3650) return send(chatId, "Введи количество дней (1-3650):", backKb());
    const code = createKey2("custom", "custom " + days + " дн", days);
    await saveDb();
    const until = fmtDate(db.keys[code].expires);
    const kb = { inline_keyboard: [[{ text: "🔑 Новый ключ", callback_data: "adm_key" }], [{ text: "← В меню", callback_data: "adm_menu" }]] };
    return send(chatId, "🔑 *Ключ создан (свой срок: " + days + " дн)!*\n\n`" + code + "`\n\nДействует с активации до: *" + until + "*\n\nОтправь этот код покупателю.", kb);
  }

  const allowed = isOwner(uid) || (ACCESS_ENABLED && !!activeUntil(uid));

  // Access gate for non-owner without active subscription
  if (!allowed && text !== "/start" && text !== "/myid") {
    return send(chatId, deniedText(), accessDeniedKb());
  }

  if (text === "/start") {
    clearState(uid);
    if (isOwner(uid) || activeUntil(uid)) {
      return send(chatId, mainText(uid), mainKb(uid));
    }
    // no access -> /start shows access
    return send(chatId, deniedText(), accessDeniedKb());
  }

  if (text === "/myid" || text.startsWith("/myid ")) {
    clearState(uid);
    const u = msg.from;
    return send(chatId,
      "🆔 *Твои данные:*\n\n" +
      "👤 Имя: " + (u.first_name || "—") + "\n" +
      "🧑 Фамилия: " + (u.last_name || "—") + "\n" +
      "🔗 Username: " + (u.username ? "@" + u.username : "—") + "\n" +
      "🆔 User ID: `" + u.id + "`\n" +
      "💬 Язык: " + (u.language_code || "—") +
      "\n\nСкинь друзьям!", mainKb(uid));
  }

  if (!st) {
    // default: translate
    if (text && !text.startsWith("/")) {
      const s = getData(uid);
      const t = await translate(text, s.src === "auto" ? "auto" : s.src, s.dst);
      const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
      const dstL = LANGUAGES[s.dst] || s.dst;
      return send(chatId, "🌐 " + srcL + " -> " + dstL + "\n\n" + t, mainKb(uid));
    }
    return;
  }

  // random
  if (st === "wait_random") {
    clearState(uid);
    try {
      const parts = text.split(/[\s,]+/).map(Number);
      const min = Math.min(parts[0], parts[1]);
      const max = Math.max(parts[0], parts[1]);
      const result = Math.floor(Math.random() * (max - min + 1)) + min;
      return send(chatId, "🎲 *" + result + "*\n\n(" + min + " - " + max + ")", mainKb(uid));
    } catch (e) {
      return send(chatId, "Формат: `1 100`", mainKb(uid));
    }
  }

  // calculator
  if (st === "wait_calc") {
    clearState(uid);
    try {
      const expr = text.replace(/[^0-9+\-*/.() ]/g, "");
      if (!expr) throw new Error();
      const result = Function('"use strict"; return (' + expr + ')')();
      return send(chatId, "🧮 *" + result + "*", mainKb(uid));
    } catch (e) {
      return send(chatId, "Неверное выражение", mainKb(uid));
    }
  }

  // password
  if (st === "wait_pass") {
    clearState(uid);
    const len = parseInt(text);
    if (!len || len < 4 || len > 100) {
      return send(chatId, "Длина от 4 до 100", mainKb(uid));
    }
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < len; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return send(chatId, "🔐 `" + pass + "`\n\n(" + len + " символов)", mainKb(uid));
  }

  // counter
  if (st === "wait_count") {
    clearState(uid);
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(function(w) { return w.length > 0; }).length;
    const lines = text.split("\n").length;
    const noSpaces = text.replace(/\s/g, "").length;
    return send(chatId,
      "📊 *Результат*\n\n" +
      "Символов: " + chars + "\n" +
      "Без пробелов: " + noSpaces + "\n" +
      "Слов: " + words + "\n" +
      "Строк: " + lines, mainKb(uid));
  }

  // QR code
  if (st === "wait_qr") {
    clearState(uid);
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + encodeURIComponent(text);
    await tg("sendPhoto", { chat_id: chatId, photo: qrUrl, caption: "QR-код для: " + text.substring(0, 100) });
    await send(chatId, "", mainKb(uid));
    return;
  }

  // link maker removed

  // style page
  if (st === "wait_page") {
    clearState(uid);
    const bg = userPageBg[uid] || "000000";
    delete userPageBg[uid];
    const pageId = Buffer.from(text).toString("base64").replace(/=+$/, "");
    const url = "https://translator-bot-v2-six.vercel.app/api/page?id=" + encodeURIComponent(pageId) + "&bg=" + bg;
    await send(chatId, "🖤 *Стиль-страница готова!*\n\n📄 *Текст:*\n" + text.substring(0, 200) + "\n\n🎨 *Фон:* #" + bg + "\n\n🔗 *Ссылка:*\n" + url + "\n\nПерейди по ссылке!", mainKb(uid));
    return;
  }

  // BMI age
  if (st === "wait_bmi_age") {
    const age = parseInt(text);
    if (!age || age < 5 || age > 120) return send(chatId, "Введи возраст от 5 до 120:", backKb());
    userBmi[uid] = { sex: userPageBg[uid] || "m", age: age };
    delete userPageBg[uid];
    setState(uid, "wait_bmi");
    return send(chatId, "📏 Теперь введи вес и рост:\n\nПример: `70 175` (кг и см)", backKb());
  }

  // BMI
  if (st === "wait_bmi") {
    clearState(uid);
    const bmiData = userBmi[uid] || {};
    delete userBmi[uid];
    const parts = text.replace(",", ".").split(/[\s,]+/).map(Number);
    const kg = parts[0];
    const cm = parts[1];
    if (!kg || !cm || kg < 20 || kg > 300 || cm < 50 || cm > 250) {
      return send(chatId, "Формат: `70 175` (вес в кг, рост в см)", mainKb(uid));
    }
    const m = cm / 100;
    const bmi = kg / (m * m);
    const sexLabel = bmiData.sex === "m" ? "👨 Мужчина" : "👩 Женщина";
    let category;
    if (bmi < 18.5) category = "⚠️ Недостаточный вес";
    else if (bmi < 25) category = "✅ Норма";
    else if (bmi < 30) category = "⚠️ Избыточный вес";
    else category = "🔴 Ожирение";
    return send(chatId,
      "⚖️ *Результат BMI*\n\n" +
      sexLabel + "\n" +
      "🎂 Возраст: " + (bmiData.age || "—") + " лет\n" +
      "📏 Вес: " + kg + " кг\n" +
      "📐 Рост: " + cm + " см\n\n" +
      "🧮 **BMI: " + bmi.toFixed(1) + "**\n" +
      "📊 " + category, mainKb(uid));
  }

  // flip text
  if (st === "wait_flip") {
    clearState(uid);
    const flipped = text.split("").reverse().join("");
    return send(chatId, "🪞 *Перевёрнутый текст:*\n\n" + flipped, mainKb(uid));
  }

  // converter length
  if (st === "wait_conv_len") {
    clearState(uid);
    try {
      const match = text.match(/([\d.,]+)\s*(\S+)\s+в\s+(\S+)/i);
      if (!match) throw new Error();
      const val = parseFloat(match[1].replace(",", "."));
      const from = match[2].toLowerCase();
      const to = match[3].toLowerCase();
      const toM = { "км": 1000, "km": 1000, "м": 1, "m": 1, "см": 0.01, "cm": 0.01, "мм": 0.001, "mm": 0.001, "мили": 1609.344, "миля": 1609.344, "miles": 1609.344, "ярды": 0.9144, "yard": 0.9144, "ярд": 0.9144, "футы": 0.3048, "фут": 0.3048, "ft": 0.3048, "foot": 0.3048, "дюймы": 0.0254, "дюйм": 0.0254, "in": 0.0254, "inch": 0.0254 };
      if (!toM[from] || !toM[to]) throw new Error();
      const result = (val * toM[from] / toM[to]);
      return send(chatId, "📏 *" + val + " " + match[2] + "* = *" + result.toFixed(4) + " " + match[3] + "*", mainKb(uid));
    } catch (e) {
      return send(chatId, "Формат: `100 км в мили`\nДоступно: км, м, см, мм, мили, ярды, футы, дюймы", mainKb(uid));
    }
  }

  // converter weight
  if (st === "wait_conv_wt") {
    clearState(uid);
    try {
      const match = text.match(/([\d.,]+)\s*(\S+)\s+в\s+(\S+)/i);
      if (!match) throw new Error();
      const val = parseFloat(match[1].replace(",", "."));
      const from = match[2].toLowerCase();
      const to = match[3].toLowerCase();
      const toKg = { "кг": 1, "kg": 1, "г": 0.001, "g": 0.001, "фунты": 0.453592, "фунт": 0.453592, "lbs": 0.453592, "lb": 0.453592, "унции": 0.0283495, "унция": 0.0283495, "oz": 0.0283495 };
      if (!toKg[from] || !toKg[to]) throw new Error();
      const result = (val * toKg[from] / toKg[to]);
      return send(chatId, "⚖️ *" + val + " " + match[2] + "* = *" + result.toFixed(4) + " " + match[3] + "*", mainKb(uid));
    } catch (e) {
      return send(chatId, "Формат: `70 кг в фунты`\nДоступно: кг, г, фунты, унции", mainKb(uid));
    }
  }

  // converter temp
  if (st === "wait_conv_tmp") {
    clearState(uid);
    try {
      const match = text.match(/([\d.,]+)\s*(C|F|K)\s+в\s*(C|F|K)/i);
      if (!match) throw new Error();
      const val = parseFloat(match[1].replace(",", "."));
      const from = match[2].toUpperCase();
      const to = match[3].toUpperCase();
      let celsius;
      if (from === "C") celsius = val;
      else if (from === "F") celsius = (val - 32) * 5 / 9;
      else celsius = val - 273.15;
      let result;
      if (to === "C") result = celsius;
      else if (to === "F") result = celsius * 9 / 5 + 32;
      else result = celsius + 273.15;
      return send(chatId, "🌡 *" + val + " " + from + "* = *" + result.toFixed(2) + " " + to + "*", mainKb(uid));
    } catch (e) {
      return send(chatId, "Формат: `36.6 C в F` или `0 F в C`", mainKb(uid));
    }
  }

  // converter currency
  if (st === "wait_conv_cur") {
    clearState(uid);
    try {
      const match = text.match(/([\d.,]+)\s*([A-Za-z]{3})\s+в\s+([A-Za-z]{3})/i);
      if (!match) throw new Error();
      const val = parseFloat(match[1].replace(",", "."));
      const from = match[2].toUpperCase();
      const to = match[3].toUpperCase();
      if (!FX_NAMES[from] || !FX_NAMES[to]) throw new Error();
      const rates = await getFxRates();
      if (!rates || !rates[from] || !rates[to]) throw new Error();
      const result = val * rates[to] / rates[from];
      return send(chatId, "💱 *" + val + " " + FX_NAMES[from] + " (" + from + ")* = *" + result.toFixed(2) + " " + FX_NAMES[to] + " (" + to + ")*", mainKb(uid));
    } catch (e) {
      return send(chatId, "Формат: `100 USD в RUB`\n\nВалюты: USD, EUR, RUB, KZT, GBP, CNY, UAH, JPY", mainKb(uid));
    }
  }

  // number check
  if (st === "wait_number") {
    clearState(uid);
    const digits = text.replace(/[^\d+]/g, "");
    if (!/^\+\d{7,15}$|^\d{10,15}$/.test(digits)) {
      return send(chatId, "Введи номер в формате `+79261234567` или `77051234567`", mainKb(uid));
    }
    let country = "—";
    if (/^(\+7|8|7)/.test(digits)) country = "🇷🇺 Россия (или Казахстан)";
    else if (/^\+380|^0/.test(digits)) country = "🇺🇦 Украина";
    else if (/^\+375/.test(digits)) country = "🇧🇾 Беларусь";
    else if (/^\+49/.test(digits)) country = "🇩🇪 Германия";
    else if (/^\+44/.test(digits)) country = "🇬🇧 Великобритания";
    else if (/^\+1/.test(digits)) country = "🇺🇸 США/Канада";
    else if (/^\+33/.test(digits)) country = "🇫🇷 Франция";
    else if (/^\+86/.test(digits)) country = "🇨🇳 Китай";
    else if (/^\+34/.test(digits)) country = "🇪🇸 Испания";
    else if (/^\+90/.test(digits)) country = "🇹🇷 Турция";
    else if (/^\+972/.test(digits)) country = "🇮🇱 Израиль";
    else if (/^\+998/.test(digits)) country = "🇺🇿 Узбекистан";
    let operator = "—";
    if (/^(\+7|8|7)[9]\d/.test(digits)) operator = "📶 Мобильный (РФ)";
    const beaut = digits.length >= 10 ? digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7, 9) + " " + digits.slice(9, 11) + " " + digits.slice(11) : digits;
    return send(chatId, "📱 *Проверка номера*\n\n🔢 Номер: `" + beaut + "`\n🌍 Страна: " + country + "\n📶 Тип: " + operator, mainKb(uid));
  }

  // reminder / countdown
  if (st === "wait_reminder") {
    clearState(uid);
    const m = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return send(chatId, "Формат: `25.12.2026` или `25.12.2026 12:30`", mainKb(uid));
    const target = new Date(m[3], m[2] - 1, m[1], m[4] || 0, m[5] || 0, 0);
    const now = new Date();
    const diff = target - now;
    if (diff < 0) return send(chatId, "Эта дата уже прошла", mainKb(uid));
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const dateStr = m[1] + "." + m[2] + "." + m[3] + (m[4] ? " " + m[4] + ":" + m[5] : "");
    let remaining;
    if (days > 0) remaining = days + " дн " + hours + " ч " + mins + " мин";
    else if (hours > 0) remaining = hours + " ч " + mins + " мин";
    else remaining = mins + " мин";
    const wd = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][target.getDay()];
    return send(chatId, "⏰ *До даты:* " + dateStr + " (" + wd + ")\n\n⏳ Осталось: *" + remaining + "*", mainKb(uid));
  }

  // holidays
  if (st === "wait_holidays") {
    clearState(uid);
    let dd, mm;
    if (text === ".") {
      const now = new Date();
      dd = now.getDate(); mm = now.getMonth() + 1;
    } else {
      const m = text.match(/(\d{1,2})[.\/](\d{1,2})/);
      if (!m) return send(chatId, "Формат: `08.03` или отправь `.` для сегодня", mainKb(uid));
      dd = parseInt(m[1]); mm = parseInt(m[2]);
      if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return send(chatId, "Некорректная дата", mainKb(uid));
    }
    const padded = String(dd).padStart(2, "0") + "-" + String(mm).padStart(2, "0");
    const hol = await getHolidays(dd, mm);
    let txt = "📅 *Праздники " + String(dd).padStart(2, "0") + "." + String(mm).padStart(2, "0") + "*\n\n";
    if (hol && hol.length) {
      hol.forEach(function(h) { txt += "🎉 " + h + "\n"; });
    } else {
      txt += "В этот день праздников не найдено 😔";
    }
    return send(chatId, txt, mainKb(uid));
  }
}

// ─── HANDLER ───
const WH_SECRET = "tg-secret-p9k2n7x4";
const WH_URL = "https://translator-bot-v2-six.vercel.app/api/webhook";

async function ensureWebhook() {
  try {
    const info = await (await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/getWebhookInfo", { signal: AbortSignal.timeout(8000) })).json();
    const u = info && info.result && info.result.url;
    if (u !== WH_URL) {
      await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/setWebhook?url=" + encodeURIComponent(WH_URL) + "&secret_token=" + WH_SECRET, { signal: AbortSignal.timeout(8000) });
    }
  } catch (e) {}
}

module.exports = async function (req, res) {
  const body = req.body || {};
  try {
    const header = req.headers["x-telegram-bot-api-secret-token"];
    if (header !== WH_SECRET) {
      res.status(403).json({ ok: false, error: "unauthorized" });
      return;
    }
    await loadDb();
    if (!process.env.GH_TOKEN && !global.__diagSent) {
      global.__diagSent = true;
      try { await tg("sendMessage", { chat_id: OWNER_ID, text: "⚠️ GH_TOKEN отсутствует в окружении Vercel. Ключи не сохраняются!" }); } catch (e) {}
    }
    if (body.message && body.message.text === "/start") {
      try {
        await tg("setMyCommands", {
          commands: [
            { command: "start", description: "Главное меню" },
            { command: "myid", description: "Мои данные" }
          ]
        });
      } catch (e) {}
      // self-heal the webhook so it can't stay broken after a redeploy
      ensureWebhook();
    }
    if (body.message) await onMessage(body.message);
    if (body.callback_query) await onCallback(body.callback_query);
  } catch (e) {
    console.error(e);
  }
  res.json({ ok: true });
};
