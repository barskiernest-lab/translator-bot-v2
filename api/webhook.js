const BOT_TOKEN = "8951253222:AAFzQy0a7hl-u9U1j2wkMeT2GZX6XRBDtcc";

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

// ─── KEYBOARDS ───
function mainKb(uid) {
  const s = getData(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  return { inline_keyboard: [
    [{ text: "🌐 Переводчик", callback_data: "tr_menu" }],
    [{ text: "📝 " + srcL, callback_data: "tr_src" }, { text: "🔄 " + dstL, callback_data: "tr_dst" }],
    [{ text: "💱 Поменять языки", callback_data: "tr_swap" }],
    [{ text: "──── Утилиты ────", callback_data: "noop" }],
    [{ text: "🎲 Случайное число", callback_data: "util_random" },
     { text: "🧮 Калькулятор", callback_data: "util_calc" }],
    [{ text: "🔐 Пароль", callback_data: "util_pass" },
     { text: "📊 Счётчик", callback_data: "util_count" }],
    [{ text: "📏 Конвертер", callback_data: "util_convert" },
     { text: "🕐 Часы", callback_data: "util_time" }],
    [{ text: "🔲 QR-код", callback_data: "util_qr" },
     { text: "🖤 Стиль-страница", callback_data: "util_page" }],
    [{ text: "⚖️ BMI", callback_data: "util_bmi" },
     { text: "🪞 Переворот текста", callback_data: "util_flip" }]
  ]};
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

function mainText(uid) {
  const s = getData(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  return "Telegram Utils\n\n🌐 Переводчик: " + srcL + " -> " + dstL + "\n\nОтправь текст для перевода или выбери утилиту:";
}

// ─── CALLBACKS ───
async function onCallback(cb) {
  if (!cb || !cb.message) return;
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const uid = cb.from.id;
  const data = cb.data;

  answer(cb.id, "");

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
      [{ text: "Температура", callback_data: "conv_tmp" }],
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
  if (data === "util_time") {
    const kb = { inline_keyboard: [] };
    const cities = Object.keys(TZ_CITIES);
    for (let i = 0; i < cities.length; i += 2) {
      const row = [{ text: cities[i], callback_data: "tz_" + cities[i] }];
      if (i + 1 < cities.length) row.push({ text: cities[i+1], callback_data: "tz_" + cities[i+1] });
      kb.inline_keyboard.push(row);
    }
    kb.inline_keyboard.push([{ text: "Назад", callback_data: "back_main" }]);
    return edit(chatId, msgId, "🕐 Выбери город:", kb);
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

  // translate forwarded
  if ((msg.forward_from || msg.forward_sender_name) && text && !text.startsWith("/")) {
    clearState(uid);
    const s = getData(uid);
    const t = await translate(text, s.src === "auto" ? "auto" : s.src, s.dst);
    const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
    const dstL = LANGUAGES[s.dst] || s.dst;
    return send(chatId, "🌐 " + srcL + " -> " + dstL + "\n\n" + t, mainKb(uid));
  }

  if (text === "/start") {
    clearState(uid);
    return send(chatId, mainText(uid), mainKb(uid));
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
}

// ─── HANDLER ───
module.exports = async function (req, res) {
  const body = req.body || {};
  try {
    if (body.message) await onMessage(body.message);
    if (body.callback_query) await onCallback(body.callback_query);
  } catch (e) {
    console.error(e);
  }
  res.json({ ok: true });
};
