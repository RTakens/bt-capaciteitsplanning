// Pagina: Standby-rooster (genereren, overdragen, ruilen). Resultaat blijft zichtbaar in Verlofplanning
// via gegenereerde LeaveEntry's (type 'standby', getagd met dienstId zodat ze precies terug te vinden zijn).
window.App = window.App || {};

App.pages.standby = (function () {
  let actieDienstId = null; // dienst waarvoor het overdracht/ruil-formulier open staat
  let actieType = null; // 'overdracht' | 'ruil'

  function render(container) {
    container.innerHTML = `
      <h2>Standby</h2>
      <div id="standbyGenereerWrap"></div>
      <div class="card">
        <h3>Overdracht- en ruilverzoeken</h3>
        <div id="standbyVerzoekenWrap"></div>
      </div>
      <div class="card">
        <h3>Rooster</h3>
        <div id="standbyRoosterWrap" class="tabel-wrap"></div>
      </div>
    `;
    teken();
  }

  function teken() {
    tekenGenereerForm();
    tekenVerzoeken();
    tekenRooster();
  }

  function tekenGenereerForm() {
    const wrap = document.getElementById('standbyGenereerWrap');
    if (!App.auth.magGoedkeuren()) { wrap.innerHTML = ''; return; }
    const standaardStart = App.datum.naarIso(App.datum.periodeBereik('week', new Date()).start);
    wrap.innerHTML = `
      <div class="card">
        <h3>Rooster genereren</h3>
        <p style="font-size:13px;color:var(--tekst-secundair)">Verdeelt de standby-diensten automatisch over de medewerkers die bij Instellingen &gt; Medewerkers als standby-medewerker zijn gemarkeerd: altijd precies 1 persoon per week, iedereen (zo goed als) evenveel diensten, en de diensten van één persoon zo ver mogelijk uit elkaar. Houdt rekening met bestaand verlof (afwezig/verzoek) — iemand met verlof die week wordt overgeslagen. Terugkerend verlof wordt zoveel mogelijk vermeden, maar mag worden overschreden als niemand anders beschikbaar is. Overschrijft bestaande diensten in de gekozen periode.</p>
        <form id="genereerForm">
          <div class="rij">
            <div class="veld"><label>Startweek (datum in die week)</label><input type="date" name="startDatum" value="${standaardStart}" required></div>
            <div class="veld"><label>Aantal weken</label>
              <select name="aantalWeken">
                <option value="4">4 weken</option>
                <option value="12" selected>12 weken</option>
                <option value="26">26 weken</option>
                <option value="52">52 weken</option>
              </select>
            </div>
          </div>
          <button type="submit" class="btn">Rooster genereren</button>
        </form>
      </div>
    `;
    document.getElementById('genereerForm').addEventListener('submit', e => { e.preventDefault(); genereerRooster(e.target); });
  }

  function weekKeyReeks(startMaandag, aantal) {
    const weken = [];
    const cursor = new Date(startMaandag.getTime());
    for (let i = 0; i < aantal; i++) {
      weken.push(App.datum.weekKey(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return weken;
  }

  // (Her)genereert de gekoppelde standby-verlofregels voor één dienst n.a.v. de huidige medewerkerId.
  function stelDienstVerlofSamen(dienst) {
    let verlof = App.data.verlof().filter(v => !(dienst.verlofIds || []).includes(v.id));
    const maandag = App.datum.maandagVanWeekKey(dienst.weekKey);
    const zondag = new Date(maandag.getTime()); zondag.setDate(zondag.getDate() + 6);
    const nieuweIds = [];
    App.datum.werkdagenTussen(maandag, zondag).forEach(dag => {
      const entry = App.model.nieuwVerlof({
        medewerkerId: dienst.medewerkerId, datum: App.datum.naarIso(dag), type: 'standby', dagdeel: 'hele-dag',
        opmerking: 'Standby-rooster', dienstId: dienst.id
      });
      verlof.push(entry);
      nieuweIds.push(entry.id);
    });
    App.data.bewaarVerlof(verlof);
    dienst.verlofIds = nieuweIds;
  }

  function genereerRooster(form) {
    const eligible = App.data.medewerkers().filter(m => m.standbyDienst);
    if (!eligible.length) {
      App.ui.melding('Stel eerst bij Instellingen > Medewerkers in wie standby-diensten draait.');
      return;
    }
    if (!form.startDatum.value) { App.ui.melding('Kies een startdatum'); return; }
    const aantalWeken = Number(form.aantalWeken.value);
    const gekozenDag = App.datum.parseIso(form.startDatum.value);
    const dagOffset = (gekozenDag.getDay() + 6) % 7;
    const startMaandag = new Date(gekozenDag.getTime());
    startMaandag.setDate(startMaandag.getDate() - dagOffset);

    const weekKeys = weekKeyReeks(startMaandag, aantalWeken);
    if (!confirm(`Dit genereert een rooster voor ${aantalWeken} weken (vanaf week van ${App.datum.formatKort(startMaandag)}) en overschrijft bestaande standby-diensten in die periode. Doorgaan?`)) return;

    let diensten = App.data.standbyDiensten();
    const teVerwijderen = diensten.filter(d => weekKeys.includes(d.weekKey));
    const teVerwijderenIds = new Set(teVerwijderen.map(d => d.id));
    const verlofIdsTeVerwijderen = new Set(teVerwijderen.flatMap(d => d.verlofIds || []));

    let verlof = App.data.verlof().filter(v => !verlofIdsTeVerwijderen.has(v.id));
    App.data.bewaarVerlof(verlof);
    diensten = diensten.filter(d => !weekKeys.includes(d.weekKey));
    App.data.bewaarStandbyVerzoeken(App.data.standbyVerzoeken().filter(v =>
      !teVerwijderenIds.has(v.dienstId) && !teVerwijderenIds.has(v.ruilDienstId)));

    // Houdt rekening met bestaand verlof (afwezig/verzoek): iemand met zo'n verlof die week wordt overgeslagen.
    // Terugkerend verlof telt alleen mee als niemand anders beschikbaar is (mag dan overschreden worden).
    // Eerlijkheid (aantal diensten, spreiding) blijft leidend via de sortering per week.
    function heeftVerlofConflict(medewerkerId, maandag, zondag, negeerHerhalend) {
      return App.datum.werkdagenTussen(maandag, zondag).some(dag => {
        const iso = App.datum.naarIso(dag);
        return verlof.some(v => v.medewerkerId === medewerkerId && v.datum === iso &&
          (v.type === 'afwezig' || v.type === 'verzoek') && !(negeerHerhalend && v.herhalend));
      });
    }

    const telling = {}, laatsteWeekIndex = {};
    eligible.forEach(m => { telling[m.id] = 0; laatsteWeekIndex[m.id] = -Infinity; });

    weekKeys.forEach((weekKey, weekIndex) => {
      const maandag = App.datum.maandagVanWeekKey(weekKey);
      const zondag = new Date(maandag.getTime()); zondag.setDate(zondag.getDate() + 6);
      const gesorteerd = eligible.slice().sort((a, b) =>
        telling[a.id] - telling[b.id] || laatsteWeekIndex[a.id] - laatsteWeekIndex[b.id]);

      let gekozen = gesorteerd.find(m => !heeftVerlofConflict(m.id, maandag, zondag, false));
      if (!gekozen) gekozen = gesorteerd.find(m => !heeftVerlofConflict(m.id, maandag, zondag, true));
      if (!gekozen) gekozen = gesorteerd[0];

      const dienst = App.model.nieuweStandbyDienst({ weekKey, medewerkerId: gekozen.id });
      stelDienstVerlofSamen(dienst);
      diensten.push(dienst);
      telling[gekozen.id]++;
      laatsteWeekIndex[gekozen.id] = weekIndex;
    });

    App.data.bewaarStandbyDiensten(diensten);
    App.ui.melding(`Rooster gegenereerd voor ${aantalWeken} weken (${eligible.length} standby-medewerkers)`);
    teken();
  }

  function tekenRooster() {
    const wrap = document.getElementById('standbyRoosterWrap');
    const diensten = App.data.standbyDiensten().slice().sort((a, b) => a.weekKey.localeCompare(b.weekKey));
    const medewerkers = App.data.medewerkers();
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    const eigenId = App.auth.eigenMedewerkerId();
    const isAdmin = App.auth.magGoedkeuren();
    const magBewerken = App.auth.magBewerken();
    const openVerzoeken = App.data.standbyVerzoeken().filter(v => v.status === 'open');

    if (!diensten.length) {
      wrap.innerHTML = '<p class="leeg-melding">Nog geen rooster gegenereerd.</p>';
      return;
    }

    wrap.innerHTML = `<table>
      <thead><tr><th>Week</th><th>Periode</th><th>Medewerker</th><th>Status</th><th></th></tr></thead>
      <tbody>${diensten.map(d => {
        const maandag = App.datum.maandagVanWeekKey(d.weekKey);
        const zondag = new Date(maandag.getTime()); zondag.setDate(zondag.getDate() + 6);
        const periode = `${App.datum.formatKort(maandag)} t/m ${App.datum.formatKort(zondag)}`;
        const magActie = magBewerken && (isAdmin || d.medewerkerId === eigenId);
        const lopendVerzoek = openVerzoeken.find(v => v.dienstId === d.id || v.ruilDienstId === d.id);
        const isActieRij = actieDienstId === d.id;
        return `<tr>
          <td>${d.weekKey}</td>
          <td>${periode}</td>
          <td>${App.ui.escapeHtml(naamVan(d.medewerkerId))}</td>
          <td>${lopendVerzoek ? '<span class="badge verzoek">Verzoek in behandeling</span>' : '-'}</td>
          <td>${magActie && !lopendVerzoek ? `
            <button type="button" class="btn secundair klein" data-start-actie="overdracht" data-dienst="${d.id}">Overdragen</button>
            <button type="button" class="btn secundair klein" data-start-actie="ruil" data-dienst="${d.id}">Ruilen</button>
          ` : ''}</td>
        </tr>${isActieRij ? `<tr><td colspan="5" style="background:var(--grijs-bg)">${tekenActieForm(d, diensten, medewerkers)}</td></tr>` : ''}`;
      }).join('')}</tbody>
    </table>`;

    wrap.querySelectorAll('[data-start-actie]').forEach(b => b.addEventListener('click', () => {
      actieDienstId = b.dataset.dienst;
      actieType = b.dataset.startActie;
      teken();
    }));
    wrap.querySelectorAll('[data-annuleer-actie]').forEach(b => b.addEventListener('click', () => {
      actieDienstId = null; actieType = null; teken();
    }));
    wrap.querySelectorAll('[data-verstuur-overdracht]').forEach(b => b.addEventListener('click', () => verstuurOverdracht(b.dataset.verstuurOverdracht)));
    wrap.querySelectorAll('[data-verstuur-ruil]').forEach(b => b.addEventListener('click', () => verstuurRuil(b.dataset.verstuurRuil)));
  }

  function tekenActieForm(dienst, alleDiensten, medewerkers) {
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    if (actieType === 'overdracht') {
      const eligible = medewerkers.filter(m => m.standbyDienst && m.id !== dienst.medewerkerId);
      if (!eligible.length) return '<p class="leeg-melding">Geen andere standby-medewerkers beschikbaar.</p><button type="button" class="btn secundair klein" data-annuleer-actie>Annuleren</button>';
      return `
        <div class="veld" style="max-width:320px">
          <label>Overdragen aan</label>
          <select id="overdrachtDoel">${eligible.map(m => `<option value="${m.id}">${App.ui.escapeHtml(m.naam)}</option>`).join('')}</select>
        </div>
        <button type="button" class="btn klein" data-verstuur-overdracht="${dienst.id}">Verzoek versturen</button>
        <button type="button" class="btn secundair klein" data-annuleer-actie>Annuleren</button>
      `;
    }
    const andereDiensten = alleDiensten.filter(d => d.id !== dienst.id && d.medewerkerId !== dienst.medewerkerId);
    if (!andereDiensten.length) return '<p class="leeg-melding">Geen andere diensten om mee te ruilen.</p><button type="button" class="btn secundair klein" data-annuleer-actie>Annuleren</button>';
    return `
      <div class="veld" style="max-width:320px">
        <label>Ruilen met</label>
        <select id="ruilDoel">${andereDiensten.map(d => `<option value="${d.id}">${d.weekKey} — ${App.ui.escapeHtml(naamVan(d.medewerkerId))}</option>`).join('')}</select>
      </div>
      <button type="button" class="btn klein" data-verstuur-ruil="${dienst.id}">Ruilverzoek versturen</button>
      <button type="button" class="btn secundair klein" data-annuleer-actie>Annuleren</button>
    `;
  }

  function verstuurOverdracht(dienstId) {
    const doelId = document.getElementById('overdrachtDoel').value;
    const dienst = App.data.standbyDiensten().find(d => d.id === dienstId);
    if (!dienst || !doelId) return;
    const verzoeken = App.data.standbyVerzoeken();
    verzoeken.push(App.model.nieuwStandbyVerzoek({
      type: 'overdracht', dienstId: dienst.id, vanMedewerkerId: dienst.medewerkerId, naarMedewerkerId: doelId
    }));
    App.data.bewaarStandbyVerzoeken(verzoeken);
    App.ui.melding('Overdrachtsverzoek verstuurd, wacht op goedkeuring');
    actieDienstId = null; actieType = null;
    teken();
  }

  function verstuurRuil(dienstId) {
    const doelDienstId = document.getElementById('ruilDoel').value;
    const dienst = App.data.standbyDiensten().find(d => d.id === dienstId);
    const doelDienst = App.data.standbyDiensten().find(d => d.id === doelDienstId);
    if (!dienst || !doelDienst) return;
    const verzoeken = App.data.standbyVerzoeken();
    verzoeken.push(App.model.nieuwStandbyVerzoek({
      type: 'ruil', dienstId: dienst.id, ruilDienstId: doelDienst.id,
      vanMedewerkerId: dienst.medewerkerId, naarMedewerkerId: doelDienst.medewerkerId
    }));
    App.data.bewaarStandbyVerzoeken(verzoeken);
    App.ui.melding('Ruilverzoek verstuurd, wacht op goedkeuring');
    actieDienstId = null; actieType = null;
    teken();
  }

  function tekenVerzoeken() {
    const wrap = document.getElementById('standbyVerzoekenWrap');
    const medewerkers = App.data.medewerkers();
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    const diensten = App.data.standbyDiensten();
    const weekVan = id => { const d = diensten.find(x => x.id === id); return d ? d.weekKey : '?'; };
    const eigenId = App.auth.eigenMedewerkerId();
    const isAdmin = App.auth.magGoedkeuren();
    const open = App.data.standbyVerzoeken().filter(v => v.status === 'open');

    if (!open.length) {
      wrap.innerHTML = '<p class="leeg-melding">Geen openstaande verzoeken.</p>';
      return;
    }

    wrap.innerHTML = `<div class="tabel-wrap"><table>
      <thead><tr><th>Type</th><th>Van</th><th>Naar</th><th>Details</th><th></th></tr></thead>
      <tbody>${open.map(v => {
        const magGoedkeuren = isAdmin || v.naarMedewerkerId === eigenId;
        const magIntrekken = isAdmin || v.vanMedewerkerId === eigenId;
        const details = v.type === 'ruil'
          ? `Week ${weekVan(v.dienstId)} &harr; Week ${weekVan(v.ruilDienstId)}`
          : `Week ${weekVan(v.dienstId)}`;
        return `<tr>
          <td>${v.type === 'ruil' ? 'Ruil' : 'Overdracht'}</td>
          <td>${App.ui.escapeHtml(naamVan(v.vanMedewerkerId))}</td>
          <td>${App.ui.escapeHtml(naamVan(v.naarMedewerkerId))}</td>
          <td>${details}</td>
          <td>
            ${magGoedkeuren ? `<button type="button" class="btn klein" data-goedkeuren-standby="${v.id}">Goedkeuren</button>
            <button type="button" class="btn secundair klein" data-afwijzen-standby="${v.id}">Afwijzen</button>` : ''}
            ${magIntrekken && !magGoedkeuren ? `<button type="button" class="btn secundair klein" data-afwijzen-standby="${v.id}">Intrekken</button>` : ''}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;

    wrap.querySelectorAll('[data-goedkeuren-standby]').forEach(b => b.addEventListener('click', () => goedkeurenVerzoekStandby(b.dataset.goedkeurenStandby)));
    wrap.querySelectorAll('[data-afwijzen-standby]').forEach(b => b.addEventListener('click', () => afwijzenVerzoekStandby(b.dataset.afwijzenStandby)));
  }

  function goedkeurenVerzoekStandby(verzoekId) {
    const verzoeken = App.data.standbyVerzoeken();
    const verzoek = verzoeken.find(v => v.id === verzoekId);
    if (!verzoek) return;

    const diensten = App.data.standbyDiensten();
    const dienst = diensten.find(d => d.id === verzoek.dienstId);
    if (!dienst) { App.ui.melding('Dienst niet meer gevonden'); return; }

    if (verzoek.type === 'overdracht') {
      dienst.medewerkerId = verzoek.naarMedewerkerId;
      stelDienstVerlofSamen(dienst);
    } else {
      const ruilDienst = diensten.find(d => d.id === verzoek.ruilDienstId);
      if (!ruilDienst) { App.ui.melding('Dienst niet meer gevonden'); return; }
      const tijdelijk = dienst.medewerkerId;
      dienst.medewerkerId = ruilDienst.medewerkerId;
      ruilDienst.medewerkerId = tijdelijk;
      stelDienstVerlofSamen(dienst);
      stelDienstVerlofSamen(ruilDienst);
    }

    App.data.bewaarStandbyDiensten(diensten);
    App.data.bewaarStandbyVerzoeken(verzoeken.filter(v => v.id !== verzoekId));
    App.ui.melding('Verzoek goedgekeurd, rooster bijgewerkt');
    teken();
  }

  function afwijzenVerzoekStandby(verzoekId) {
    App.data.bewaarStandbyVerzoeken(App.data.standbyVerzoeken().filter(v => v.id !== verzoekId));
    App.ui.melding('Verzoek verwijderd');
    teken();
  }

  return { render };
})();
