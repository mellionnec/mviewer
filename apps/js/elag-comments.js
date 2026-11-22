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

  /* Couleurs du statut, identiques a la legende et a la couche.
   * On colore le select lui-meme (affichage ferme) : seul moyen fiable
   * multi-navigateurs, les styles des <option> ne s'affichent pas
   * partout dans le champ ferme. */
  var ST_STYLE = {
    "proprio_ok": { background: "#009900", color: "#fff", bold: true },
    "visite":     { background: "#FF8C00", color: "#fff", bold: true },
    "non_traite": { background: "#FF0000", color: "#fff", bold: true }
  };

  function setBlockStatus(block, st) {
    var sel = block.querySelector ? block.querySelector("select[data-elag-status-select]") : null;
    if (!sel) { return; }
    var valid = ["proprio_ok", "visite", "non_traite"].indexOf(st) > -1;
    sel.value = valid ? st : "";
    var cs = valid ? ST_STYLE[st] : null;
    sel.style.backgroundColor = cs ? cs.background : "";
    sel.style.color = cs ? cs.color : "";
    sel.style.fontWeight = cs && cs.bold ? "bold" : "";
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

  /* ---------- dedoublonnage du panneau : le clic sur une parcelle peut etre
   * detecte deux fois par mviewer/OpenLayers (meme entite rendez deux fois),
   * ce qui affiche deux fiches identiques avec des ids DOM dupliques.
   * On ne garde que la premiere fiche par identifiant de parcelle. */
  function dedupFiche() {
    var seen = {};
    document.querySelectorAll("select[data-elag-status-select]").forEach(function (sel) {
      var p = parcFromId(sel.id);
      if (seen[p]) {
        var b = sel.closest(".parcelle");
        if (b && b.parentNode) { b.parentNode.removeChild(b); }
      } else {
        seen[p] = true;
      }
    });
  }

  var syncTimer = null;
  function scheduleSync() {
    if (syncTimer) { clearTimeout(syncTimer); }
    syncTimer = setTimeout(function () {
      syncTimer = null;
      try { dedupFiche(); } catch (e) { console.log("elag: erreur dedoublonnage fiche", e); }
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

  /* ---------- style du contour de la commune : trait continu noir, fond transparent ---------- */
  function communeStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#000000", width: 2.5 }),
      fill: new ol.style.Fill({ color: "rgba(0,0,0,0)" })
    });
  }

  function applyCommuneStyle() {
    try {
      var o = window.mviewer && window.mviewer.getLayer && window.mviewer.getLayer("commune");
      var l = o && o.layer;
      if (!l || !l.setStyle) { return false; }
      l.setStyle(communeStyle());
      /* pas d'entree de legende pour la commune : affichage carte uniquement */
      return true;
    } catch (e) {
      console.log("elag: erreur application style commune", e);
      return true;
    }
  }

  /* ---------- style de la couche parcelle : contour rose fluo pointille, sans remplissage ---------- */
  function parcelleStyle() {
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: "#FF00FF", width: 2.5, lineDash: [6, 4] }),
      fill: new ol.style.Fill({ color: "rgba(255,0,255,0)" })
    });
  }

  function applyParcelleStyle() {
    try {
      var o = window.mviewer && window.mviewer.getLayer && window.mviewer.getLayer("parc_elag");
      var l = o && o.layer;
      if (!l || !l.setStyle) { return false; }
      l.setStyle(parcelleStyle());
      console.log("elag: style parcelle applique (contour rose fluo pointille, sans fond)");
      return true;
    } catch (e) {
      console.log("elag: erreur application style parcelle", e);
      return true; /* ne pas boucler sur une erreur permanente */
    }
  }

  /* legende : mviewer cree le canvas vector-legend-<id> quand la couche est
   * ajoutee au panneau ; si on dessine trop tot, le canvas n'existe pas ou
   * est ecrase ensuite. On retente jusqu'a ce qu'il existe et soit renseigne. */
  function applyParcelleLegend() {
    try {
      var cv = document.getElementById("vector-legend-parc_elag");
      if (!cv) { return false; }
      window.mviewer.drawVectorLegend("parc_elag", [{
        label: "Parcelle identifi\u00e9e",
        geometry: "Polygon",
        styles: [parcelleStyle()]
      }]);
      return !!(cv.width && cv.height);
    } catch (e) {
      console.log("elag: legende parcelle non dessinee", e);
      return false;
    }
  }

  /* ---------- lien "Modifier (Grist)" dans l'entete de la carte ---------- */
  var GRIST_DOC_URL = "https://docs.getgrist.com/bedv66Hzpg9e/tables?utm_id=share-doc";

  function addGristLink() {
    try {
      if (document.getElementById("elag-grist-link")) { return true; }
      var t = document.querySelector(".mv-title");
      if (!t || !t.parentNode) { return false; }
      var a = document.createElement("a");
      a.id = "elag-grist-link";
      a.className = "navbar-brand";
      a.href = GRIST_DOC_URL;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = "Modifier les statuts et commentaires dans la table Grist";
      a.style.marginLeft = "8px";
      a.textContent = "\u270d Modifier (Grist)";
      t.parentNode.insertBefore(a, t.nextSibling);
      return true;
    } catch (e) {
      console.log("elag: erreur ajout lien Grist", e);
      return true; /* ne pas bloquer le reste */
    }
  }

  var styleTries = 0;
  var styleTimer = setInterval(function () {
    var doneP = applyParcelleStyle();
    var doneC = applyCommuneStyle();
    var doneG = addGristLink();
    var doneL = applyParcelleLegend();
    if ((doneP && doneC && doneG && doneL) || ++styleTries > 200) { clearInterval(styleTimer); }
  }, 250);
  /* ---------- deployer les deux themes au chargement ----------
   * mviewer n'ouvre au demarrage que le 1er theme collapsed=false et le menu
   * est un accordion (l'ouverture d'un theme referme l'autre). On ouvre donc
   * manuellement les deux une fois le menu construit. */
  var themeTries = 0;
  var themeTimer = setInterval(function () {
    var ids = ["elag", "donnees-mellionnec"];
    var ready = true;
    ids.forEach(function (tid) {
      if (!document.getElementById("theme-layers-" + tid)) { ready = false; }
    });
    if (ready) {
      setTimeout(function () {
        ids.forEach(function (tid) {
          var li = document.getElementById("theme-layers-" + tid);
          var ul = li ? li.querySelector("ul") : null;
          if (li && ul) {
            ul.style.display = "block";
            li.classList.add("opened");
          }
        });
      }, 300);
      clearInterval(themeTimer);
    } else if (++themeTries > 120) {
      clearInterval(themeTimer);
    }
  }, 250);
})();