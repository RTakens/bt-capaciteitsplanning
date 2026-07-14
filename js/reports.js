// Pagina: Rapportages
window.App = window.App || {};

App.pages.rapportages = (function () {
  let type = 'management';
  let granulariteit = 'maand';
  let refDatum = new Date();

  const TYPES = {
    management: 'Managementoverzicht',
    onderwerp: 'Samenvatting per onderwerp',
    teamKnelpunten: 'Knelpunten per team',
    medewerkerKnelpunten: 'Knelpunten per medewerker',
    waardestroom: 'Verdeling per waardestroom',
    applicatie: 'Verdeling per applicatie'
  };

  function render(container) {
    container.innerHTML = `
      <h2>Rapportages</h2>
      <div class="card">
        <div class="toolbar">
          <div class="rij" style="margin:0;align-items:center">
            <select id="typeSelect">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <button class="btn secundair klein" id="vorigeBtn">&larr;</button>
            <select id="granulariteitSelect">
              <option value="week">Week</option>
              <option value="maand">Maand</option>
              <option value="kwartaal">Kwartaal</option>
            </select>
            <button class="btn secundair klein" id="volgendeBtn">&rarr;</button>
            <strong id="periodeLabel"></strong>
          </div>
          <button class="btn" id="exportBtn">Exporteer naar CSV</button>
        </div>
      </div>
      <div id="rapportInhoud"></div>
    `;

    document.getElementById('typeSelect').value = type;
    document.getElementById('granulariteitSelect').value = granulariteit;
    document.getElementById('typeSelect').addEventListener('change', e => { type = e.target.value; teken(); });
    document.getElementById('granulariteitSelect').addEventListener('change', e => { granulariteit = e.target.value; teken(); });
    document.getElementById('vorigeBtn').addEventListener('click', () => { verschuif(-1); teken(); });
    document.getElementById('volgendeBtn').addEventListener('click', () => { verschuif(1); teken(); });
    document.getElementById('exportBtn').addEventListener('click', exporteer);

    teken();
  }

  function verschuif(richting) {
    const d = new Date(refDatum.getTime());
    if (granulariteit === 'week') d.setDate(d.getDate() + 7 * richting);
    else if (granulariteit === 'maand') d.setMonth(d.getMonth() + richting);
    else d.setMonth(d.getMonth() + 3 * richting);
    refDatum = d;
  }

  let huidigeTabel = { kop: [], rijen: [] };

  function teken() {
    const bereik = App.datum.periodeBereik(granulariteit, refDatum);
    document.getElementById('periodeLabel').textContent = bereik.label;

    const medewerkers = App.data.medewerkers();
    const werkitems = App.data.werkitems();
    const verlof = App.data.verlof();
    const resultaten = App.capacity.berekenAlleMedewerkers(bereik.start, bereik.eind, medewerkers, werkitems, verlof);
    const teams = App.capacity.berekenPerTeam(resultaten);

    let html = '';
    if (type === 'management') html = rapportManagement(resultaten, teams);
    else if (type === 'onderwerp') html = rapportOnderwerp(werkitems, bereik, medewerkers);
    else if (type === 'teamKnelpunten') html = rapportTeamKnelpunten(teams);
    else if (type === 'medewerkerKnelpunten') html = rapportMedewerkerKnelpunten(resultaten);
    else if (type === 'waardestroom') html = rapportGroepering(werkitems, bereik, 'waardestroom', 'Waardestroom');
    else if (type === 'applicatie') html = rapportGroepering(werkitems, bereik, 'applicatie', 'Applicatie');

    document.getElementById('rapportInhoud').innerHTML = html;
  }

  function rond(n) { return Math.round(n * 10) / 10; }

  function rapportManagement(resultaten, teams) {
    const totBeschikbaar = resultaten.reduce((s, r) => s + r.beschikbaar, 0);
    const totGepland = resultaten.reduce((s, r) => s + r.gepland, 0);
    const overbelast = resultaten.filter(r => r.status === 'rood').length;
    const onderbenut = resultaten.filter(r => r.onderbenut).length;

    huidigeTabel = {
      kop: ['Team', 'Beschikbaar (u)', 'Gepland (u)', 'Bezetting (%)', 'Status'],
      rijen: teams.map(t => [t.team, rond(t.beschikbaar), rond(t.gepland), Math.round(t.ratio * 100), labelStatusGroep(t)])
    };

    return `
      <div class="grid-3">
        <div class="card kpi"><div class="waarde">${rond(totBeschikbaar)}</div><div class="label">Beschikbare uren</div></div>
        <div class="card kpi"><div class="waarde">${rond(totGepland)}</div><div class="label">Geplande uren</div></div>
        <div class="card kpi"><div class="waarde">${overbelast} / ${onderbenut}</div><div class="label">Overbelast / onderbenut (medewerkers)</div></div>
      </div>
      <div class="card">
        <h3>Capaciteit per team</h3>
        <div class="tabel-wrap"><table>
          <thead><tr><th>Team</th><th>Beschikbaar</th><th>Gepland</th><th>Bezetting</th><th>Status</th></tr></thead>
          <tbody>${teams.map(t => `<tr><td>${App.ui.escapeHtml(t.team)}</td><td>${rond(t.beschikbaar)}u</td><td>${rond(t.gepland)}u</td><td>${Math.round(t.ratio * 100)}%</td><td><span class="badge ${t.status}">${labelStatusGroep(t)}</span></td></tr>`).join('') || '<tr><td colspan="5" class="leeg-melding">Geen data.</td></tr>'}</tbody>
        </table></div>
      </div>
    `;
  }

  function rapportTeamKnelpunten(teams) {
    const gesorteerd = [...teams].sort((a, b) => b.ratio - a.ratio);
    huidigeTabel = {
      kop: ['Team', 'Beschikbaar (u)', 'Gepland (u)', 'Bezetting (%)', 'Status', 'Aantal medewerkers overbelast'],
      rijen: gesorteerd.map(t => [t.team, rond(t.beschikbaar), rond(t.gepland), Math.round(t.ratio * 100), labelStatusGroep(t), t.medewerkers.filter(m => m.status === 'rood').length])
    };
    return `<div class="card"><h3>Knelpunten per team</h3><div class="tabel-wrap"><table>
      <thead><tr><th>Team</th><th>Beschikbaar</th><th>Gepland</th><th>Bezetting</th><th>Status</th><th>Overbelaste medewerkers</th></tr></thead>
      <tbody>${gesorteerd.map(t => `<tr><td>${App.ui.escapeHtml(t.team)}</td><td>${rond(t.beschikbaar)}u</td><td>${rond(t.gepland)}u</td><td>${Math.round(t.ratio * 100)}%</td><td><span class="badge ${t.status}">${labelStatusGroep(t)}</span></td><td>${t.medewerkers.filter(m => m.status === 'rood').length}</td></tr>`).join('') || '<tr><td colspan="6" class="leeg-melding">Geen data.</td></tr>'}</tbody>
    </table></div></div>`;
  }

  function labelStatusGroep(t) {
    if (t.status === 'rood') return 'Overbelast';
    if (t.status === 'oranje') return 'Bijna vol';
    return 'Voldoende';
  }

  function rapportMedewerkerKnelpunten(resultaten) {
    const gesorteerd = [...resultaten].sort((a, b) => b.ratio - a.ratio);
    huidigeTabel = {
      kop: ['Medewerker', 'Team', 'Beschikbaar (u)', 'Gepland (u)', 'Bezetting (%)', 'Status'],
      rijen: gesorteerd.map(r => [r.medewerker.naam, r.medewerker.team, rond(r.beschikbaar), rond(r.gepland), Math.round(r.ratio * 100), labelStatus(r)])
    };
    return `<div class="card"><h3>Knelpunten per medewerker</h3><div class="tabel-wrap"><table>
      <thead><tr><th>Medewerker</th><th>Team</th><th>Beschikbaar</th><th>Gepland</th><th>Bezetting</th><th>Status</th></tr></thead>
      <tbody>${gesorteerd.map(r => `<tr><td>${App.ui.escapeHtml(r.medewerker.naam)}</td><td>${App.ui.escapeHtml(r.medewerker.team)}</td><td>${rond(r.beschikbaar)}u</td><td>${rond(r.gepland)}u</td><td>${Math.round(r.ratio * 100)}%</td><td><span class="badge ${badgeKlasse(r)}">${labelStatus(r)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="leeg-melding">Geen data.</td></tr>'}</tbody>
    </table></div></div>`;
  }

  function badgeKlasse(r) {
    if (r.status !== 'groen') return r.status;
    return r.opVerlof ? 'neutraal' : 'groen';
  }

  function labelStatus(r) {
    if (r.status === 'rood') return r.overbelastMetVerlof ? 'Overbelast (incl. verlof)' : 'Overbelast';
    if (r.status === 'oranje') return 'Bijna vol';
    if (r.opVerlof) return 'Op verlof';
    return r.onderbenut ? 'Onderbenut' : 'Voldoende';
  }

  function rapportOnderwerp(werkitems, bereik, medewerkers) {
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    const labels = App.pages.werkitems.TYPE_LABEL;
    const rijenData = werkitems.map(w => {
      const uren = App.capacity.werkitemUrenInPeriode(w, bereik.start, bereik.eind);
      if (uren <= 0) return null;
      return { titel: w.titel, type: w.type, uren, medewerkerNamen: w.medewerkerIds.map(naamVan).join(', ') || '-' };
    }).filter(Boolean).sort((a, b) => b.uren - a.uren);

    huidigeTabel = {
      kop: ['Onderwerp', 'Type', 'Uren', 'Medewerkers'],
      rijen: rijenData.map(r => [r.titel, labels[r.type] || r.type, rond(r.uren), r.medewerkerNamen])
    };

    return `<div class="card"><h3>Samenvatting per onderwerp</h3>
      <p style="font-size:13px;color:#6b7280">Hoeveel uur is er per project/operatie/valuestream besteed, en wie heeft daaraan gewerkt.</p>
      <div class="tabel-wrap"><table>
        <thead><tr><th>Onderwerp</th><th>Type</th><th>Uren</th><th>Medewerkers</th></tr></thead>
        <tbody>${rijenData.map(r => `<tr><td>${App.ui.escapeHtml(r.titel)}</td><td>${App.ui.escapeHtml(labels[r.type] || r.type)}</td><td>${rond(r.uren)}u</td><td>${App.ui.escapeHtml(r.medewerkerNamen)}</td></tr>`).join('') || '<tr><td colspan="4" class="leeg-melding">Geen geplande uren in deze periode.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  }

  function rapportGroepering(werkitems, bereik, veld, titel) {
    const groepen = {};
    werkitems.forEach(w => {
      const uren = App.capacity.werkitemUrenInPeriode(w, bereik.start, bereik.eind);
      if (uren <= 0) return;
      const key = w[veld] || 'Onbekend';
      groepen[key] = (groepen[key] || 0) + uren;
    });
    const totaal = Object.values(groepen).reduce((s, v) => s + v, 0);
    const rijen = Object.entries(groepen).sort((a, b) => b[1] - a[1]);

    huidigeTabel = {
      kop: [titel, 'Uren', 'Aandeel (%)'],
      rijen: rijen.map(([naam, uren]) => [naam, rond(uren), totaal ? Math.round((uren / totaal) * 100) : 0])
    };

    return `<div class="card"><h3>${titel}</h3>
      <div class="tabel-wrap"><table>
        <thead><tr><th>${titel}</th><th>Uren</th><th>Aandeel</th></tr></thead>
        <tbody>${rijen.map(([naam, uren]) => `<tr><td>${App.ui.escapeHtml(naam)}</td><td>${rond(uren)}u</td><td>${totaal ? Math.round((uren / totaal) * 100) : 0}%</td></tr>`).join('') || '<tr><td colspan="3" class="leeg-melding">Geen geplande uren in deze periode.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  }

  function exporteer() {
    App.ui.downloadCsv(`rapport-${type}-${App.datum.naarIso(new Date())}.csv`, [huidigeTabel.kop, ...huidigeTabel.rijen]);
  }

  return { render };
})();
