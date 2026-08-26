const BOT_TOKEN = "8951253222:AAFzQy0a7hl-u9U1j2wkMeT2GZX6XRBDtcc";

const LANGUAGES = {
  ru: "Русский", en: "English", uk: "Українська",
  de: "Deutsch", fr: "Français", es: "Españол",
  it: "Italiano", pt: "Português", zh: "中文",
  ja: "日本語", ko: "한국어", ar: "العربية",
  tr: "Türkçe", pl: "Polski", nl: "Nederlands",
  hi: "हिन्दी", kk: "Қазақша", uz: "O'zbekcha"
};

const userSettings = {};

function getUserSettings(userId) {
  if (!userSettings[userId]) userSettings[userId] = { src: "auto", dst: "ru" };
  return userSettings[userId];
}

async function api(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function sendText(chatId, text, replyMarkup) {
  const p = { chat_id: chatId, text };
  if (replyMarkup) p.reply_markup = JSON.stringify(replyMarkup);
  return api("sendMessage", p);
}

async function editMessage(chatId, messageId, text, replyMarkup) {
  const p = { chat_id: chatId, message_id: messageId, text };
  if (replyMarkup) p.reply_markup = JSON.stringify(replyMarkup);
  return api("editMessageText", p);
}

async function answerCallbackQuery(id, text, showAlert) {
  const p = { callback_query_id: id, text: text || "" };
  if (showAlert) p.show_alert = true;
  return api("answerCallbackQuery", p);
}

async function translateText(text, src, dst) {
  try {
    const sl = src === "auto" ? "auto" : src;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${dst}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    return data[0].map(p => p[0]).join("") || "Oшибка перевода";
  } catch (e) {
    return "Oшибка: " + e.message;
  }
}

function buildMainText(userId) {
  const s = getUserSettings(userId);
  const srcLabel = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstLabel = LANGUAGES[s.dst] || s.dst;
  return "Бот-переводчик\n\nС языка: " + srcLabel + "\nНа язык: " + dstLabel + "\n\nОтправь текст или перешли сообщение.";
}

function mainMenuKeyboard(userId) {
  const s = getUserSettings(userId);
  const srcLabel = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstLabel = LANGUAGES[s.dst] || s.dst;
  return { inline_keyboard: [
    [{ text: srcLabel, callback_data: "menu_src" }, { text: dstLabel, callback_data: "menu_dst" }],
    [{ text: "Поменять местами", callback_data: "swap_langs" }]
  ]};
}

function langKeyboard(isSource) {
  const prefix = isSource ? "set_src_" : "set_dst_";
  const btns = [[{ text: "Автоопределение", callback_data: prefix + "auto" }]];
  const codes = Object.keys(LANGUAGES);
  for (let i = 0; i < codes.length; i += 2) {
    const row = [{ text: LANGUAGES[codes[i]], callback_data: prefix + codes[i] }];
    if (i + 1 < codes.length) row.push({ text: LANGUAGES[codes[i+1]], callback_data: prefix + codes[i+1] });
    btns.push(row);
  }
  btns.push([{ text: "Назад", callback_data: "back_main" }]);
  return { inline_keyboard: btns };
}

async function handleMessage(msg) {
  if (!msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || "";

  if ((msg.forward_from || msg.forward_sender_name) && text && !text.startsWith("/")) {
    const s = getUserSettings(userId);
    const src = s.src === "auto" ? "auto" : s.src;
    const translated = await translateText(text, src, s.dst);
    const srcLabel = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
    const dstLabel = LANGUAGES[s.dst] || s.dst;
    return sendText(chatId, srcLabel + " -> " + dstLabel + "\n\n" + translated, mainMenuKeyboard(userId));
  }

  if (text === "/start") {
    return sendText(chatId, "Бот-переводчик\n\nВыбери языки и отправь текст или перешли сообщение.", mainMenuKeyboard(userId));
  }

  if (text && !text.startsWith("/")) {
    const s = getUserSettings(userId);
    const src = s.src === "auto" ? "auto" : s.src;
    const translated = await translateText(text, src, s.dst);
    const srcLabel = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
    const dstLabel = LANGUAGES[s.dst] || s.dst;
    return sendText(chatId, srcLabel + " -> " + dstLabel + "\n\n" + translated, mainMenuKeyboard(userId));
  }
}

async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const userId = cb.from.id;
  const data = cb.data;

  answerCallbackQuery(cb.id, "");

  if (data === "back_main") {
    return editMessage(chatId, messageId, buildMainText(userId), mainMenuKeyboard(userId));
  }
  if (data === "menu_src") {
    return editMessage(chatId, messageId, "Выбери исходный язык:", langKeyboard(true));
  }
  if (data === "menu_dst") {
    return editMessage(chatId, messageId, "Выбери язык перевода:", langKeyboard(false));
  }
  if (data === "swap_langs") {
    const s = getUserSettings(userId);
    if (s.src === "auto") return answerCallbackQuery(cb.id, "Нельзя при автоопределении", true);
    s.dst = s.src;
    s.src = "auto";
    return editMessage(chatId, messageId, buildMainText(userId), mainMenuKeyboard(userId));
  }
  if (data.startsWith("set_src_")) {
    const code = data.replace("set_src_", "");
    userSettings[userId] = userSettings[userId] || { src: "auto", dst: "ru" };
    userSettings[userId].src = code;
    answerCallbackQuery(cb.id, "Источник: " + (code === "auto" ? "Авто" : (LANGUAGES[code] || code)));
    return editMessage(chatId, messageId, buildMainText(userId), mainMenuKeyboard(userId));
  }
  if (data.startsWith("set_dst_")) {
    const code = data.replace("set_dst_", "");
    userSettings[userId] = userSettings[userId] || { src: "auto", dst: "ru" };
    userSettings[userId].dst = code;
    answerCallbackQuery(cb.id, "На: " + (LANGUAGES[code] || code));
    return editMessage(chatId, messageId, buildMainText(userId), mainMenuKeyboard(userId));
  }
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ status: "ok" });
    return;
  }

  let body = {};
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    body = JSON.parse(raw);
  } catch (e) {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({ ok: true });
    return;
  }

  try {
    if (body.callback_query) {
      await handleCallback(body.callback_query);
    } else if (body.message) {
      await handleMessage(body.message);
    }
  } catch (err) {
    console.error("Handler error:", err);
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json({ ok: true });
};
