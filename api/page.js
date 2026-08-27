module.exports = async function (req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // plain /api/page returns nothing useful
  if (!req.query.id) {
    res.status(200).send("Telegram Utils - add a page id");
    return;
  }

  let text = "";
  try {
    text = Buffer.from(req.query.id, "base64").toString("utf-8");
  } catch (e) {
    text = "";
  }
  if (!text) text = "Страница не найдена";

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Telegram Utils</title>
<style>
body {
  margin: 0;
  padding: 0;
  background-color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.page {
  color: #ffffff;
  font-size: 22px;
  text-align: center;
  padding: 40px;
  max-width: 600px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}
</style>
</head>
<body>
<div class="page">${escaped}</div>
</body>
</html>`;

  res.status(200).send(html);
};
