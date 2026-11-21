/* elag-comments.js
 * Extension mviewer : commentaires + statuts partagés par parcelle (ELAG Mellionnec)
 * Stockage : Google Sheet "elag-commentaires" via Apps Script Web App.
 * Statuts : "proprio_ok" (vert), "visite" (orange), sinon rouge (à traiter).
 */
(function () {
  var ELAG_API = "https://script.google.com/macros/s/AKfycbyK-m3A5JssLFLErX2RWvMn7Q1WmGcBrmyCmJDW4Mft1ahkkPNGSdgfC15qLdaNOVj2kg/exec";

  var data = null; /* { comments: {parc:{author,date,text}}, statuses: {parc:"proprio_ok"|"visite"} } */

  function loadData(force) {
    if (data && !force) return Promise.resolve(data);
    return fetch(ELAG_API)
      .then(function (r) { return r.json(); })
      .then(function (j) { data = j || { comments: {}, statuses: {} }; return data; })
      .catch(function () { data = { comments: {}, statuses: {} }; return data; });
  }

  /* ---------- style dynamique de la couche parc_elag selon le statut ---------- */
  var COLORS = {
    none:       { stroke: "rgba(220,20,20,0.9)", width: 2,   fill: "rgba(220,20,20,0.05)" },
    proprio_ok: { stroke: "#009900", width: 2.5, fill: "rgba(0,153,0,0.20)" },
    visite:     { stroke: "#FF8C00", width: 3,   fill: "rgba(255,140,0,0.25)" }
  };

  var parcStyle = function (feature) {
    var parc = feature.get("parc");
    var st = (data && data.statuses && data.statuses[parc]) || "none";
    var c = COLORS[st] || COLORS.none;
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: c.stroke, width: c.width }),
      fill: new ol.style.Fill({ color: c.fill })
    });
  };

  function parcLayer() {
    return (typeof mviewer !== "undefined" && mviewer.getLayer && mviewer.getLayer("parc_elag") || {}).layer || null;
  }

  /* force OpenLayers a redessiner (le style est une fonction : sans changed(), pas de re-rendu) */
  function repareStyleEtRedessine() {
    var l = parcLayer();
    if (!l) { return; }
    if (l.getStyle() !== parcStyle) { l.setStyle(parcStyle); }
    l.changed();
  }

  /* garde-fou : re-applique le style s'il a ete ecrase par mviewer (creation de la couche, refresh...) */
  setInterval(function () {
    var l = parcLayer();
    if (l && l.getStyle() !== parcStyle) { l.setStyle(parcStyle); l.changed(); }
  }, 1000);

  /* chargement initial des statuts puis coloration */
  loadData(true).then(function () { repareStyleEtRedessine(); });

  /* ---------- affichage commentaire + synchronisation des statuts ---------- */
  window.elagShowComment = function (parc, btn) {
    var block = (btn && btn.closest && btn.closest(".elag-cmt-block")) || document;
    var div = document.getElementById("elag-cmt-" + parc);
    loadData(true).then(function (d) {
      var v = d.comments && d.comments[parc];
      if (div) {
        div.textContent = v
          ? v.date.slice(0, 10) + " (" + v.author + ") : " + v.text
          : "(aucun commentaire enregistré pour cette parcelle)";
      }
      var st = (d.statuses && d.statuses[parc]) || "";
      var cbs = block.querySelectorAll ? block.querySelectorAll("input[data-elag-status]") : [];
      cbs.forEach(function (cb) {
        cb.checked = (cb.getAttribute("data-elag-status") === st);
      });
      repareStyleEtRedessine();
    });
  };

  /* ---------- enregistrement d'un statut ---------- */
  window.elagSetStatus = function (parc, status, cb) {
    var block = (cb && cb.closest && cb.closest(".elag-cmt-block")) || document;
    var msg = block.querySelector ? block.querySelector(".elag-status-msg") : null;
    var checked = cb && cb.checked;
    var newStatus = checked ? status : "";
    cb.disabled = true;
    if (msg) msg.textContent = "Enregistrement...";
    fetch(ELAG_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "status", id: parc, status: newStatus })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || "erreur");
        if (!data) data = { comments: {}, statuses: {} };
        if (resp.status) { data.statuses[parc] = resp.status; }
        else { delete data.statuses[parc]; }
        var otherStatus = (status === "proprio_ok") ? "visite" : "proprio_ok";
        var other = block.querySelector("input[data-elag-status='" + otherStatus + "']");
        if (other) { other.checked = false; }
        if (msg) {
          msg.textContent = resp.status
            ? (resp.status === "proprio_ok" ? "Enregistré : propriétaire OK (vert)." : "Enregistré : visite à programmer (orange).")
            : "Statut réinitialisé (rouge).";
        }
        /* re-coloration immediate du polygone */
        repareStyleEtRedessine();
      })
      .catch(function (e) {
        if (cb && checked === false) cb.checked = false;
        if (msg) msg.textContent = "Erreur : " + e.message;
      })
      .finally(function () { cb.disabled = false; });
  };

  /* ---------- enregistrement d'un commentaire ---------- */
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
    fetch(ELAG_API, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ id: parc, text: text.slice(0, 500), author: author.slice(0, 50) })
    })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); })
      .then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || "erreur");
        if (!data) data = { comments: {}, statuses: {} };
        data.comments[parc] = resp.comment;
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
