# Commentaires partagés : version Google Sheets

## Fichiers

- `apps/elag.xml` : config mviewer (template fiche + extension JS)
- `apps/templates/parcelle.mst` : fiche Mustache (attributs + zone commentaire)
- `apps/js/elag-comments.js` : extension appelée par le Web App Apps Script
- `docs/elag-appsscript.gs` : le script Apps Script à coller dans le tableur

## Mise en place (une seule fois, ~5 minutes)

1. Le tableau `elag-commentaires` (dossier Drive `elag`) contient 4 colonnes : parcelle, auteur, date, commentaire, avec les 75 parcelles pré-remplies.
2. Dans le tableur : **Extensions > Apps Script** > remplacer le code par celui de `docs/elag-appsscript.gs` > Enregistrer.
3. **Déployer > Nouveau déploiement** > type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tous**
   - Déployer, autoriser, copier l'URL (`https://script.google.com/macros/s/.../exec`).
4. Coller cette URL dans `apps/js/elag-comments.js` à la place de `URL_WEB_APP_A_COLLER` (éditeur web GitHub).
5. Recharger la carte : cliquer sur une parcelle, saisir, Enregistrer.

## Détails techniques

- Le POST est envoyé en `text/plain` : évite la requête CORS préliminaire (preflight) que les Web Apps Apps Script ne gèrent pas.
- Un commentaire = une ligne ajoutée à la feuille. La fiche affiche le **dernier** commentaire de la parcelle (les lignes se suivent, la dernière gagne).
- Le tableur reste éditable directement : vous pouvez corriger, modérer ou supprimer des lignes. Historigramme complet via Fichier > Historique des versions.
- Texte brut uniquement (pas de HTML exécuté dans la fiche), 500 caractères max, auteur 50 max.

## Ancienne version (Cloudflare Worker)

L'ancien dispositif `workers/elag-comments.js` + `apps/data/comments.json` est conservé dans le dépôt à titre d'alternative
(utile si vous voulez des écritures versionnées en Git), mais il n'est plus branché : le lien Apps Script ne l'utilise plus.
