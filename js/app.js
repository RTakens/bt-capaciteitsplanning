// Navigatie tussen pagina's. Elke pagina-module (App.pages.xxx) heeft een render(container)-functie.
window.App = window.App || {};
App.pages = App.pages || {};

(function () {
  const container = document.getElementById('pageContent');
  const PAGINA_VOLGORDE = ['dashboard', 'verlof', 'standby', 'werkitems', 'projecten', 'rapportages', 'instellingen'];

  function render(pagina) {
    if (!App.auth.magPagina(pagina)) {
      container.innerHTML = '<p class="leeg-melding">Geen toegang tot deze pagina.</p>';
      return;
    }
    document.querySelectorAll('.tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === pagina);
    });
    const mod = App.pages[pagina];
    if (mod && mod.render) {
      mod.render(container);
    } else {
      container.innerHTML = '<p class="leeg-melding">Pagina nog niet beschikbaar.</p>';
    }
  }

  function pasNavigatieAan() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.style.display = App.auth.magPagina(btn.dataset.page) ? '' : 'none';
    });
  }

  document.getElementById('mainNav').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    render(btn.dataset.page);
  });

  document.addEventListener('DOMContentLoaded', () => {
    App.seed();
    App.seedGebruikers();
    App.auth.init(() => {
      pasNavigatieAan();
      const eerstePagina = PAGINA_VOLGORDE.find(p => App.auth.magPagina(p)) || 'verlof';
      render(eerstePagina);
    });
  });
})();
