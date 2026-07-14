// Pagina: Capaciteitsplanning / werkitems beheren (CRUD)
window.App = window.App || {};

App.pages.werkitems = (function () {
  let bewerkId = null;

  function render(container) {
    const medewerkers = App.data.medewerkers();
    const magBewerken = App.auth.magBewerken();
    container.innerHTML = `
      <h2>Capaciteitsplanning</h2>
      ${!magBewerken ? '<p class="leeg-melding">Je hebt alleen-lezen toegang; wijzigen is niet mogelijk.</p>' : `
      <div class="card">
        <h3 id="formTitel">Nieuw werkitem</h3>
        <form id="werkitemForm">
          <div class="rij">
            <div class="veld" style="flex:2"><label>Titel</label><input name="titel" required></div>
            <div class="veld"><label>Type werk</label>
              <select name="type">
                <option value="operatie">Operatie</option>
                <option value="valuestream">Valuestream</option>
                <option value="project" selected>Project</option>
              </select>
            </div>
          </div>
          <div class="rij">
            <div class="veld"><label>Startdatum</label><input type="date" name="startDatum" required></div>
            <div class="veld"><label>Einddatum</label><input type="date" name="eindDatum" required></div>
          </div>
          <div class="rij">
            <div class="veld"><label>Team</label><input name="team" value="BT"></div>
            <div class="veld"><label>Applicatie</label><input name="applicatie"></div>
            <div class="veld"><label>Waardestroom</label><input name="waardestroom"></div>
          </div>
          <div class="veld"><label>Status</label>
            <select name="status"><option value="gepland" selected>Gepland</option><option value="lopend">Lopend</option><option value="afgerond">Afgerond</option><option value="geannuleerd">Geannuleerd</option></select>
          </div>
          <div class="veld">
            <label>Betrokken medewerker(s)</label>
            <div class="checklijst" id="medewerkerCheck">${medewerkers.map(m => `<label><input type="checkbox" value="${m.id}"> ${App.ui.escapeHtml(m.naam)}</label>`).join('') || '<em>Geen medewerkers</em>'}</div>
          </div>
          <div class="veld">
            <label>Afhankelijk van (moet eerst afgerond zijn, alleen relevant voor projecten)</label>
            <div class="checklijst" id="afhankelijkCheck">${optiesAfhankelijk(null)}</div>
          </div>
          <div class="veld">
            <label>Weekplanning per medewerker (geschatte uren per week, per persoon)</label>
            <p style="font-size:13px;color:#6b7280;margin:2px 0">Vul periode en medewerkers in en klik hieronder om de weekvelden aan te maken. Vul daarna per week en per medewerker de uren in. Met "Kopieer" zet je één week door naar alle overige weken.</p>
            <button type="button" id="genereerWeekBtn" class="btn secundair klein">Weekvelden aanmaken/verversen</button>
            <div id="weekplanningWrap" class="tabel-wrap" style="margin-top:8px"></div>
          </div>
          <div class="veld"><label>Opmerking</label><input name="opmerking"></div>
          <button type="submit" class="btn">Opslaan</button>
          <button type="button" id="annuleerBtn" class="btn secundair" style="display:none">Annuleren</button>
        </form>
      </div>
      `}
      <div class="card">
        <div class="tabel-wrap">
          <table>
            <thead><tr>
              <th>Titel</th><th>Type</th><th>Periode</th><th>Uren</th><th>Medewerkers</th>
              <th>Team</th><th>Applicatie</th><th>Waardestroom</th><th>Status</th><th></th>
            </tr></thead>
            <tbody id="werkitemTbody"></tbody>
          </table>
        </div>
      </div>
    `;

    vulTabel();
    if (magBewerken) {
      tekenWeekplanning({}, []);
      document.getElementById('werkitemForm').addEventListener('submit', opSlaan);
      document.getElementById('annuleerBtn').addEventListener('click', resetForm);
      document.getElementById('genereerWeekBtn').addEventListener('click', genereerWeekplanning);
    }
  }

  function genereerWeekplanning() {
    const form = document.getElementById('werkitemForm');
    const medewerkerIds = [...document.querySelectorAll('#medewerkerCheck input:checked')].map(cb => cb.value);
    if (!form.startDatum.value || !form.eindDatum.value || !medewerkerIds.length) {
      App.ui.melding('Vul eerst periode en minimaal 1 medewerker in');
      return;
    }
    const start = App.datum.parseIso(form.startDatum.value);
    const eind = App.datum.parseIso(form.eindDatum.value);
    if (start > eind) { App.ui.melding('Startdatum moet voor einddatum liggen'); return; }
    const weken = App.datum.wekenTussen(start, eind);
    const bestaand = lezenWeekUren();
    const weekUren = {};
    weken.forEach(w => {
      weekUren[w.weekKey] = {};
      medewerkerIds.forEach(id => weekUren[w.weekKey][id] = (bestaand[w.weekKey] && bestaand[w.weekKey][id]) || 0);
    });
    tekenWeekplanning(weekUren, medewerkerIds);
  }

  function tekenWeekplanning(weekUren, medewerkerIds) {
    const medewerkers = App.data.medewerkers();
    const wrap = document.getElementById('weekplanningWrap');
    const weekKeys = Object.keys(weekUren).sort();
    if (!weekKeys.length || !medewerkerIds.length) {
      wrap.innerHTML = '<p class="leeg-melding">Nog geen weekplanning. Vul periode en medewerkers in en klik op "Weekvelden aanmaken/verversen".</p>';
      return;
    }
    const gekozen = medewerkerIds.map(id => medewerkers.find(m => m.id === id)).filter(Boolean);
    const header = `<tr><th>Week</th>${gekozen.map(m => `<th>${App.ui.escapeHtml(m.naam)}</th>`).join('')}<th></th></tr>`;
    const rijen = weekKeys.map(wk => {
      const cellen = gekozen.map(m => {
        const waarde = (weekUren[wk] && weekUren[wk][m.id]) || 0;
        return `<td><input type="number" min="0" step="0.5" data-week="${wk}" data-medewerker="${m.id}" value="${waarde}" style="width:70px"></td>`;
      }).join('');
      return `<tr><td>${wk}</td>${cellen}<td><button type="button" class="btn secundair klein" data-kopieer-week="${wk}">Kopieer naar alle weken</button></td></tr>`;
    }).join('');
    wrap.innerHTML = `<table><thead>${header}</thead><tbody>${rijen}</tbody></table>`;

    wrap.querySelectorAll('[data-kopieer-week]').forEach(btn =>
      btn.addEventListener('click', () => kopieerWeekNaarAlle(btn.dataset.kopieerWeek)));
  }

  function kopieerWeekNaarAlle(bronWeek) {
    const waarden = {};
    document.querySelectorAll(`#weekplanningWrap input[data-week="${bronWeek}"]`).forEach(input => {
      waarden[input.dataset.medewerker] = input.value;
    });
    document.querySelectorAll('#weekplanningWrap input[data-week]').forEach(input => {
      if (input.dataset.week !== bronWeek && waarden[input.dataset.medewerker] != null) {
        input.value = waarden[input.dataset.medewerker];
      }
    });
    App.ui.melding('Uren gekopieerd naar alle weken');
  }

  function lezenWeekUren() {
    const result = {};
    document.querySelectorAll('#weekplanningWrap input[data-week]').forEach(input => {
      const wk = input.dataset.week, mid = input.dataset.medewerker;
      if (!result[wk]) result[wk] = {};
      result[wk][mid] = Number(input.value) || 0;
    });
    return result;
  }

  function totaalUrenWerkitem(w) {
    return Object.values(w.weekUren || {}).reduce((som, perWeek) =>
      som + Object.values(perWeek).reduce((s, u) => s + (Number(u) || 0), 0), 0);
  }

  const TYPE_LABEL = { operatie: 'Operatie', valuestream: 'Valuestream', project: 'Project' };

  function naamVan(id, medewerkers) { return (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend'; }

  function optiesAfhankelijk(uitgesloten) {
    const projecten = App.data.werkitems().filter(w => w.id !== uitgesloten);
    if (!projecten.length) return '<em>Geen andere werkitems</em>';
    return projecten.map(w => `<label><input type="checkbox" value="${w.id}"> ${App.ui.escapeHtml(w.titel)}</label>`).join('');
  }

  function vulTabel() {
    const lijst = App.data.werkitems();
    const medewerkers = App.data.medewerkers();
    const tbody = document.getElementById('werkitemTbody');
    if (!lijst.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="leeg-melding">Nog geen werkitems toegevoegd.</td></tr>';
      return;
    }
    tbody.innerHTML = lijst.map(w => `
      <tr>
        <td>${App.ui.escapeHtml(w.titel)}</td>
        <td>${TYPE_LABEL[w.type] || w.type}</td>
        <td>${w.startDatum} &rarr; ${w.eindDatum}</td>
        <td>${totaalUrenWerkitem(w)}</td>
        <td>${w.medewerkerIds.map(id => App.ui.escapeHtml(naamVan(id, medewerkers))).join(', ')}</td>
        <td>${App.ui.escapeHtml(w.team)}</td>
        <td>${App.ui.escapeHtml(w.applicatie)}</td>
        <td>${App.ui.escapeHtml(w.waardestroom)}</td>
        <td>${App.ui.escapeHtml(w.status)}</td>
        <td>
          ${App.auth.magBewerken() ? `<button class="btn secundair klein" data-actie="wijzig" data-id="${w.id}">Wijzig</button>
          <button class="btn gevaar klein" data-actie="verwijder" data-id="${w.id}">Verwijder</button>` : ''}
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-actie="wijzig"]').forEach(b => b.addEventListener('click', () => beginWijzig(b.dataset.id)));
    tbody.querySelectorAll('[data-actie="verwijder"]').forEach(b => b.addEventListener('click', () => verwijder(b.dataset.id)));
  }

  function beginWijzig(id) {
    const w = App.data.werkitems().find(x => x.id === id);
    if (!w) return;
    bewerkId = id;
    const form = document.getElementById('werkitemForm');
    form.titel.value = w.titel;
    form.type.value = w.type;
    form.startDatum.value = w.startDatum;
    form.eindDatum.value = w.eindDatum;
    form.team.value = w.team;
    form.applicatie.value = w.applicatie;
    form.waardestroom.value = w.waardestroom;
    form.status.value = w.status;
    form.opmerking.value = w.opmerking || '';
    document.querySelectorAll('#medewerkerCheck input').forEach(cb => { cb.checked = w.medewerkerIds.includes(cb.value); });
    document.getElementById('afhankelijkCheck').innerHTML = optiesAfhankelijk(w.id);
    document.querySelectorAll('#afhankelijkCheck input').forEach(cb => { cb.checked = (w.afhankelijkVan || []).includes(cb.value); });
    tekenWeekplanning(w.weekUren || {}, w.medewerkerIds);
    document.getElementById('formTitel').textContent = 'Werkitem wijzigen';
    document.getElementById('annuleerBtn').style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    bewerkId = null;
    const form = document.getElementById('werkitemForm');
    form.reset();
    form.team.value = 'BT';
    document.querySelectorAll('#medewerkerCheck input').forEach(cb => cb.checked = false);
    document.getElementById('afhankelijkCheck').innerHTML = optiesAfhankelijk(null);
    tekenWeekplanning({}, []);
    document.getElementById('formTitel').textContent = 'Nieuw werkitem';
    document.getElementById('annuleerBtn').style.display = 'none';
  }

  function opSlaan(e) {
    e.preventDefault();
    const form = e.target;
    const medewerkerIds = [...document.querySelectorAll('#medewerkerCheck input:checked')].map(cb => cb.value);
    const data = {
      titel: form.titel.value.trim(),
      type: form.type.value,
      startDatum: form.startDatum.value,
      eindDatum: form.eindDatum.value,
      medewerkerIds,
      team: form.team.value.trim(),
      applicatie: form.applicatie.value.trim(),
      waardestroom: form.waardestroom.value.trim(),
      status: form.status.value,
      opmerking: form.opmerking.value.trim(),
      weekUren: lezenWeekUren(),
      afhankelijkVan: [...document.querySelectorAll('#afhankelijkCheck input:checked')].map(cb => cb.value)
    };
    if (!data.titel || data.startDatum > data.eindDatum) {
      App.ui.melding('Controleer titel en periode (startdatum moet voor einddatum liggen)');
      return;
    }
    if (!Object.keys(data.weekUren).length) {
      App.ui.melding('Maak eerst de weekplanning aan en vul de uren per week/medewerker in');
      return;
    }

    const lijst = App.data.werkitems();
    if (bewerkId) {
      App.data.upsert(lijst, Object.assign({ id: bewerkId }, data));
      App.ui.melding('Werkitem gewijzigd');
    } else {
      App.data.upsert(lijst, App.model.nieuwWerkitem(data));
      App.ui.melding('Werkitem toegevoegd');
    }
    App.data.bewaarWerkitems(lijst);
    resetForm();
    vulTabel();
  }

  function verwijder(id) {
    if (!confirm('Dit werkitem verwijderen?')) return;
    App.data.bewaarWerkitems(App.data.verwijder(App.data.werkitems(), id));
    App.ui.melding('Werkitem verwijderd');
    vulTabel();
  }

  return { render, TYPE_LABEL };
})();
