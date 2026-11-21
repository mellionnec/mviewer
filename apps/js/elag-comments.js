/* elag-comments.js
 * Extension mviewer : commentaires partagés par parcelle (ELAG Mellionnec)
 * Stockage : Google Sheet "elag-commentaires" via un script Apps Script publié en Web App.
 * Voir docs/COMMENTAIRES-GOOGLE-SHEETS.md pour la mise en place.
 */
(function () {
  // ⚠️ À ADAPTER : URL de votre Web App Apps Script (déployée)
  var ELAG_API = "https://script.google.com/macros/s/AKfycbzLsMwF-nRrrr9u_k8vIKxgZorDhRPv30PEYcI2NvZu25_Gk-L-vb1pVZ673qpXr7ReVQ/exec";

  var commentsCache = null;

  function loadComments(force) {
    if (commentsCache && !force) return Promise.resolve(commentsCache);
    return fetch(ELAG_API)
      .then(function (r) { return r.json(); })
      .then(function (j) { commentsCache = j || { comments: {} }; return commentsCache; })
      .catch(function () { commentsCache = { comments: {} }; return commentsCache; });
  }

  window.elagShowComment = function (parc) {
    var div = document.getElementById("elag-cmt-" + parc);
    if (!div) return;
    loadComments(true).then(function (c) {
      var v = c.comments && c.comments[parc];
      div.textContent = v
        ? v.date.slice(0, 10) + " (" + v.author + ") : " + v.text
        : "(aucun commentaire enregistré pour cette parcelle)";
    });
  };

  window.elagSaveComment = function (parc, btn) {
    var block = btn.closest(".elag-cmt-block") || document;
    var ta = block.querySelector(".elag-cmt-input");
    var authorInput = block.querySelector(".elag-cmt-author");
    var status = block.querySelector(".elag-cmt-status");
    var text = (ta.value || "").trim();
    var author = ((authorInput && authorInput.value) || "").trim() || "anonyme";
    if (!text) { status.textContent = "Le commentaire est vide."; return; }
    btn.disabled = true;
    status.textContent = "Enregistrement...";
    // Content-Type texte brut volontaire : évite la requête CORS "preflight"
    // que les Web Apps Apps Script ne gèrent pas.
    fetch(ELAG_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ id: parc, text: text.slice(0, 500), author: author.slice(0, 50) })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || "erreur");
        if (!commentsCache) commentsCache = { comments: {} };
        commentsCache.comments[parc] = resp.comment;
        status.textContent = "Enregistré.";
        var div = document.getElementById("elag-cmt-" + parc);
        if (div && resp.comment) {
          div.textContent = resp.comment.date.slice(0, 10) + " (" + resp.comment.author + ") : " + resp.comment.text;
        }
        ta.value = "";
      })
      .catch(function (e) { status.textContent = "Erreur : " + e.message; })
      .finally(function () { btn.disabled = false; });
  };
})();
