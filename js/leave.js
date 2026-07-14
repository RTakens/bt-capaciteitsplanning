// Pagina: Verlofplanning beheren (CRUD, weekoverzicht, terugkerend verlof, verzoeken)
window.App = window.App || {};

App.pages.verlof = (function () {
  let bewerkIds = null;
  let bewerkTerugkerendIds = null;
  let filterMedewerkerId = '';
  let matrixWekenVooruit = 4;

  function render(container) {
    const medewerkers = App.data.medewerkers();
    const magBewerken = App.auth.magBewerken();

    container.innerHTML = `
      <h2>Verlofplanning</h2>
      ${!magBewerken ? '<p class="leeg-melding">Je hebt alleen-lezen toegang; wijzigen is niet mogelijk.</p>' : `
      <div class="grid-2">
        <div class="card">
          <h3 id="formTitel">Verlof/standby toevoegen</h3>
          <form id="verlofForm">
            <div class="veld">
              <label>Medewerker</label>
              <select name="medewerkerId" required ${App.auth.alleenEigenVerlof() ? 'disabled' : ''}>${optiesMedewerkers(medewerkers)}</select>
            </div>
            <div class="rij">
              <div class="veld"><label>Datum (of startdatum periode)</label><input type="date" name="startDatum" required></div>
              <div class="veld"><label>Einddatum (optioneel, voor periode)</label><input type="date" name="eindDatum"></div>
            </div>
            <div class="rij">
              <div class="veld"><label>Type</label>
                <select name="type">
                  <option value="afwezig">Afwezig</option>
                  <option value="standby">Standby</option>
                  <option value="verzoek">Verzoek (nog niet definitief)</option>
                  <option value="anders">Anders</option>
                </select>
              </div>
              <div class="veld"><label>Dagdeel</label>
                <select name="dagdeel">
                  <option value="hele-dag">Hele dag</option>
                  <option value="ochtend">Ochtend</option>
                  <option value="middag">Middag</option>
                </select>
              </div>
            </div>
            <p style="font-size:12px;color:#6b7280;margin:-4px 0 6px 0">Standby kan samen met verlof op dezelfde dag geregistreerd staan (bv. een verlofdag met avond-standby).</p>
            <div class="veld"><label>Opmerking</label><input name="opmerking"></div>
            <button type="submit" class="btn">Opslaan</button>
            <button type="button" id="annuleerBtn" class="btn secundair" style="display:none">Annuleren</button>
          </form>
        </div>

        <div class="card">
          <h3 id="terugkerendFormTitel">Terugkerend verlof (vaste vrije dag)</h3>
          <p style="font-size:13px;color:#6b7280">Bijvoorbeeld: iedere maandag vrij, of om de week op vrijdag.</p>
          <form id="terugkerendForm">
            <div class="veld">
              <label>Medewerker</label>
              <select name="medewerkerId" required ${App.auth.alleenEigenVerlof() ? 'disabled' : ''}>${optiesMedewerkers(medewerkers)}</select>
            </div>
            <div class="rij">
              <div class="veld"><label>Weekdag</label>
                <select name="weekdag">
                  <option value="1">Maandag</option>
                  <option value="2">Dinsdag</option>
                  <option value="3">Woensdag</option>
                  <option value="4">Donderdag</option>
                  <option value="5">Vrijdag</option>
                </select>
              </div>
              <div class="veld"><label>Herhaling</label>
                <select name="interval">
                  <option value="1">Elke week</option>
                  <option value="2">Om de week</option>
                </select>
              </div>
              <div class="veld"><label>Type</label>
                <select name="type">
                  <option value="afwezig">Afwezig</option>
                  <option value="standby">Standby</option>
                  <option value="verzoek">Verzoek (nog niet definitief)</option>
                  <option value="anders">Anders</option>
                </select>
              </div>
            </div>
            <div class="rij">
              <div class="veld"><label>Vanaf</label><input type="date" name="vanaf" required></div>
              <div class="veld"><label>Tot en met</label><input type="date" name="tot" required></div>
            </div>
            <div class="veld"><label>Opmerking</label><input name="opmerking"></div>
            <button type="submit" class="btn" id="terugkerendSubmitBtn">Terugkerend verlof toevoegen</button>
            <button type="button" id="annuleerTerugkerendBtn" class="btn secundair" style="display:none">Annuleren</button>
          </form>
        </div>
      </div>
      `}

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0">Weekoverzicht per medewerker</h3>
          <div class="rij" style="margin:0;align-items:center">
            <span style="font-size:13px;color:#4b5563">Van <strong id="matrixVanLabel"></strong></span>
            <div class="veld" style="margin:0">
              <label>Aantal weken vooruit</label>
              <select id="matrixWekenSelect">
                <option value="2">2 weken</option>
                <option value="4">4 weken</option>
                <option value="8">8 weken</option>
                <option value="12">12 weken</option>
              </select>
            </div>
          </div>
        </div>
        <div class="legenda">
          <span><span class="badge rood" style="margin-right:6px">Afwezig</span></span>
          <span><span class="badge standby" style="margin-right:6px">Standby</span></span>
          <span><span class="badge verzoek" style="margin-right:6px">Verzoek</span></span>
          <span><span class="badge neutraal" style="margin-right:6px">Anders</span></span>
          <span>Grijze rijen = weekend of NL-feestdag (geen werkdag)</span>
          <span>Klik op een verlofregel om 'm hieronder in de lijst te vinden</span>
        </div>
        <div id="matrixWrap" class="tabel-wrap"></div>
      </div>

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0">Alle verlofregels</h3>
          <div class="veld" style="margin:0">
            <label>Filter op medewerker</label>
            <select id="filterMedewerker">
              <option value="">Alle medewerkers</option>
              ${optiesMedewerkers(medewerkers)}
            </select>
          </div>
        </div>
        <p style="font-size:13px;color:#6b7280">Opeenvolgende dagen (incl. weekenden) met hetzelfde type worden samengevoegd tot één periode; terugkerend verlof wordt samengevoegd tot één reeks.</p>
        <div class="tabel-wrap">
          <table>
            <thead><tr><th>Medewerker</th><th>Periode</th><th>Type</th><th>Opmerking</th><th></th></tr></thead>
            <tbody id="verlofTbody"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('matrixWekenSelect').value = matrixWekenVooruit;
    tekenMatrix();
    tekenLijst();
    if (magBewerken) {
      document.getElementById('verlofForm').addEventListener('submit', opSlaan);
      document.getElementById('annuleerBtn').addEventListener('click', resetForm);
      document.getElementById('terugkerendForm').addEventListener('submit', voegTerugkerendToe);
      document.getElementById('annuleerTerugkerendBtn').addEventListener('click', resetTerugkerendForm);
    }
    document.getElementById('matrixWekenSelect').addEventListener('change', e => { matrixWekenVooruit = Number(e.target.value); tekenMatrix(); });
    document.getElementById('filterMedewerker').addEventListener('change', e => { filterMedewerkerId = e.target.value; tekenLijst(); });
  }

  function optiesMedewerkers(medewerkers) {
    if (App.auth.alleenEigenVerlof()) {
      const eigen = medewerkers.find(m => m.id === App.auth.eigenMedewerkerId());
      return eigen ? `<option value="${eigen.id}">${App.ui.escapeHtml(eigen.naam)}</option>` : '<option value="">Geen gekoppelde medewerker</option>';
    }
    if (!medewerkers.length) return '<option value="">Eerst een medewerker aanmaken</option>';
    return medewerkers.map(m => `<option value="${m.id}">${App.ui.escapeHtml(m.naam)}</option>`).join('');
  }

  function dagdeelSuffix(dagdeel) {
    return dagdeel && dagdeel !== 'hele-dag' ? ` (${dagdeel === 'ochtend' ? 'ochtend' : 'middag'})` : '';
  }

  function typeBadge(type, opmerking, dagdeel) {
    const suffix = dagdeelSuffix(dagdeel);
    if (type === 'afwezig') return `<span class="badge rood">Afwezig${suffix}</span>`;
    if (type === 'standby') return '<span class="badge standby">Standby</span>';
    if (type === 'verzoek') return `<span class="badge verzoek">Verzoek${suffix}</span>`;
    return `<span class="badge neutraal" title="${App.ui.escapeHtml(opmerking)}">${App.ui.escapeHtml(opmerking || 'Anders')}${suffix}</span>`;
  }

  function tekenMatrix() {
    const van = App.datum.periodeBereik('week', new Date()).start;
    const tot = new Date(van.getTime());
    tot.setDate(tot.getDate() + matrixWekenVooruit * 7 - 1);
    document.getElementById('matrixVanLabel').textContent = App.datum.formatKort(van);

    const medewerkers = App.data.medewerkers();
    const verlof = App.data.verlof();
    const wrap = document.getElementById('matrixWrap');

    const dagen = App.datum.alleDagenTussen(van, tot);
    if (!dagen.length) { wrap.innerHTML = '<p class="leeg-melding">Geen dagen in deze periode.</p>'; return; }

    const perMedewerkerDatum = {};
    verlof.forEach(v => {
      const sleutel = v.medewerkerId + '|' + v.datum;
      (perMedewerkerDatum[sleutel] = perMedewerkerDatum[sleutel] || []).push(v);
    });

    const header = `<tr><th>Datum</th><th>Dag</th>${medewerkers.map(m => `<th>${App.ui.escapeHtml(m.naam)}</th>`).join('')}</tr>`;
    let vorigeWeekLabel = null;
    const kolomAantal = 2 + medewerkers.length;
    let rijen = '';

    dagen.forEach(dag => {
      const wk = App.datum.isoWeek(dag);
      const weekLabel = `Week ${wk.week}, ${wk.jaar}`;
      if (weekLabel !== vorigeWeekLabel) {
        rijen += `<tr class="week-header"><td colspan="${kolomAantal}">${weekLabel}</td></tr>`;
        vorigeWeekLabel = weekLabel;
      }
      const iso = App.datum.naarIso(dag);
      const nietWerkdag = !App.datum.isWerkdag(dag);
      const feestNaam = App.datum.feestdagNaam(dag);
      const dagLabel = App.datum.DAGEN_KORT[dag.getDay()] + (feestNaam ? ` (${App.ui.escapeHtml(feestNaam)})` : '');
      const cellen = medewerkers.map(m => {
        const items = perMedewerkerDatum[m.id + '|' + iso] || [];
        if (!items.length) return '<td></td>';
        const inhoud = items.map(v =>
          `<span data-verlof-id="${v.id}" data-medewerker-id="${m.id}" style="cursor:pointer;display:inline-block;margin:1px">${typeBadge(v.type, v.opmerking, v.dagdeel)}</span>`
        ).join(' ');
        return `<td>${inhoud}</td>`;
      }).join('');
      rijen += `<tr class="${nietWerkdag ? 'niet-werkdag' : ''}"><td>${App.datum.formatKort(dag)}</td><td>${dagLabel}</td>${cellen}</tr>`;
    });

    wrap.innerHTML = `<table><thead>${header}</thead><tbody>${rijen}</tbody></table>`;
    wrap.querySelectorAll('[data-verlof-id]').forEach(el =>
      el.addEventListener('click', () => springNaarRegel(el.dataset.verlofId, el.dataset.medewerkerId)));
  }

  function springNaarRegel(verlofId, medewerkerId) {
    filterMedewerkerId = medewerkerId;
    document.getElementById('filterMedewerker').value = medewerkerId;
    tekenLijst();
    const rij = document.querySelector(`#verlofTbody tr[data-bevat-ids~="${verlofId}"]`);
    if (!rij) return;
    rij.scrollIntoView({ behavior: 'smooth', block: 'center' });
    rij.classList.add('rij-highlight');
    setTimeout(() => rij.classList.remove('rij-highlight'), 1500);
  }

  function volgendeKalenderDag(d) {
    const r = new Date(d.getTime());
    r.setDate(r.getDate() + 1);
    return r;
  }

  const WEEKDAG_VOL = { 0: 'zondag', 1: 'maandag', 2: 'dinsdag', 3: 'woensdag', 4: 'donderdag', 5: 'vrijdag', 6: 'zaterdag' };

  // Voegt opeenvolgende dagen (incl. weekenden) met dezelfde medewerker/type/dagdeel/opmerking samen tot één periode-rij
  function groepeerOpeenvolgend(lijst) {
    const sortedVoorGroepering = [...lijst].sort((a, b) =>
      a.medewerkerId.localeCompare(b.medewerkerId) || a.type.localeCompare(b.type) ||
      (a.dagdeel || '').localeCompare(b.dagdeel || '') ||
      (a.opmerking || '').localeCompare(b.opmerking || '') || a.datum.localeCompare(b.datum)
    );
    const groepen = [];
    sortedVoorGroepering.forEach(v => {
      const laatste = groepen[groepen.length - 1];
      const verwachteVolgende = laatste ? App.datum.naarIso(volgendeKalenderDag(App.datum.parseIso(laatste.eindDatum))) : null;
      if (laatste && laatste.medewerkerId === v.medewerkerId && laatste.type === v.type &&
        (laatste.dagdeel || '') === (v.dagdeel || '') &&
        (laatste.opmerking || '') === (v.opmerking || '') && verwachteVolgende === v.datum) {
        laatste.eindDatum = v.datum;
        laatste.ids.push(v.id);
      } else {
        groepen.push({ medewerkerId: v.medewerkerId, type: v.type, dagdeel: v.dagdeel, opmerking: v.opmerking, startDatum: v.datum, eindDatum: v.datum, ids: [v.id], herhalend: false });
      }
    });
    return groepen;
  }

  // Voegt alle voorkomens van dezelfde terugkerende reeks (medewerker/type/opmerking/weekdag) samen tot één rij
  function groepeerTerugkerend(lijst) {
    const perSleutel = {};
    lijst.forEach(v => {
      const weekdag = App.datum.parseIso(v.datum).getDay();
      const sleutel = [v.medewerkerId, v.type, v.opmerking || '', weekdag].join('|');
      if (!perSleutel[sleutel]) perSleutel[sleutel] = [];
      perSleutel[sleutel].push(v);
    });

    return Object.values(perSleutel).map(entries => {
      const datums = entries.map(e => e.datum).sort();
      const diffsInDagen = [];
      for (let i = 1; i < datums.length; i++) {
        diffsInDagen.push((App.datum.parseIso(datums[i]) - App.datum.parseIso(datums[i - 1])) / 86400000);
      }
      const alle7 = diffsInDagen.length > 0 && diffsInDagen.every(d => d === 7);
      const alle14 = diffsInDagen.length > 0 && diffsInDagen.every(d => d === 14);
      const intervalLabel = alle7 ? 'Elke ' : alle14 ? 'Om de week op ' : 'Periodiek op ';
      return {
        medewerkerId: entries[0].medewerkerId, type: entries[0].type, dagdeel: entries[0].dagdeel, opmerking: entries[0].opmerking,
        startDatum: datums[0], eindDatum: datums[datums.length - 1],
        ids: entries.map(e => e.id), herhalend: true, intervalLabel
      };
    });
  }

  function groepeerVoorWeergave(lijst) {
    const herhalendLijst = lijst.filter(v => v.herhalend);
    const normaalLijst = lijst.filter(v => !v.herhalend);
    const groepen = [...groepeerOpeenvolgend(normaalLijst), ...groepeerTerugkerend(herhalendLijst)];
    return groepen.sort((a, b) => b.startDatum.localeCompare(a.startDatum));
  }

  function periodeTekst(groep) {
    const bereik = groep.startDatum === groep.eindDatum
      ? App.datum.formatKort(App.datum.parseIso(groep.startDatum))
      : `${App.datum.formatKort(App.datum.parseIso(groep.startDatum))} t/m ${App.datum.formatKort(App.datum.parseIso(groep.eindDatum))}`;
    if (!groep.herhalend) return bereik;
    const weekdag = WEEKDAG_VOL[App.datum.parseIso(groep.startDatum).getDay()];
    return `${groep.intervalLabel}${weekdag}, ${bereik}`;
  }

  function tekenLijst() {
    const medewerkers = App.data.medewerkers();
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    let verlofData = App.data.verlof();
    if (filterMedewerkerId) verlofData = verlofData.filter(v => v.medewerkerId === filterMedewerkerId);
    const groepen = groepeerVoorWeergave(verlofData);
    const tbody = document.getElementById('verlofTbody');

    if (!groepen.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="leeg-melding">Geen verlof gevonden.</td></tr>';
      return;
    }
    const magBewerken = App.auth.magBewerken();
    const alleenEigen = App.auth.alleenEigenVerlof();
    const eigenId = App.auth.eigenMedewerkerId();

    tbody.innerHTML = groepen.map((g, idx) => {
      const magDezeBewerken = magBewerken && (!alleenEigen || g.medewerkerId === eigenId);
      return `
      <tr data-bevat-ids="${g.ids.join(' ')}">
        <td>${App.ui.escapeHtml(naamVan(g.medewerkerId))}</td>
        <td>${periodeTekst(g)}</td>
        <td>${typeBadge(g.type, g.opmerking, g.dagdeel)}</td>
        <td>${App.ui.escapeHtml(g.opmerking)}</td>
        <td>
          ${g.type === 'verzoek' && App.auth.magGoedkeuren() ? `<button class="btn klein" data-actie="goedkeuren" data-idx="${idx}">Goedkeuren</button>` : ''}
          ${magDezeBewerken ? `<button class="btn secundair klein" data-actie="wijzig" data-idx="${idx}">Wijzig</button>` : ''}
          ${magDezeBewerken ? `<button class="btn gevaar klein" data-actie="verwijder" data-idx="${idx}">Verwijder${g.herhalend ? ' reeks' : ''}</button>` : ''}
        </td>
      </tr>
    `;
    }).join('');

    tbody.querySelectorAll('[data-actie="wijzig"]').forEach(b => b.addEventListener('click', () => {
      const groep = groepen[Number(b.dataset.idx)];
      if (groep.herhalend) beginWijzigTerugkerend(groep); else beginWijzig(groep);
    }));
    tbody.querySelectorAll('[data-actie="verwijder"]').forEach(b => b.addEventListener('click', () => verwijder(groepen[Number(b.dataset.idx)])));
    tbody.querySelectorAll('[data-actie="goedkeuren"]').forEach(b => b.addEventListener('click', () => goedkeuren(groepen[Number(b.dataset.idx)])));
  }

  // Controleert of de gegeven data (na een wijziging) onder de minimale bezetting komen en waarschuwt zo ja.
  function controleerDrempel(datums) {
    const instellingen = App.settings.get();
    const medewerkers = App.data.medewerkers();
    const verlof = App.data.verlof();
    const overschreden = datums.some(iso =>
      App.capacity.bezettingVoorDag(App.datum.parseIso(iso), medewerkers, verlof, instellingen).onderMinimum);
    if (overschreden) App.ui.waarschuwDrempelOverschreden();
  }

  function goedkeuren(groep) {
    const lijst = App.data.verlof();
    lijst.forEach(v => { if (groep.ids.includes(v.id)) v.type = 'afwezig'; });
    App.data.bewaarVerlof(lijst);
    App.ui.melding('Verzoek goedgekeurd en omgezet naar Afwezig');
    tekenMatrix();
    tekenLijst();
    controleerDrempel(lijst.filter(v => groep.ids.includes(v.id)).map(v => v.datum));
  }

  function beginWijzig(groep) {
    bewerkIds = groep.ids;
    const form = document.getElementById('verlofForm');
    form.medewerkerId.value = groep.medewerkerId;
    form.startDatum.value = groep.startDatum;
    form.eindDatum.value = groep.eindDatum !== groep.startDatum ? groep.eindDatum : '';
    form.type.value = groep.type;
    form.dagdeel.value = groep.dagdeel || 'hele-dag';
    form.opmerking.value = groep.opmerking || '';
    document.getElementById('formTitel').textContent = 'Verlof/standby wijzigen';
    document.getElementById('annuleerBtn').style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    bewerkIds = null;
    document.getElementById('verlofForm').reset();
    document.getElementById('formTitel').textContent = 'Verlof/standby toevoegen';
    document.getElementById('annuleerBtn').style.display = 'none';
  }

  function beginWijzigTerugkerend(groep) {
    bewerkTerugkerendIds = groep.ids;
    const form = document.getElementById('terugkerendForm');
    form.medewerkerId.value = groep.medewerkerId;
    form.weekdag.value = String(App.datum.parseIso(groep.startDatum).getDay());
    form.interval.value = groep.intervalLabel === 'Om de week op ' ? '2' : '1';
    form.type.value = groep.type;
    form.vanaf.value = groep.startDatum;
    form.tot.value = groep.eindDatum;
    form.opmerking.value = groep.opmerking || '';
    document.getElementById('terugkerendFormTitel').textContent = 'Terugkerend verlof wijzigen';
    document.getElementById('terugkerendSubmitBtn').textContent = 'Wijzigingen opslaan';
    document.getElementById('annuleerTerugkerendBtn').style.display = 'inline-block';
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function resetTerugkerendForm() {
    bewerkTerugkerendIds = null;
    document.getElementById('terugkerendForm').reset();
    document.getElementById('terugkerendFormTitel').textContent = 'Terugkerend verlof (vaste vrije dag)';
    document.getElementById('terugkerendSubmitBtn').textContent = 'Terugkerend verlof toevoegen';
    document.getElementById('annuleerTerugkerendBtn').style.display = 'none';
  }

  function opSlaan(e) {
    e.preventDefault();
    const form = e.target;
    const medewerkerId = form.medewerkerId.value;
    const type = form.type.value;
    const dagdeel = form.dagdeel.value;
    const opmerking = form.opmerking.value.trim();
    if (!medewerkerId) return;

    let lijst = App.data.verlof();
    if (bewerkIds) lijst = lijst.filter(x => !bewerkIds.includes(x.id));

    const start = App.datum.parseIso(form.startDatum.value);
    const eind = form.eindDatum.value ? App.datum.parseIso(form.eindDatum.value) : start;
    const geraakteDatums = [];
    App.datum.werkdagenTussen(start, eind).forEach(dag => {
      const iso = App.datum.naarIso(dag);
      const bestaand = lijst.find(x => x.medewerkerId === medewerkerId && x.datum === iso && x.type === type);
      const overrides = { medewerkerId, datum: iso, type, dagdeel, opmerking };
      if (bestaand) overrides.id = bestaand.id;
      App.data.upsert(lijst, App.model.nieuwVerlof(overrides));
      geraakteDatums.push(iso);
    });

    App.data.bewaarVerlof(lijst);
    App.ui.melding('Verlof opgeslagen');
    resetForm();
    tekenMatrix();
    tekenLijst();
    controleerDrempel(geraakteDatums);
  }

  function verwijder(groep) {
    if (!confirm(`Verlof ${periodeTekst(groep)} verwijderen?`)) return;
    App.data.bewaarVerlof(App.data.verlof().filter(x => !groep.ids.includes(x.id)));
    tekenMatrix();
    tekenLijst();
  }

  function voegTerugkerendToe(e) {
    e.preventDefault();
    const form = e.target;
    const medewerkerId = form.medewerkerId.value;
    const weekdag = Number(form.weekdag.value);
    const interval = Number(form.interval.value);
    const type = form.type.value;
    const opmerking = form.opmerking.value.trim();
    const vanaf = App.datum.parseIso(form.vanaf.value);
    const tot = App.datum.parseIso(form.tot.value);

    if (!medewerkerId || !form.vanaf.value || !form.tot.value || vanaf > tot) {
      App.ui.melding('Controleer medewerker en periode');
      return;
    }

    const eersteDatum = new Date(vanaf.getTime());
    while (eersteDatum.getDay() !== weekdag) eersteDatum.setDate(eersteDatum.getDate() + 1);

    let lijst = App.data.verlof();
    if (bewerkTerugkerendIds) lijst = lijst.filter(x => !bewerkTerugkerendIds.includes(x.id));

    let aantal = 0;
    const geraakteDatums = [];
    for (let d = new Date(eersteDatum.getTime()); d <= tot; d.setDate(d.getDate() + 7 * interval)) {
      if (!App.datum.isWerkdag(d)) continue; // slaat NL-feestdagen op deze weekdag over
      const iso = App.datum.naarIso(d);
      const bestaand = lijst.find(x => x.medewerkerId === medewerkerId && x.datum === iso && x.type === type);
      const overrides = { medewerkerId, datum: iso, type, opmerking, herhalend: true };
      if (bestaand) overrides.id = bestaand.id;
      App.data.upsert(lijst, App.model.nieuwVerlof(overrides));
      geraakteDatums.push(iso);
      aantal++;
    }

    App.data.bewaarVerlof(lijst);
    App.ui.melding(bewerkTerugkerendIds ? 'Terugkerend verlof gewijzigd' : `${aantal} terugkerende verlofdagen toegevoegd`);
    resetTerugkerendForm();
    tekenMatrix();
    tekenLijst();
    controleerDrempel(geraakteDatums);
  }

  return { render };
})();
