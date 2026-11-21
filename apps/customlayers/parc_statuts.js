/* parc_statuts.js - CustomLayer mviewer
 * Surcouche de coloration des parcelles ELAG selon leur statut :
 *   proprietaire_ok -> vert, visite -> orange, pas de statut -> non dessinee
 * (le contour rouge de la couche parc_elag reste visible en dessous).
 * Les statuts viennent de window.ELAG_STATUSES, maintenu par l'extension elag-comments.js
 * (table Grist Suivi_elagages_view).
 * Reconstruction complete des entites a chaque changement : ne depend pas du
 * mecanisme style/changed d'OpenLayers, contournant le bug de recoloration.
 */
(function () {
  var LAYER_ID = "parc_statuts";
  var GEOJSON_URL = "https://raw.githubusercontent.com/mellionnec/mviewer/main/parc_elag.geojson";

  var COLORS = {
    proprio_ok: { stroke: "#009900", width: 2.5, fill: "rgba(0,153,0,0.35)" },
    visite:     { stroke: "#FF8C00", width: 2.5, fill: "rgba(255,140,0,0.35)" }
  };

  var rawGeojson = null;
  var source = new ol.source.Vector();

  function viewProj() {
    return mviewer.getMap().getView().getProjection();
  }

  function build() {
    if (!rawGeojson) { return; }
    var statuses = (typeof window.ELAG_STATUSES === "object" && window.ELAG_STATUSES) || {};
    var feats = new ol.format.GeoJSON().readFeatures(rawGeojson, {
      dataProjection: "EPSG:4326",
      featureProjection: viewProj()
    });
    var visible = feats.filter(function (f) {
      var st = statuses[f.get("parc")];
      return st === "proprio_ok" || st === "visite";
    });
    source.clear(true);
    source.addFeatures(visible);
  }

  var styleFn = function (feature) {
    var st = (window.ELAG_STATUSES || {})[feature.get("parc")];
    var c = COLORS[st];
    if (!c) { return null; }
    return new ol.style.Style({
      stroke: new ol.style.Stroke({ color: c.stroke, width: c.width }),
      fill: new ol.style.Fill({ color: c.fill })
    });
  };

  fetch(GEOJSON_URL)
    .then(function (r) { return r.json(); })
    .then(function (fc) { rawGeojson = fc; build(); })
    .catch(function (e) { console.log("parc_statuts: erreur de chargement", e); });

  source.refresh = function () { build(); };
  window.elagStatutsForceRender = function () { build(); };

  var layer = new ol.layer.Vector({ source: source, style: styleFn, visible: true });

  var legend = {
    items: [
      { label: "Propriétaire OK", geometry: "polygon", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: COLORS.proprio_ok.stroke, width: COLORS.proprio_ok.width }), fill: new ol.style.Fill({ color: COLORS.proprio_ok.fill }) })] },
      { label: "Visite à programmer", geometry: "polygon", styles: [new ol.style.Style({ stroke: new ol.style.Stroke({ color: COLORS.visite.stroke, width: COLORS.visite.width }), fill: new ol.style.Fill({ color: COLORS.visite.fill }) })] }
    ]
  };

  new CustomLayer(LAYER_ID, layer, legend);
})();
