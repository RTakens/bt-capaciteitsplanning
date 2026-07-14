// Pagina: Instellingen (drempels, medewerkers, gebruikers) - alleen bereikbaar voor Admin
window.App = window.App || {};

App.pages.instellingen = (function () {
  let subtab = 'drempels';
  let bewerkGebruikerId = null;

  function render(container) {
    container.innerHTML = `
      <h2>Instellingen</h2>
      <nav class="tabs" style="margin-bottom:16px">
        <button class="tab ${subtab === 'drempels' ? 'active' : ''}" data-subtab="drempels">Drempels</button>
        <button class="tab ${subtab === 'medewerkers' ? 'active' : ''}" data-subtab="medewerkers">Medewerkers</button>
        <button class="tab ${subtab === 'gebruikers' ? 'active' : ''}" data-subtab="gebruikers">Gebruikers</button>
      </nav>
      <div id="instellingenInhoud"></div>
    `;

    container.querySelectorAll('[data-subtab]').forEach(b => b.addEventListener('click', () => {
      subtab = b.dataset.subtab;
      render(container);
    }));

    tekenSubtab();
  }

  function tekenSubtab() {
    const inhoud = document.getElementById('instellingenInhoud');
    if (subtab === 'medewerkers') { App.pages.medewerkers.render(inhoud); return; }
    if (subtab === 'gebruikers') { tekenGebruikers(inhoud); return; }
    tekenDrempels(inhoud);
  }

  function tekenDrempels(container) {
    const s = App.settings.get();
    const rollen = [...new Set(App.data.medewerkers().map(m => m.rol).filter(Boolean))];

    container.innerHTML = `
      <div class="card">
        <h3>Bezetting per medewerker (Dashboard)</h3>
        <p style="font-size:13px;color:var(--tekst-secundair)">Vanaf welke bezetting geldt een medewerker als "bijna vol" (oranje) of "overbelast" (rood)?</p>
        <form id="drempelForm">
          <div class="rij">
            <div class="veld"><label>Bijna vol vanaf (%)</label><input type="number" name="oranjeGrens" min="0" max="100" step="1" value="${Math.round(s.oranjeGrens * 100)}" required></div>
            <div class="veld"><label>Overbelast vanaf (%)</label><input type="number" name="roodGrens" min="0" max="100" step="1" value="${Math.round(s.roodGrens * 100)}" required></div>
          </div>
          <button type="submit" class="btn">Opslaan</button>
        </form>
      </div>

      <div class="card">
        <h3>Minimale bezetting (Dashboard)</h3>
        <p style="font-size:13px;color:var(--tekst-secundair)">Minimum aantal medewerkers dat per dag aanwezig moet zijn. Een dag met minder aanwezige medewerkers (totaal, of voor een specifieke rol) wordt rood gemarkeerd in het bezettingsoverzicht.</p>
        <form id="bezettingForm">
          <div class="veld"><label>Minimale bezetting totaal (aantal medewerkers)</label><input type="number" name="minimaleBezetting" min="0" step="1" value="${s.minimaleBezetting}" required></div>
          ${rollen.length ? `<h4 style="margin-bottom:6px">Per rol (0 = geen aparte eis)</h4>
          <div class="rij">
            ${rollen.map(rol => `<div class="veld"><label>${App.ui.escapeHtml(rol)}</label><input type="number" name="rol__${App.ui.escapeHtml(rol)}" min="0" step="1" value="${s.minimaleBezettingPerRol[rol] || 0}"></div>`).join('')}
          </div>` : ''}
          <button type="submit" class="btn">Opslaan</button>
        </form>
      </div>
    `;

    document.getElementById('drempelForm').addEventListener('submit', opslaanDrempels);
    document.getElementById('bezettingForm').addEventListener('submit', opslaanBezetting);
  }

  function opslaanDrempels(e) {
    e.preventDefault();
    const form = e.target;
    const oranje = Number(form.oranjeGrens.value) / 100;
    const rood = Number(form.roodGrens.value) / 100;
    if (oranje >= rood) {
      App.ui.melding('"Bijna vol" moet lager zijn dan "overbelast"');
      return;
    }
    App.settings.bewaar(Object.assign({}, App.settings.get(), { oranjeGrens: oranje, roodGrens: rood }));
    App.ui.melding('Drempels opgeslagen');
  }

  function opslaanBezetting(e) {
    e.preventDefault();
    const form = e.target;
    const minimaleBezettingPerRol = {};
    [...form.elements].forEach(el => {
      if (el.name && el.name.startsWith('rol__')) {
        minimaleBezettingPerRol[el.name.slice(5)] = Number(el.value) || 0;
      }
    });
    App.settings.bewaar(Object.assign({}, App.settings.get(), {
      minimaleBezetting: Number(form.minimaleBezetting.value) || 0,
      minimaleBezettingPerRol
    }));
    App.ui.melding('Minimale bezetting opgeslagen');
  }

  function tekenGebruikers(container) {
    const medewerkers = App.data.medewerkers();
    const gebruikers = App.data.gebruikers();
    const optiesRol = App.model.ROLLEN.map(r => `<option value="${r}">${App.model.ROL_LABEL[r]}</option>`).join('');
    const optiesMedewerker = '<option value="">Geen koppeling</option>' + medewerkers.map(m => `<option value="${m.id}">${App.ui.escapeHtml(m.naam)}</option>`).join('');
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || '-';

    container.innerHTML = `
      <div class="card">
        <h3 id="gebruikerFormTitel">Nieuwe gebruiker</h3>
        <form id="gebruikerForm">
          <div class="rij">
            <div class="veld"><label>Gebruikersnaam</label><input name="gebruikersnaam" required></div>
            <div class="veld"><label>Wachtwoord</label><input name="wachtwoord" required></div>
          </div>
          <div class="rij">
            <div class="veld"><label>Rol</label><select name="rol">${optiesRol}</select></div>
            <div class="veld"><label>Gekoppelde medewerker</label><select name="medewerkerId">${optiesMedewerker}</select></div>
          </div>
          <button type="submit" class="btn">Opslaan</button>
          <button type="button" id="annuleerGebruikerBtn" class="btn secundair" style="display:none">Annuleren</button>
        </form>
      </div>
      <div class="card">
        <div class="tabel-wrap">
          <table>
            <thead><tr><th>Gebruikersnaam</th><th>Rol</th><th>Gekoppelde medewerker</th><th></th></tr></thead>
            <tbody>${gebruikers.map((g, idx) => `
              <tr>
                <td>${App.ui.escapeHtml(g.gebruikersnaam)}</td>
                <td>${App.model.ROL_LABEL[g.rol] || g.rol}</td>
                <td>${App.ui.escapeHtml(naamVan(g.medewerkerId))}</td>
                <td>
                  <button class="btn secundair klein" data-actie="wijzig" data-idx="${idx}">Wijzig</button>
                  <button class="btn gevaar klein" data-actie="verwijder" data-idx="${idx}">Verwijder</button>
                </td>
              </tr>
            `).join('') || '<tr><td colspan="4" class="leeg-melding">Nog geen gebruikers.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('gebruikerForm').addEventListener('submit', opslaanGebruiker);
    document.getElementById('annuleerGebruikerBtn').addEventListener('click', resetGebruikerForm);
    document.querySelectorAll('[data-actie="wijzig"]').forEach(b => b.addEventListener('click', () => beginWijzigGebruiker(gebruikers[Number(b.dataset.idx)])));
    document.querySelectorAll('[data-actie="verwijder"]').forEach(b => b.addEventListener('click', () => verwijderGebruiker(gebruikers[Number(b.dataset.idx)])));
  }

  function beginWijzigGebruiker(g) {
    bewerkGebruikerId = g.id;
    const form = document.getElementById('gebruikerForm');
    form.gebruikersnaam.value = g.gebruikersnaam;
    form.wachtwoord.value = g.wachtwoord;
    form.rol.value = g.rol;
    form.medewerkerId.value = g.medewerkerId || '';
    document.getElementById('gebruikerFormTitel').textContent = 'Gebruiker wijzigen';
    document.getElementById('annuleerGebruikerBtn').style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function resetGebruikerForm() {
    bewerkGebruikerId = null;
    const inhoud = document.getElementById('instellingenInhoud');
    if (inhoud) tekenGebruikers(inhoud);
  }

  function opslaanGebruiker(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      gebruikersnaam: form.gebruikersnaam.value.trim(),
      wachtwoord: form.wachtwoord.value.trim(),
      rol: form.rol.value,
      medewerkerId: form.medewerkerId.value
    };
    if (!data.gebruikersnaam || !data.wachtwoord) return;

    const lijst = App.data.gebruikers();
    const bestaandeNaam = lijst.find(g => g.gebruikersnaam.toLowerCase() === data.gebruikersnaam.toLowerCase() && g.id !== bewerkGebruikerId);
    if (bestaandeNaam) {
      App.ui.melding('Deze gebruikersnaam bestaat al');
      return;
    }

    if (bewerkGebruikerId) {
      App.data.upsert(lijst, Object.assign({ id: bewerkGebruikerId }, data));
      App.ui.melding('Gebruiker gewijzigd');
    } else {
      App.data.upsert(lijst, App.model.nieuweGebruiker(data));
      App.ui.melding('Gebruiker toegevoegd');
    }
    App.data.bewaarGebruikers(lijst);
    bewerkGebruikerId = null;
    tekenGebruikers(document.getElementById('instellingenInhoud'));
  }

  function verwijderGebruiker(g) {
    if (!confirm(`Gebruiker "${g.gebruikersnaam}" verwijderen?`)) return;
    App.data.bewaarGebruikers(App.data.verwijder(App.data.gebruikers(), g.id));
    App.ui.melding('Gebruiker verwijderd');
    tekenGebruikers(document.getElementById('instellingenInhoud'));
  }

  return { render };
})();
