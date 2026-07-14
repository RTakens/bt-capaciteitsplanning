// Inlogscherm + rolrechten voor het prototype. LET OP: dit is client-side en dus geen
// echte beveiliging (te omzeilen via devtools) - puur een toegangsscherm/demo van rollen.
// Later te vervangen door echte authenticatie zonder de rest van de app te hoeven wijzigen.
window.App = window.App || {};

App.auth = (function () {
  const SLEUTEL = 'btcp_gebruiker_id';

  // paginas: null = alle paginas. alleenLezen: geen enkele wijziging toegestaan.
  const ROLRECHTEN = {
    teamlead: {
      paginas: null, alleenLezen: false, alleenEigenVerlof: false, magGoedkeuren: true
    },
    projectmanager: {
      paginas: ['verlof', 'standby', 'werkitems', 'projecten', 'rapportages'],
      alleenLezen: false, alleenEigenVerlof: true, magGoedkeuren: false
    },
    teammember: {
      paginas: ['verlof', 'standby', 'werkitems', 'projecten', 'rapportages'],
      alleenLezen: false, alleenEigenVerlof: true, magGoedkeuren: false
    },
    viewer: {
      paginas: ['dashboard', 'verlof', 'standby', 'werkitems', 'projecten', 'rapportages'],
      alleenLezen: true, alleenEigenVerlof: false, magGoedkeuren: false
    }
  };

  function huidigeGebruiker() {
    const id = sessionStorage.getItem(SLEUTEL);
    if (!id) return null;
    return App.data.gebruikers().find(g => g.id === id) || null;
  }

  function isIngelogd() {
    return !!huidigeGebruiker();
  }

  function rechten() {
    const g = huidigeGebruiker();
    return (g && ROLRECHTEN[g.rol]) || ROLRECHTEN.viewer;
  }

  function magPagina(pagina) {
    const p = rechten().paginas;
    return p === null || p.includes(pagina);
  }

  function magBewerken() { return !rechten().alleenLezen; }
  function magGoedkeuren() { return rechten().magGoedkeuren; }
  function alleenEigenVerlof() { return rechten().alleenEigenVerlof; }
  function eigenMedewerkerId() { const g = huidigeGebruiker(); return g ? g.medewerkerId : null; }

  function controleer(gebruikersnaam, wachtwoord) {
    return App.data.gebruikers().find(g =>
      g.gebruikersnaam.trim().toUpperCase() === gebruikersnaam.trim().toUpperCase() &&
      g.wachtwoord.trim().toUpperCase() === wachtwoord.trim().toUpperCase());
  }

  function uitloggen() {
    sessionStorage.removeItem(SLEUTEL);
  }

  function toonApp() {
    document.getElementById('loginScherm').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
  }

  function toonLogin() {
    document.getElementById('appShell').classList.add('hidden');
    document.getElementById('loginScherm').classList.remove('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginFout').classList.add('hidden');
  }

  function init(bijGeslaagd) {
    document.getElementById('loginForm').addEventListener('submit', e => {
      e.preventDefault();
      const form = e.target;
      const match = controleer(form.gebruiker.value, form.wachtwoord.value);
      if (match) {
        sessionStorage.setItem(SLEUTEL, match.id);
        toonApp();
        bijGeslaagd();
      } else {
        document.getElementById('loginFout').classList.remove('hidden');
      }
    });

    document.getElementById('uitloggenBtn').addEventListener('click', () => {
      uitloggen();
      toonLogin();
    });

    if (isIngelogd()) {
      toonApp();
      bijGeslaagd();
    } else {
      toonLogin();
    }
  }

  return {
    isIngelogd, uitloggen, toonApp, toonLogin, init, huidigeGebruiker,
    magPagina, magBewerken, magGoedkeuren, alleenEigenVerlof, eigenMedewerkerId, ROLRECHTEN
  };
})();
