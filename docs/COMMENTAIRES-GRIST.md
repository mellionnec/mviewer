# Commentaires et statuts des parcelles (Grist)

## Architecture (depuis novembre 2026)

Le stockage partagé est la table Grist **Suivi_elagages_view** du document public
https://docs.getgrist.com/bedv66Hzpg9e/tables (accès anonyme en lecture ET écriture).

Colonnes :
- `parcelle` : code de la parcelle (WA110, ...) - 75 lignes pré-remplies
- `auteur`, `date`, `commentaire` : un commentaire = une nouvelle ligne (historique conservé)
- `proprietaire_ok` : `X` si la case "Propriétaire OK" est cochée (parcelle verte)
- `visite` : `X` si la case "Visite à programmer" est cochée (parcelle orange)
- les deux statuts sont exclusifs ; décocher vide les deux colonnes (retour au rouge)

## Composants dans ce dépôt

- `apps/js/elag-comments.js` : extension mviewer. Appelle directement l'API REST Grist
  (`GET /records` pour lire ; `PATCH /records` pour un statut sur la ligne de la parcelle ;
  `POST /records` pour ajouter un commentaire). Expose `window.ELAG_STATUSES`.
- `apps/customlayers/parc_statuts.js` : couche customlayer mviewer qui dessine en
  vert/orange les parcelles ayant un statut (lit `window.ELAG_STATUSES`, reconstruit
  ses entités à chaque changement via `window.elagStatutsForceRender()`).
- `apps/templates/parcelle.mst` : fiche Mustache (cases à cocher + zone commentaire).

## Contraintes

- Si la table Grist est renommée, mettre à jour `GRIST_URL` dans `apps/js/elag-comments.js`.
- Toujours servir les scripts via des URLs épinglées sur le SHA de commit (jsDelivr
  `@<sha>`) dans `apps/elag.xml`, à cause des caches CDN et navigateur (7 jours).
- L'ancienne version Google Sheets + Apps Script est conservée dans
  `docs/elag-appsscript.gs` et `docs/COMMENTAIRES-GOOGLE-SHEETS.md` à titre de référence.
