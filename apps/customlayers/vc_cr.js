/* vc_cr.js - CustomLayer mviewer
 * Voiries de 22146 : VC (voies communales) en mauve avec numéro,
 * CR (chemins ruraux) en vert pointillé avec numéro.
 * Source : GeoJSON en Lambert-93 (EPSG:2154), reprojection client via proj4.
 */
(function () {
  var LAYER_ID = "vc_cr";
  var DATA_URL = "https://raw.githubusercontent.com/mellionnec/mviewer/main/vc_cr_22146.geojson";
  var VC_COLOR = "#A020F0";
  var CR_COLOR = "#007A3D";

  proj4.defs("EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");
  if (ol.proj.proj4 && ol.proj.proj4.register) { ol.proj.proj4.register(proj4); }

  var styleFunction = function (feature) {
    var type = feature.get("type");
    var g = feature.getGeometry();
    if (!g || (type !== "VC" && type !== "CR")) { return null; }
    var num = feature.get("nom_complet") || String(type) + String(feature.get("numero") || "");
    var color = (type === "VC") ? VC_COLOR : CR_COLOR;
    var dash = (type === "CR") ? [8, 6] : undefined;

    var styles = [
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: color, width: 2, lineDash: dash })
      })
    ];

    /* étiquette au milieu de la plus longue partie de la géométrie */
    var line = null;
    if (g.getType() === "LineString") {
      line = g;
    } else if (g.getType() === "MultiLineString") {
      var best = null, bestLen = -1;
      g.getLineStrings().forEach(function (l) {
        if (l.getLength() > bestLen) { bestLen = l.getLength(); best = l; }
      });
      line = best;
    }
    if (line) {
      styles.push(new ol.style.Style({
        geometry: new ol.geom.Point(line.getCoordinateAt(0.5)),
        text: new ol.style.Text({
          font: "bold 10px Helvetica, Arial, sans-serif",
          text: num,
          fill: new ol.style.Fill({ color: color }),
          stroke: new ol.style.Stroke({ color: "#FFFFFF", width: 2 }),
          offsetY: -8
        })
      }));
    }
    return styles;
  };

  var source = new ol.source.Vector();
  var layer = new ol.layer.Vector({ source: source, style: styleFunction, visible: true });

  var legend = {
    items: [
      { label: "VC - voies communales", geometry: "line", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: VC_COLOR, width: 2 }) })] },
      { label: "CR - chemins ruraux (pointillés)", geometry: "line", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: CR_COLOR, width: 2, lineDash: [8, 6] }) })] }
    ]
  };

  fetch(DATA_URL)
    .then(function (r) { return r.json(); })
    .then(function (fc) {
      source.addFeatures(new ol.format.GeoJSON().readFeatures(fc, {
        dataProjection: "EPSG:2154",
        featureProjection: mviewer.getMap().getView().getProjection()
      }));
    })
    .catch(function (e) { console.log("vc_cr: erreur de chargement", e); });

  new CustomLayer(LAYER_ID, layer, legend);
})();
