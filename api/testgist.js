const gistId = "eaa711e6e3cec707dae00d41e8a0ed3b";
const gistFile = "db.json";
async function g(h) {
  const r = await fetch("https://api.github.com/gists/" + gistId, {
    method: "PATCH",
    headers: { "Authorization": "Bearer " + h, "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
    body: JSON.stringify({ files: { [gistFile]: { content: JSON.stringify({ ping: Date.now() }) } } })
  });
  return r.status;
}
module.exports = async function (req, res) {
  const h = process.env.GH_TOKEN;
  if (req.headers["x-tg-test"] !== "sek123") { res.status(403).json({ ok: false, why: "badsecret" }); return; }
  if (!h) { res.json({ ok: false, gh: "missing", len: 0 }); return; }
  const st = await g(h);
  res.json({ ok: true, gh: "present", len: h.length, gistStatus: st });
};