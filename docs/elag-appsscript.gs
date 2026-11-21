/**
 * COMMENTAIRES + STATUTS ELAG - mviewer (Google Apps Script)
 *
 * À coller dans le tableur : Extensions > Apps Script, remplacer le contenu par ce fichier,
 * puis Déployer > Gérer les déploiements > (crayon) > Version : "Nouvelle version" > Déployer
 * (l'URL du déploiement existant est conservée).
 *
 * GET  -> { comments: { "WA21": {author,date,text}, ... }, statuses: { "WA21": "proprio_ok"|"visite", ... } }
 * POST {id,text,author}            -> ajoute un commentaire (première feuille)
 * POST {action:"status",id,status} -> statut de parcelle (feuille "statuts", créée automatiquement)
 *        status : "proprio_ok" (vert) | "visite" (orange) | "" (retour au rouge)
 */
function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function statusSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("statuts");
  if (!sh) {
    sh = ss.insertSheet("statuts");
    sh.appendRow(["parcelle", "statut", "date"]);
  }
  return sh;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sh = sheet_();
  var rows = sh.getDataRange().getValues();
  var comments = {};
  for (var i = 1; i < rows.length; i++) {
    var parc = rows[i][0];
    if (!parc) continue;
    var text = String(rows[i][3] || "").trim();
    if (!text) continue;
    comments[String(parc)] = {
      author: String(rows[i][1] || "anonyme"),
      date: String(rows[i][2] || ""),
      text: text.slice(0, 500)
    };
  }
  var statuses = {};
  var srows = statusSheet_().getDataRange().getValues();
  for (var j = 1; j < srows.length; j++) {
    var p = String(srows[j][0]);
    if (!p) continue;
    var s = String(srows[j][1] || "").trim();
    /* la dernière occurrence gagne ; statut vide = retour au rouge */
    if (s) { statuses[p] = s; } else { delete statuses[p]; }
  }
  return out_({ comments: comments, statuses: statuses });
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);

    /* ----- action : statut de parcelle ----- */
    if (b.action === "status") {
      var sid = String(b.id || "");
      var status = String(b.status || "");
      if (!/^[0-9A-Z]{4,20}$/.test(sid)) throw new Error("identifiant de parcelle invalide");
      if (["proprio_ok", "visite", ""].indexOf(status) === -1) throw new Error("statut invalide");
      statusSheet_().appendRow([sid, status, new Date().toISOString()]);
      return out_({ ok: true, status: status });
    }

    /* ----- action par défaut : commentaire ----- */
    var id = String(b.id || "");
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
