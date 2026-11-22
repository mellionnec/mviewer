/* Couche BAL Mellionnec : numeros d'adresse de la Base Adresse Locale.
 * Point bordeaux + valeur du champ "numero" en blanc sur fond bordeaux. */
const LAYER_ID = "bal";
const GEOJSON_URL = "https://raw.githubusercontent.com/mellionnec/mviewer/main/bal_20112026.geojson";
const BORDEAUX = "#722F37";

const makeStyle = function (feature, resolution) {
    var style = new ol.style.Style({
        image: new ol.style.Circle({
            fill: new ol.style.Fill({ color: BORDEAUX }),
            stroke: new ol.style.Stroke({ color: "#FFFFFF", width: 1 }),
            radius: 4
        })
    });
    var numero = feature.get("numero");
    if (numero !== null && numero !== undefined && resolution < 200) {
        style.setText(new ol.style.Text({
            text: String(numero),
            font: "bold 13px arial, sans-serif",
            fill: new ol.style.Fill({ color: "#FFFFFF" }),
            backgroundFill: new ol.style.Fill({ color: BORDEAUX }),
            backgroundStroke: new ol.style.Stroke({ color: BORDEAUX, width: 1 }),
            padding: [2, 4, 2, 4],
            offsetY: -14,
            overflow: true
        }));
    }
    return style;
};

const layer = new ol.layer.Vector({
    source: new ol.source.Vector({
        url: GEOJSON_URL,
        format: new ol.format.GeoJSON()
    }),
    style: makeStyle
});

const legend = {
    items: [
        {
            label: "Numéros d'adresse (BAL)",
            geometry: "Point",
            styles: [new ol.style.Style({
                image: new ol.style.Circle({
                    fill: new ol.style.Fill({ color: BORDEAUX }),
                    stroke: new ol.style.Stroke({ color: "#FFFFFF", width: 1 }),
                    radius: 4
                })
            })]
        }
    ]
};

new CustomLayer(LAYER_ID, layer, legend);

/* veille de legende vectorielle (mviewer peut dessiner avant que le script arrive) */
var LEGEND_ID = "vector-legend-" + LAYER_ID;
var lastCanvas = null;
setInterval(function () {
    var canvas = document.getElementById(LEGEND_ID);
    if (canvas && canvas !== lastCanvas && mviewer.drawVectorLegend) {
        try { mviewer.drawVectorLegend(LAYER_ID, legend.items); lastCanvas = canvas; } catch (e) {}
    }
}, 1500);
