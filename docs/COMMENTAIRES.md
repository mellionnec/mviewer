# Commentaires partagés par parcelle (mviewer ELAG)

## Principe

`apps/elag.xml` charge un template Mustache (`apps/templates/parcelle.mst`) et une extension JS
(`apps/js/elag-comments.js`). En cliquant sur une parcelle, la fiche affiche les attributs du GeoJSON
et permet de saisir un commentaire. Le commentaire est envoyé à un mini-service (Cloudflare Worker)
qui l'écrit dans `apps/data/comments.json` de ce dépôt via l'API GitHub.

Le worker est indispensable : on ne met jamais un jeton GitHub en écriture dans une page publique.

## Étapes de mise en place (une seule fois)

1. **Créer le jeton GitHub** :
   - GitHub > Settings > Developer settings > Fine-grained personal access tokens > Generate
   - Repository access : *Only select repositories* > `mellionnec/mviewer`
   - Permissions > Contents : **Read and write**
   - Conserver la valeur (elle ne s'affichera qu'une fois).

2. **Déployer le worker** (gratuit, sans ligne de commande) :
   - Créer un compte sur https://workers.cloudflare.com
   - *Create Worker* > nommer `elag-comments` > *Edit code* > coller le contenu de `workers/elag-comments.js` > *Deploy*
   - Settings > Variables and Secrets > *Add* > Type **Secret**, nom `GH_TOKEN`, valeur = le jeton.

3. **Brancher la carte** :
   - Dans `apps/js/elag-comments.js`, remplacer `VOTRE-COMPTE` par le domaine du worker affiché par Cloudflare (ex. `https://elag-comments.abc123.workers.dev`).
   - C'est tout. La liaison XML est déjà en place (extension + template).

## Utilisation

- Ouvrir la carte (lien ?config=...apps/elag.xml), cliquer sur une parcelle, saisir un commentaire, Enregistrer.
- Le commentaire est visible par tous (bouton « Voir »), historisé dans les commits du dépôt (fichier `apps/data/comments.json`).

## Limites connues

- Le lien étant public, n'importe qui peut écrire un commentaire (500 caractères max, texte brut, pas de HTML : pas de risque de script).
- Un commit est créé par commentaire. Pour éviter d'alourdir l'historique de `main`, on peut viser une branche dédiée (changer `BRANCH` dans le worker et créer la branche `comments`).
