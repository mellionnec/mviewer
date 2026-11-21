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
        return data;
      })
      .catch(function () {
        data = { comments: {}, statuses: {}, rowIds: {} };
        return data;
      });
  }

  /* Coloration : reconstruit la couche de statuts, puis securise avec changed().
   * Double mecanisme pour garantir la maj immediate a l'ecran. */
  function forceRender() {
    window.ELAG_STATUSES = (data && data.statuses) || {};
    try {
      if (typeof window.elagStatutsForceRender === "function") { window.elagStatutsForceRender(); }
      if (window.elagStatutsLayer) { window.elagStatutsLayer.changed(); }
    } catch (e) {
      console.log("elag: erreur de rafraichissement de la couche statuts", e);
    }
  }

  loadData(true).then(forceRender);

  /* ---------- synchro automatique : une fiche affichee = cases deja coherentes ----------
   * Un observer surveille le panneau : des qu'un bloc .elag-cmt-block apparait
   * (ouverture d'une fiche parcelle), on coche/decoche selon l'etat reel de la table,
   * immediatement avec les donnees en cache, puis une seconde fois apres relecture
   * Grist pour garantir la coherence couleur <-> cases. */
  function parcFromId(id) {
    return String(id || "").replace(/^elag-st-(p|v)-/, "");
  }

  function syncBlock(block) {
    var cbs = block.querySelectorAll ? block.querySelectorAll("input[data-elag-status]") : [];
    if (!cbs.length) { return; }
    var parc = parcFromId(cbs[0].id);
    var st = (data && data.statuses && data.statuses[parc]) || "";
    /* maj immediate avec les donnees en cache (statuts exclusifs) */
    cbs.forEach(function (cb) { cb.checked = (cb.getAttribute("data-elag-status") === st); });
    var cmt = block.querySelector(".elag-cmt-text");
    var v = data && data.comments && data.comments[parc];
    if (cmt && v) {
      cmt.textContent = String(v.date).slice(0, 10) + " (" + v.author + ") : " + v.text;
    }
    /* puis relecture Grist et re-synchro (fiche ouverte = donnee fraiche) */
    loadData(true).then(function (d) {
      var st2 = (d.statuses && d.statuses[parc]) || "";
      var cbs2 = block.querySelectorAll("input[data-elag-status]");
      cbs2.forEach(function (cb) { cb.checked = (cb.getAttribute("data-elag-status") === st2); });
      var cmt2 = block.querySelector(".elag-cmt-text");
      var v2 = d.comments && d.comments[parc];
      if (cmt2 && v2) {
        cmt2.textContent = String(v2.date).slice(0, 10) + " (" + v2.author + ") : " + v2.text;
      }
      forceRender();
    });
  }

  var syncTimer = null;
  function scheduleSync() {
    if (syncTimer) { clearTimeout(syncTimer); }
    syncTimer = setTimeout(function () {
      syncTimer = null;
      var blocks = document.querySelectorAll(".elag-cmt-block");
      blocks.forEach(function (b) { syncBlock(b); });
    }, 80);
  }

  if (typeof MutationObserver !== "undefined" && document.body) {
    new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });
  }
  loadData(true).then(scheduleSync);

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
      /* la table a pu evoluer : on recharge une fois avant d'abandonner */
      loadData(true).then(function (d) {
        if (d.rowIds && d.rowIds[parc]) { window.elagSetStatus(parc, status, cb); }
        else if (msg) { msg.textContent = "Erreur : parcelle inconnue dans la table Grist."; }
      });
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
      .then(function (r) {
        if (!r.ok) { throw new Error("HTTP " + r.status + " " + r.statusText); }
      })
      .then(function () { return loadData(true); })
      .then(function (d) {
        var st = (d.statuses && d.statuses[parc]) || "";
        var cbs = block.querySelectorAll ? block.querySelectorAll("input[data-elag-status]") : [];
        cbs.forEach(function (c) {
          c.checked = (c.getAttribute("data-elag-status") === st);
        });
        if (msg) {
          msg.textContent = st
            ? (st === "proprio_ok" ? "Enregistré : propriétaire OK (vert)." : "Enregistré : visite à programmer (orange).")
            : "Statut réinitialisé (rouge).";
        }
        forceRender();
      })
      .catch(function (e) {
        /* retour a l'etat reel connu (rollback des coches) */
        var stR = (data && data.statuses && data.statuses[parc]) || "";
        var cbsR = block.querySelectorAll ? block.querySelectorAll("input[data-elag-status]") : [];
        cbsR.forEach(function (c) { c.checked = (c.getAttribute("data-elag-status") === stR); });
        if (msg) { msg.textContent = "Erreur : " + (e.message || e); }
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
      .catch(function (e) { status.textContent = "Erreur : " + (e.message || e); })
      .finally(function (btn) { btn.disabled = false; }.bind(null, btn));
  };
})();
