/* elag-comments.js
 * Extension mviewer : commentaires + statuts partagés par parcelle (ELAG Mellionnec)
 * Stockage : table Grist "Suivi_elagages_view" (doc public docs.getgrist.com bedv66Hzpg9e),
 * appel direct de l'API REST Grist (CORS ouvert, ecriture anonyme activee sur le doc).
 * Statuts : "proprio_ok" (vert), "visite" (orange), sinon rouge (a traiter).
 * La coloration des parcelles est faite par la couche customlayer "parc_statuts",
 * qui lit window.ELAG_STATUSES maintenu par cette extension.
 */
(function () {
  var GRIST_URL = "https://docs.getgrist.com/api/docs/bedv66Hzpg9e/tables/Suivi_elagages_view/records";

  var data = null; /* { comments: {parc:{author,date,text}}, statuses: {parc:"proprio_ok"|"visite"}, rowIds: {parc: idGrist} } */

  window.ELAG_STATUSES = window.ELAG_STATUSES || {};

  function loadData(force) {
    if (data && !force) return Promise.resolve(data);
    return fetch(GRIST_URL + "?limit=1000")
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var rows = j.records || [];
        var comments = {};
        var statuses = {};
        var rowIds = {};
        rows.forEach(function (r) {
          var f = r.fields || {};
          var p = String(f.parcelle || "").trim();
          if (!p) { return; }
          var txt = String(f.commentaire || "").trim();
          if (txt) {
            /* la derniere ligne (id le plus eleve) gagne : historique preserve */
            comments[p] = {
              author: String(f.auteur || "anonyme"),
              date: String(f.date || ""),
              text: txt.slice(0, 500)
            };
          }
          if (rowIds[p] === undefined || r.id < rowIds[p]) {
            rowIds[p] = r.id; /* ligne pre-remplie de la parcelle (statuts) */
          }
          if (String(f.proprietaire_ok || "").trim() === "X") { statuses[p] = "proprio_ok"; }
          else if (String(f.visite || "").trim() === "X") { statuses[p] = "visite"; }
        });
        data = { comments: comments, statuses: statuses, rowIds: rowIds };
        window.ELAG_STATUSES = statuses;
        return data;
      })
      .catch(function () {
        data = { comments: {}, statuses: {}, rowIds: {} };
        return data;
      });
  }

  function forceRender() {
    if (data) { window.ELAG_STATUSES = data.statuses; }
    if (typeof window.elagStatutsForceRender === "function") { window.elagStatutsForceRender(); }
  }

  loadData(true).then(forceRender);

  /* ---------- affichage commentaire + synchronisation des statuts ---------- */
  window.elagShowComment = function (parc, btn) {
    var block = (btn && btn.closest && btn.closest(".elag-cmt-block")) || document;
    var div = document.getElementById("elag-cmt-" + parc);
    loadData(true).then(function (d) {
      var v = d.comments && d.comments[parc];
      if (div) {
        div.textContent = v
          ? String(v.date).slice(0, 10) + " (" + v.author + ") : " + v.text
          : "(aucun commentaire enregistré pour cette parcelle)";
      }
      var st = (d.statuses && d.statuses[parc]) || "";
      var cbs = block.querySelectorAll ? block.querySelectorAll("input[data-elag-status]") : [];
      cbs.forEach(function (cb) {
        cb.checked = (cb.getAttribute("data-elag-status") === st);
      });
      forceRender();
    });
  };

  /* ---------- enregistrement d'un statut (colonnes proprietaire_ok / visite) ---------- */
  window.elagSetStatus = function (parc, status, cb) {
    var block = (cb && cb.closest && cb.closest(".elag-cmt-block")) || document;
    var msg = block.querySelector ? block.querySelector(".elag-status-msg") : null;
    var checked = cb && cb.checked;
    var newStatus = checked ? status : "";
    var rid = data && data.rowIds && data.rowIds[parc];
    if (!rid) {
      if (msg) { msg.textContent = "Erreur : parcelle inconnue dans la table Grist."; }
      return;
    }
    cb.disabled = true;
    if (msg) { msg.textContent = "Enregistrement..."; }
    var fields = {
      proprietaire_ok: newStatus === "proprio_ok" ? "X" : "",
      visite: newStatus === "visite" ? "X" : ""
    };
    fetch(GRIST_URL, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: [{ id: rid, fields: fields }] })
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); })
      .then(function () {
        data.statuses[parc] = newStatus || undefined;
        if (!newStatus) { delete data.statuses[parc]; }
        var otherStatus = (status === "proprio_ok") ? "visite" : "proprio_ok";
        var other = block.querySelector("input[data-elag-status='" + otherStatus + "']");
        if (other) { other.checked = false; }
        if (msg) {
          msg.textContent = newStatus
            ? (newStatus === "proprio_ok" ? "Enregistré : propriétaire OK (vert)." : "Enregistré : visite à programmer (orange).")
            : "Statut réinitialisé (rouge).";
        }
        forceRender();
      })
      .catch(function (e) {
        if (msg) { msg.textContent = "Erreur : " + e.message; }
      })
      .finally(function () { cb.disabled = false; });
  };

  /* ---------- enregistrement d'un commentaire (nouvelle ligne = historique) ---------- */
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
    fetch(GRIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        records: [{ fields: {
          parcelle: parc,
          auteur: author.slice(0, 50),
          date: new Date().toISOString(),
          commentaire: text.slice(0, 500)
        } }]
      })
    })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return loadData(true); })
      .then(function (d) {
        status.textContent = "Enregistré.";
        var v = d.comments && d.comments[parc];
        var div = document.getElementById("elag-cmt-" + parc);
        if (div && v) {
          div.textContent = String(v.date).slice(0, 10) + " (" + v.author + ") : " + v.text;
        }
        ta.value = "";
      })
      .catch(function (e) { status.textContent = "Erreur : " + e.message; })
      .finally(function () { btn.disabled = false; });
  };
})();
