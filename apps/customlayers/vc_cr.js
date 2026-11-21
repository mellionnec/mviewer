/* vc_cr.js - CustomLayer mviewer
 * Voiries de 22146 : VC (voies communales) en mauve clair avec numero,
 * CR (chemins ruraux) en vert fluo pointille avec numero.
 * Source : GeoJSON en Lambert-93 (EPSG:2154), reprojection client via proj4.
 * Le refresh de la source est surcharge (mviewer appelle getSource().refresh()
 * au reaffichage de la couche).
 * Robustesse :
 *  - veille de legende : mviewer.drawVectorLegend() des que l'entree apparait
 *    (la legende vectorielle n'est dessinee qu'a la creation du noeud, course
 *    avec le chargement async du script sinon).
 *  - veille d'enregistrement : si processLayer n'a pas enregistre la couche
 *    apres 2,5 s, on le fait nous-meme pour que la case a cocher reponde.
 */
(function () {
  var LAYER_ID = "vc_cr";
  var DATA_URL = "https://raw.githubusercontent.com/mellionnec/mviewer/main/vc_cr_22146.geojson";
  var VC_COLOR = "#C77DFF";
  var CR_COLOR = "#00FF00";
  var WIDTH = 3;

  proj4.defs("EPSG:2154", "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs");
  if (ol.proj.proj4 && ol.proj.proj4.register) { ol.proj.proj4.register(proj4); }

  var styleFunction = function (feature) {
    var type = feature.get("type");
    var g = feature.getGeometry();
    if (!g || (type !== "VC" && type !== "CR")) { return null; }
    var num = feature.get("nom_complet") || String(type) + String(feature.get("numero") || "");
    var color = (type === "VC") ? VC_COLOR : CR_COLOR;
    var dash = (type === "CR") ? [10, 8] : undefined;

    var styles = [
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: color, width: WIDTH, lineDash: dash })
      })
    ];

    var line = null;
    if (g.getType() === "LineString") { line = g; }
    else if (g.getType() === "MultiLineString") {
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
          font: "bold 11px Helvetica, Arial, sans-serif",
          text: num,
          fill: new ol.style.Fill({ color: color }),
          stroke: new ol.style.Stroke({ color: "#000000", width: 2 }),
          offsetY: -10
        })
      }));
    }
    return styles;
  };

  var source = new ol.source.Vector();
  var loading = false;
  var loaded = false;

  function loadFeatures() {
    if (loading || loaded) { return; }
    loading = true;
    var proj = mviewer.getMap().getView().getProjection();
    fetch(DATA_URL)
      .then(function (r) { return r.json(); })
      .then(function (fc) {
        source.clear();
        source.addFeatures(new ol.format.GeoJSON().readFeatures(fc, {
          dataProjection: "EPSG:2154",
          featureProjection: proj
        }));
        loaded = true;
      })
      .catch(function (e) { console.log("vc_cr: erreur de chargement", e); })
      .finally(function () { loading = false; });
  }

  source.refresh = function () { loaded = false; loadFeatures(); };
  loadFeatures();

  var layer = new ol.layer.Vector({ source: source, style: styleFunction, visible: true });

  var legend = {
    items: [
      { label: "VC - voies communales", geometry: "line", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: VC_COLOR, width: WIDTH }) })] },
      { label: "CR - chemins ruraux", geometry: "line", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: CR_COLOR, width: WIDTH, lineDash: [10, 8] }) })] }
    ]
  };

  new CustomLayer(LAYER_ID, layer, legend);

  /* ---- veille de legende : dessine la legende des que le canvas existe ---- */
  var LEGEND_ID = "vector-legend-" + LAYER_ID;
  var lastCanvas = null;
  setInterval(function () {
    var canvas = document.getElementById(LEGEND_ID);
    if (canvas && canvas !== lastCanvas && mviewer.drawVectorLegend) {
      try { mviewer.drawVectorLegend(LAYER_ID, legend.items); lastCanvas = canvas; } catch (e) {}
    }
  }, 1500);

  /* ---- veille d'enregistrement : processLayer de secours si besoin ---- */
  var registered = false;
  setTimeout(function tick() {
    if (registered) { return; }
    var cl = mviewer.customLayers && mviewer.customLayers[LAYER_ID];
    if (cl && cl.config) { registered = true; return; }
    if (mviewer.processLayer && mviewer.customLayers) {
      var oLayer = {
        id: LAYER_ID, layerid: LAYER_ID,
        name: "Voies communales et chemins ruraux",
        title: "Voies communales et chemins ruraux",
        type: "customlayer", checked: false, opacity: 1,
        vectorlegend: true, queryable: false, showintoc: true,
        searchable: false, infohighlight: false, expanded: false, top: false,
        attribution: "Voirie communale et rurale, commune de Mellionnec",
        theme: "elag"
      };
      var cl2 = mviewer.customLayers[LAYER_ID];
      if (cl2 && cl2.layer) {
        try { mviewer.processLayer(oLayer, cl2.layer); registered = true; return; } catch (e) { console.log("vc_cr: processLayer de secours en erreur", e); }
      }
    }
    setTimeout(tick, 800);
  }, 2500);
})();
