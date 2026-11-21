/* elag-comments.js (Cloudflare Worker)
 * API d'écriture de commentaires (par parcelle) dans un fichier JSON du dépôt GitHub.
 * Secret à définir dans le Worker (Settings > Variables > Add secret) :
 *   GH_TOKEN = jeton GitHub "fine-grained" (mellionnec/mviewer, Contents: Read and write)
 * Déploiement rapide sans ligne de commande : dashboard Cloudflare > Workers > Create > coller ce code > Deploy.
 */
const REPO = "mellionnec/mviewer";
const FILE_PATH = "apps/data/comments.json";
const BRANCH = "main";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function api(path, opts, env) {
  return fetch("https://api.github.com/repos/" + REPO + path, Object.assign({
    headers: {
      "Authorization": "Bearer " + env.GH_TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "elag-comments-worker",
      "Content-Type": "application/json"
    }
  }, opts));
}

async function getComments() {
  const r = await api("/contents/" + FILE_PATH + "?ref=" + BRANCH + "&t=" + Date.now(), { method: "GET" }, envx());
  if (r.status === 404) return { comments: {} };
  if (!r.ok) throw new Error("Github " + r.status);
  const j = await r.json();
  return JSON.parse(atob(j.content.replace(/\n/g, "")));
}
let ENV = null;
function envx() { return ENV; }

async function putComments(comments, message, env) {
  const existing = await api("/contents/" + FILE_PATH + "?ref=" + BRANCH + "&t=" + Date.now(), { method: "GET" }, env).then(r => r.ok ? r.json() : null);
  const body = {
    message: message,
    content: btoa(JSON.stringify(comments, null, 2)),
    branch: BRANCH
  };
  if (existing) body.sha = existing.sha;
  const r = await api("/contents/" + FILE_PATH, { method: "PUT", body: JSON.stringify(body) }, env);
  if (!r.ok && r.status !== 201 && r.status !== 200) throw new Error("Github write " + r.status);
}

export default {
  async fetch(request, env) {
    ENV = env;
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/comments") {
        const c = await getComments();
        return new Response(JSON.stringify(c), { status: 200, headers: Object.assign({ "Cache-Control": "no-store" }, CORS) });
      }
      if (request.method === "POST" && url.pathname === "/comment") {
        const b = await request.json();
        const id = String(b.id || "");
        const text = String(b.text || "").slice(0, 500).trim();
        const author = String(b.author || "anonyme").slice(0, 50).trim() || "anonyme";
        if (!/^[0-9A-Z]{6,20}$/.test(id)) {
          return new Response(JSON.stringify({ ok: false, error: "identifiant invalide" }), { status: 400, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });
        }
        if (!text) {
          return new Response(JSON.stringify({ ok: false, error: "commentaire vide" }), { status: 400, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });
        }
        const c = await getComments();
        c.comments = c.comments || {};
        c.comments[id] = { text: text, author: author, date: new Date().toISOString() };
        await putComments(c, "Commentaire sur la parcelle " + id, env);
        return new Response(JSON.stringify({ ok: true, comment: c.comments[id] }), { status: 200, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });
      }
      return new Response("Not found", { status: 404, headers: CORS });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { status: 500, headers: Object.assign({ "Content-Type": "application/json" }, CORS) });
    }
  }
};
