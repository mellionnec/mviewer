/**
 * COMMENTAIRES + STATUTS ELAG - Google Apps Script (v3)
 *
 * Feuille 1 (elle existe deja, 1 ligne par parcelle, pre-remplie) :
 *   A : parcelle | B : auteur | C : date | D : commentaire
 *   E : proprietaire_ok (creee automatiquement) | F : visite (creee automatiquement)
 * E/F recoivent "X" sur la ligne de la parcelle.
 *
 * Mise en place (a refaire a chaque nouvelle version du script) :
 *   1. Tableur > Extensions > Apps Script : remplacer TOUT le contenu par ce fichier,_enregistrer.
 *   2. Deployer > Gerer les deploiements > crayon > Version : "Nouvelle version" > Deployer.
 *      L'URL du deploiement ne change pas.
 *
 * GET  -> { comments: { "WA21": {author,date,text}, ... },
 *           statuses: { "WA21": "proprio_ok" | "visite", ... } }   (absent = a traiter, rouge)
 * POST {id,text,author}             -> ajoute un commentaire (nouvelle ligne, historique conserve)
 * POST {action:"status",id,status}  -> statut : "proprio_ok" | "visite" | "" (retour au rouge)
 */
function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function ensureStatusColumns_() {
  var sh = sheet_();
  if (String(sh.getRange("E1").getValue()).trim() !== "proprietaire_ok") {
    sh.getRange("E1").setValue("proprietaire_ok");
    sh.getRange("F1").setValue("visite");
  }
}

function findParcelleRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) { return -1; }
  var vals = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === id) { return i + 2; }
  }
  return -1;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  ensureStatusColumns_();
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var comments = {};
  var statuses = {};
  for (var i = 1; i < rows.length; i++) {
    var parc = String(rows[i][0]).trim();
    if (!parc) { continue; }
    var text = String(rows[i][3] || "").trim();
    if (text) {
      comments[parc] = {
        author: String(rows[i][1] || "anonyme"),
        date: String(rows[i][2] || ""),
        text: text.slice(0, 500)
      };
    }
    var ok = String(rows[i][4] || "").trim();
    var vis = String(rows[i][5] || "").trim();
    if (vis) { statuses[parc] = "visite"; }
    else if (ok) { statuses[parc] = "proprio_ok"; }
  }
  return out_({ comments: comments, statuses: statuses });
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);

    /* ----- action : statut de parcelle (colonnes E/F de la ligne de la parcelle) ----- */
    if (b.action === "status") {
      var sid = String(b.id || "").trim();
      var status = String(b.status || "").trim();
      if (!/^[0-9A-Z]{4,20}$/.test(sid)) throw new Error("identifiant de parcelle invalide");
      if (["proprio_ok", "visite", ""].indexOf(status) === -1) throw new Error("statut invalide");
      ensureStatusColumns_();
      var sh = sheet_();
      var row = findParcelleRow_(sh, sid);
      if (row === -1) {
        sh.appendRow([sid, "", "", ""]);
        row = findParcelleRow_(sh, sid);
        if (row === -1) throw new Error("parcelle introuvable dans le tableur");
      }
      /* statut : "X" dans la colonne concernee, l'autre est videe (statuts exclusifs) */
      sh.getRange(row, 5).setValue(status === "proprio_ok" ? "X" : "");
      sh.getRange(row, 6).setValue(status === "visite" ? "X" : "");
      return out_({ ok: true, status: status });
    }

    /* ----- action par defaut : commentaire (nouvelle ligne -> historique conserve) ----- */
    var id = String(b.id || "").trim();
    var text = String(b.text || "").slice(0, 500).trim();
    var author = String(b.author || "anonyme").slice(0, 50).trim() || "anonyme";
    if (!/^[0-9A-Z]{4,20}$/.test(id)) throw new Error("identifiant de parcelle invalide");
    if (!text) throw new Error("commentaire vide");
    var date = new Date().toISOString();
    sheet_().appendRow([id, author, date, text]);
    return out_({ ok: true, comment: { author: author, date: date, text: text } });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  }
}
