/* elag-comments.js
 * Extension mviewer : commentaires + statuts partagés par parcelle (ELAG Mellionnec)
 * Stockage : table Grist "Suivi_elagages_view" (doc public docs.getgrist.com bedv66Hzpg9e),
 * appel direct de l'API REST Grist (CORS ouvert, ecriture anonyme activee sur le doc).
 * Statuts : "proprio_ok" (vert), "visite" (orange), "non_traite" = propriétaire NON (rouge), sinon rien.
 * La coloration des parcelles est faite par la couche customlayer "parc_statuts",
 * qui lit window.ELAG_STATUSES maintenu par cette extension.
 */
(function () {
  var GRIST_URL = "https://docs.getgrist.com/api/docs/bedv66Hzpg9e/tables/Suivi_elagages_view/records";

  var data = null; /* { comments: {parc:{author,date,text}}, statuses: {parc:"proprio_ok"|"visite"|"non_traite"}, rowIds: {parc: idGrist} } */

  window.ELAG_STATUSES = window.ELAG_STATUSES || {};

  /* Un statut vaut VRAI si la colonne contient true (case a cocher Grist)
   * ou la lettre X (ancien format texte). */
  function flag(v) {
    if (v === true) { return true; }
    var s = String(v === null || v === undefined ? "" : v).trim().toUpperCase();
    return s === "X" || s === "TRUE" || s === "VRAI" || s === "1";
  }

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
          if (flag(f.proprietaire_ok)) { statuses[p] = "proprio_ok"; }
          else if (flag(f.visite)) { statuses[p] = "visite"; }
          else if (flag(f.non_traite)) { statuses[p] = "non_traite"; }
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

  /* ---------- synchro automatique : une fiche affichee = select deja coherent ----------
   * Un observer surveille le panneau : des qu'un bloc .elag-cmt-block apparait
   * (ouverture d'une fiche parcelle), on positionne le menu deroulant de statut selon
   * l'etat reel de la table, immediatement avec les donnees en cache, puis une seconde
   * fois apres relecture Grist pour garantir la coherence couleur <-> select. */
  function setBlockStatus(block, st) {
    var sel = block.querySelector ? block.querySelector("select[data-elag-status-select]") : null;
    if (!sel) { return; }
    sel.value = ["proprio_ok", "visite", "non_traite"].indexOf(st) > -1 ? st : "";
  }

  function parcFromId(id) {
    return String(id || "").replace(/^elag-st-/, "");
  }

  function syncBlock(block) {
    var sel = block.querySelector ? block.querySelector("select[data-elag-status-select]") : null;
    if (!sel) { return; }
    var parc = parcFromId(sel.id);
    var cmt = block.querySelector(".elag-cmt-text");
    function apply(d) {
      var st = (d && d.statuses && d.statuses[parc]) || "";
      setBlockStatus(block, st);
      var v = d && d.comments && d.comments[parc];
      if (cmt && v) {
        cmt.textContent = String(v.date).slice(0, 10) + " (" + v.author + ") : " + v.text;
      }
    }
    /* maj immediate avec les donnees en cache (statuts exclusifs) */
    apply(data);
    /* puis relecture Grist et re-synchro (fiche ouverte = donnee fraiche) */
    loadData(true).then(function (d) {
      apply(d);
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
      setBlockStatus(block, st);
      forceRender();
    });
  };

  /* ---------- enregistrement d'un statut (colonnes proprietaire_ok / visite / non_traite) ----------
   * "status" est la valeur du menu deroulant : "proprio_ok" | "visite" | "non_traite" | "" (aucun). */
  window.elagSetStatus = function (parc, status, sel) {
    var block = (sel && sel.closest && sel.closest(".elag-cmt-block")) || document;
    var msg = block.querySelector ? block.querySelector(".elag-status-msg") : null;
    var newStatus = ["proprio_ok", "visite", "non_traite"].indexOf(status) > -1 ? status : "";
    var rid = data && data.rowIds && data.rowIds[parc];
    if (!rid) {
      /* la table a pu evoluer : on recharge une fois avant d'abandonner */
      loadData(true).then(function (d) {
        if (d.rowIds && d.rowIds[parc]) { window.elagSetStatus(parc, status, sel); }
        else if (msg) { msg.textContent = "Erreur : parcelle inconnue dans la table Grist."; }
      });
      return;
    }
    sel.disabled = true;
    if (msg) { msg.textContent = "Enregistrement..."; }
    var fields = {
      proprietaire_ok: newStatus === "proprio_ok",
      visite: newStatus === "visite",
      non_traite: newStatus === "non_traite"
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
        setBlockStatus(block, st);
        if (msg) {
          msg.textContent = st
            ? (st === "proprio_ok" ? "Enregistré : propriétaire OK (vert)."
              : st === "visite" ? "Enregistré : visite à programmer (orange)."
              : "Enregistré : propriétaire NON (rouge).")
            : "Statut réinitialisé.";
        }
        forceRender();
      })
      .catch(function (e) {
        /* retour a l'etat reel connu (rollback du select) */
        var stR = (data && data.statuses && data.statuses[parc]) || "";
        setBlockStatus(block, stR);
        if (msg) { msg.textContent = "Erreur : " + (e.message || e); }
      })
      .finally(function () { sel.disabled = false; });
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
      .finally(function (b) { b.disabled = false; }.bind(null, btn));
  };

  /* ---------- style de la couche parcelle : trait fin pointille gris fonce ---------- */
  function parcelleStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#4d4d4d", width: 1.25, lineDash: [5, 4] }),
      fill: new ol.style.Fill({ color: "rgba(0,0,0,0)" })
    });
  }

  function applyParcelleStyle() {
    try {
      var o = window.mviewer && window.mviewer.getLayer && window.mviewer.getLayer("parc_elag");
      var l = o && o.layer;
      if (!l || !l.setStyle) { return false; }
      l.setStyle(parcelleStyle());
      try {
        window.mviewer.drawVectorLegend("parc_elag", [{
          label: "Parcelle ELAG",
          geometry: "Polygon",
          styles: [parcelleStyle()]
        }]);
      } catch (e) { console.log("elag: legende parcelle non dessinee", e); }
      console.log("elag: style parcelle applique (pointille gris)");
      return true;
    } catch (e) {
      console.log("elag: erreur application style parcelle", e);
      return true; /* ne pas boucler sur une erreur permanente */
    }
  }

  var styleTries = 0;
  var styleTimer = setInterval(function () {
    if (applyParcelleStyle() || ++styleTries > 200) { clearInterval(styleTimer); }
  }, 250);
})();
