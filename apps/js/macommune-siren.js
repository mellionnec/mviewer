// Valeur par défaut du siren : commune de Mellionnec (Côtes-d'Armor)
// Reprise du fonctionnement de l'application "Ma commune" de GéoBretagne
// (https://geobretagne.fr/app/macommune/?siren=212201461), sans exiger
// le parametre siren dans l'URL de la carte.
if (!API.siren || !/^[0-9]{9}$/.test(API.siren)) {
    API.siren = "212201461";
}
