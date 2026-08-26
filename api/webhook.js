const BOT_TOKEN = "8951253222:AAFzQy0a7hl-u9U1j2wkMeT2GZX6XRBDtcc";

const LANGUAGES = {
  ru: "Русский", en: "English", uk: "Українська",
  de: "Deutsch", fr: "Français", es: "Español",
  it: "Italiano", pt: "Português", zh: "中文",
  ja: "日本語", ko: "한국어", ar: "العربية",
  tr: "Türkçe", pl: "Polski", nl: "Nederlands",
  hi: "हिन्दी", kk: "Қазақша", uz: "O'zbekcha"
};

const userSettings = {};

function gs(uid) {
  if (!userSettings[uid]) userSettings[uid] = { src: "auto", dst: "ru" };
  return userSettings[uid];
}

async function tg(method, payload) {
  try {
    await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (e) {}
}

async function sendText(chatId, text, rm) {
  const p = { chat_id: chatId, text: text };
  if (rm) p.reply_markup = JSON.stringify(rm);
  await tg("sendMessage", p);
}

async function editMsg(chatId, msgId, text, rm) {
  const p = { chat_id: chatId, message_id: msgId, text: text };
  if (rm) p.reply_markup = JSON.stringify(rm);
  await tg("editMessageText", p);
}

async function answerCb(id, text, alert) {
  const p = { callback_query_id: id, text: text || "" };
  if (alert) p.show_alert = true;
  await tg("answerCallbackQuery", p);
}

async function translate(text, src, dst) {
  try {
    const sl = src === "auto" ? "auto" : src;
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + dst + "&dt=t&q=" + encodeURIComponent(text);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("fail");
    const data = await res.json();
    if (data && data[0]) return data[0].map(function(p) { return p[0]; }).join("");
  } catch (e1) {}
  try {
    const url2 = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + (src === "auto" ? "en" : src) + "|" + dst;
    const res2 = await fetch(url2, { signal: AbortSignal.timeout(8000) });
    const data2 = await res2.json();
    if (data2.responseData && data2.responseData.translatedText) return data2.responseData.translatedText;
  } catch (e2) {}
  return "Oшибка перевода";
}

function mainText(uid) {
  const s = gs(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  return "Бот-переводчик\n\nС языка: " + srcL + "\nНа язык: " + dstL + "\n\nОтправь текст или перешли сообщение.";
}

function mainKb(uid) {
  const s = gs(uid);
  const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
  const dstL = LANGUAGES[s.dst] || s.dst;
  return { inline_keyboard: [
    [{ text: srcL, callback_data: "menu_src" }, { text: dstL, callback_data: "menu_dst" }],
    [{ text: "Поменять местами", callback_data: "swap_langs" }]
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

async function onMessage(msg) {
  if (!msg || !msg.from || msg.from.is_bot) return;
  const chatId = msg.chat.id;
  const uid = msg.from.id;
  const text = msg.text || "";

  if ((msg.forward_from || msg.forward_sender_name) && text && !text.startsWith("/")) {
    const s = gs(uid);
    const t = await translate(text, s.src === "auto" ? "auto" : s.src, s.dst);
    const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
    const dstL = LANGUAGES[s.dst] || s.dst;
    await sendText(chatId, srcL + " -> " + dstL + "\n\n" + t, mainKb(uid));
    return;
  }
  if (text === "/start") {
    await sendText(chatId, mainText(uid), mainKb(uid));
    return;
  }
  if (text && !text.startsWith("/")) {
    const s = gs(uid);
    const t = await translate(text, s.src === "auto" ? "auto" : s.src, s.dst);
    const srcL = s.src === "auto" ? "Авто" : (LANGUAGES[s.src] || s.src);
    const dstL = LANGUAGES[s.dst] || s.dst;
    await sendText(chatId, srcL + " -> " + dstL + "\n\n" + t, mainKb(uid));
  }
}

async function onCallback(cb) {
  if (!cb || !cb.message) return;
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const uid = cb.from.id;
  const data = cb.data;

  answerCb(cb.id, "");

  if (data === "back_main") { await editMsg(chatId, msgId, mainText(uid), mainKb(uid)); }
  else if (data === "menu_src") { await editMsg(chatId, msgId, "Выбери исходный язык:", langKb(true)); }
  else if (data === "menu_dst") { await editMsg(chatId, msgId, "Выбери язык перевода:", langKb(false)); }
  else if (data === "swap_langs") {
    const s = gs(uid);
    if (s.src === "auto") { answerCb(cb.id, "Нельзя", true); return; }
    s.dst = s.src; s.src = "auto";
    await editMsg(chatId, msgId, mainText(uid), mainKb(uid));
  }
  else if (data.startsWith("set_src_")) {
    userSettings[uid] = userSettings[uid] || { src: "auto", dst: "ru" };
    userSettings[uid].src = data.replace("set_src_", "");
    await editMsg(chatId, msgId, mainText(uid), mainKb(uid));
  }
  else if (data.startsWith("set_dst_")) {
    userSettings[uid] = userSettings[uid] || { src: "auto", dst: "ru" };
    userSettings[uid].dst = data.replace("set_dst_", "");
    await editMsg(chatId, msgId, mainText(uid), mainKb(uid));
  }
}

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
