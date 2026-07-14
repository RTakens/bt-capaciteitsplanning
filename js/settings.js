// Instellingen: grenswaarden die elders (capacity.js, dashboard.js) worden gebruikt.
window.App = window.App || {};

App.settings = (function () {
  const SLEUTEL = 'instellingen';
  const STANDAARD = {
    oranjeGrens: 0.70,          // vanaf deze bezetting: "bijna vol"
    roodGrens: 0.85,            // vanaf deze bezetting: "overbelast"
    minimaleBezetting: 5,       // minimum totaal aantal aanwezige medewerkers per dag
    minimaleBezettingPerRol: {} // { [rolnaam]: minimum aantal }, 0/ontbrekend = geen aparte eis
  };

  function get() {
    return Object.assign({}, STANDAARD, App.storage.laad(SLEUTEL, {}));
  }

  function bewaar(instellingen) {
    App.storage.bewaar(SLEUTEL, instellingen);
  }

  return { get, bewaar, STANDAARD };
})();
