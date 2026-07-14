// Pagina: Medewerkers beheren (CRUD)
window.App = window.App || {};

App.pages.medewerkers = (function () {
  let bewerkId = null;

  function render(container) {
    const lijst = App.data.medewerkers();
    container.innerHTML = `
      <h2>Medewerkers</h2>
      <div class="card">
        <h3 id="formTitel">Nieuwe medewerker</h3>
        <form id="medewerkerForm">
          <div class="rij">
            <div class="veld"><label>Naam</label><input name="naam" required></div>
            <div class="veld"><label>Team</label><input name="team" value="BT"></div>
            <div class="veld"><label>Rol/functie</label><input name="rol"></div>
          </div>
          <div class="veld">
            <label style="display:flex;align-items:center;gap:6px;font-weight:normal"><input type="checkbox" name="standbyDienst"> Draait standby-diensten</label>
          </div>
          <button type="submit" class="btn">Opslaan</button>
          <button type="button" id="annuleerBtn" class="btn secundair" style="display:none">Annuleren</button>
        </form>
      </div>
      <div class="card">
        <div class="tabel-wrap">
          <table>
            <thead><tr><th>Naam</th><th>Team</th><th>Rol</th><th>Standby</th><th></th></tr></thead>
            <tbody id="medewerkerTbody"></tbody>
          </table>
        </div>
      </div>
    `;

    vulTabel(lijst);
    document.getElementById('medewerkerForm').addEventListener('submit', opSlaan);
    document.getElementById('annuleerBtn').addEventListener('click', () => resetForm());
  }

  function vulTabel(lijst) {
    const tbody = document.getElementById('medewerkerTbody');
    if (!lijst.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="leeg-melding">Nog geen medewerkers toegevoegd.</td></tr>';
      return;
    }
    tbody.innerHTML = lijst.map(m => `
      <tr>
        <td>${App.ui.escapeHtml(m.naam)}</td>
        <td>${App.ui.escapeHtml(m.team)}</td>
        <td>${App.ui.escapeHtml(m.rol)}</td>
        <td>${m.standbyDienst ? 'Ja' : 'Nee'}</td>
        <td>
          <button class="btn secundair klein" data-actie="wijzig" data-id="${m.id}">Wijzig</button>
          <button class="btn gevaar klein" data-actie="verwijder" data-id="${m.id}">Verwijder</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-actie="wijzig"]').forEach(b => b.addEventListener('click', () => beginWijzig(b.dataset.id)));
    tbody.querySelectorAll('[data-actie="verwijder"]').forEach(b => b.addEventListener('click', () => verwijder(b.dataset.id)));
  }

  function beginWijzig(id) {
    const m = App.data.medewerkers().find(x => x.id === id);
    if (!m) return;
    bewerkId = id;
    const form = document.getElementById('medewerkerForm');
    form.naam.value = m.naam;
    form.team.value = m.team;
    form.rol.value = m.rol;
    form.standbyDienst.checked = !!m.standbyDienst;
    document.getElementById('formTitel').textContent = 'Medewerker wijzigen';
    document.getElementById('annuleerBtn').style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    bewerkId = null;
    const form = document.getElementById('medewerkerForm');
    form.reset();
    form.team.value = 'BT';
    document.getElementById('formTitel').textContent = 'Nieuwe medewerker';
    document.getElementById('annuleerBtn').style.display = 'none';
  }

  function opSlaan(e) {
    e.preventDefault();
    const form = e.target;
    const data = {
      naam: form.naam.value.trim(),
      team: form.team.value.trim(),
      rol: form.rol.value.trim(),
      standbyDienst: form.standbyDienst.checked
    };
    if (!data.naam) return;

    const lijst = App.data.medewerkers();
    if (bewerkId) {
      App.data.upsert(lijst, Object.assign({ id: bewerkId }, data));
      App.ui.melding('Medewerker gewijzigd');
    } else {
      App.data.upsert(lijst, App.model.nieuweMedewerker(data));
      App.ui.melding('Medewerker toegevoegd');
    }
    App.data.bewaarMedewerkers(lijst);
    resetForm();
    vulTabel(App.data.medewerkers());
  }

  function verwijder(id) {
    if (!confirm('Deze medewerker verwijderen? Gekoppeld verlof en werkitems blijven bestaan maar verwijzen dan naar een onbekende medewerker.')) return;
    App.data.bewaarMedewerkers(App.data.verwijder(App.data.medewerkers(), id));
    App.ui.melding('Medewerker verwijderd');
    vulTabel(App.data.medewerkers());
  }

  return { render };
})();
