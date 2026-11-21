/**
 * COMMENTAIRES ELAG - mviewer (Google Apps Script)
 *
 * À coller dans le tableur : Extensions > Apps Script, remplacer le contenu par ce fichier,
 * puis Déployer > Nouveau déploiement > type "Application Web" :
 *   - Exécuter en tant que : Moi
 *   - Accès : Tous
 * Copier l'URL du déploiement (....exec) et la renseigner dans apps/js/elag-comments.js.
 *
 * GET  (URL Web App)          -> { comments: { "WA21": {author, date, text}, ... } }
 * POST (corps JSON {id,text,author}) -> ajoute une ligne dans la première feuille
 */
function sheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
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
    // les lignes étant ajoutées, la dernière occurrence gagne (dernier commentaire)
    comments[String(parc)] = {
      author: String(rows[i][1] || "anonyme"),
      date: String(rows[i][2] || ""),
      text: text.slice(0, 500)
    };
  }
  return out_({ comments: comments });
}

function doPost(e) {
  try {
    var b = JSON.parse(e.postData.contents);
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
