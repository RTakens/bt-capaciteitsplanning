// Generieke localStorage-laag. Later te vervangen door een API (bv. voor JIRA-sync)
// zonder dat de rest van de app hoeft te weten waar de data vandaan komt.
window.App = window.App || {};

App.storage = (function () {
  const PREFIX = 'btcp_';

  function laad(sleutel, standaard) {
    const raw = localStorage.getItem(PREFIX + sleutel);
    if (!raw) return standaard;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Kon data niet lezen voor', sleutel, e);
      return standaard;
    }
  }

  function bewaar(sleutel, data) {
    localStorage.setItem(PREFIX + sleutel, JSON.stringify(data));
  }

  function isGeinitialiseerd() {
    return localStorage.getItem(PREFIX + 'geinitialiseerd') === 'ja';
  }

  function markeerGeinitialiseerd() {
    localStorage.setItem(PREFIX + 'geinitialiseerd', 'ja');
  }

  return { laad, bewaar, isGeinitialiseerd, markeerGeinitialiseerd };
})();
