# mviewer

Configurations mviewer (visualiseur géographique open source, https://github.com/mviewer/mviewer).

## Applications

- `apps/cadastre-bretagne.xml` : Cadastre et communes de Bretagne (WMS GéoBretagne) + OSM / Plan IGN
- `apps/parc-elag.xml` : Parcelles ELAG (GeoJSON, 75 entités, Mellionnec 22) sur fond **Plan IGN v2**
- `parc_elag.geojson` : données source (WGS84)

## Visualisation

Lancer une instance mviewer (ex. https://geobretagne.fr/mviewer/) avec le paramètre :

`?config=<URL du XML>`

Exemple :

https://geobretagne.fr/mviewer/?config=https://raw.githubusercontent.com/mellionnec/mviewer/main/apps/parc-elag.xml
