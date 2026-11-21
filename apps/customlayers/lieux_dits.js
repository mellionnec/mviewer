/* lieux_dits.js - CustomLayer mviewer
 * Lieux-dits de 22146 : affichage texte uniquement (Helvetica 10, noir), sans géométrie.
 * Exclusions : "Brasserie La Grobul'Factory" et "Mellionnec".
 * Source : GeoJSON en Lambert-93 (EPSG:2154), reprojection client via proj4.
 * Chargement via loader ol.source.Vector : indispensable pour que la couche
 * survive au decoche/recoche (mviewer appelle source.refresh() au réaffichage).
 */
(function () {
  var LAYER_ID = "lieux_dits";
  var EXCLUDE = ["Brasserie La Grobul'Factory", "Mellionnec"];
  var DATA_URL = "https://raw.githubusercontent.com/mellionnec/mviewer/main/lieux_dits_22146.geojson";

  proj4.defs("EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");
  if (ol.proj.proj4 && ol.proj.proj4.register) { ol.proj.proj4.register(proj4); }

  var labelStyle = function (feature) {
    var name = feature.get("name");
    if (!name || EXCLUDE.indexOf(name) !== -1) { return null; }
    return new ol.style.Style({
      text: new ol.style.Text({
        font: "400 10px Helvetica, Arial, sans-serif",
        text: String(name),
        fill: new ol.style.Fill({ color: "#000000" }),
        offsetY: 0
      })
    });
  };

  var source = new ol.source.Vector({
    loader: function (extent, resolution, projection) {
      fetch(DATA_URL)
        .then(function (r) { return r.json(); })
        .then(function (fc) {
          source.clear();
          source.addFeatures(new ol.format.GeoJSON().readFeatures(fc, {
            dataProjection: "EPSG:2154",
            featureProjection: projection
          }));
        })
        .catch(function (e) { console.log("lieux_dits: erreur de chargement", e); });
    }
  });

  var layer = new ol.layer.Vector({
    source: source,
    style: labelStyle,
    visible: true
  });

  new CustomLayer(LAYER_ID, layer, {});
})();
