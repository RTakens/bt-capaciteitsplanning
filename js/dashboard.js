// Pagina: Dashboard - beschikbare vs geplande capaciteit
window.App = window.App || {};

App.pages.dashboard = (function () {
  let granulariteit = 'week';
  let refDatum = new Date();
  let splitsPerFunctie = false;
  let aantalWekenVooruit = 8;
  let uitgeklapt = new Set();
  let bezettingRefDatum = new Date();
  let bezettingUitgeklapt = new Set();
  let bezettingKalenderWeken = 8;
  // Vast venster van weken voor de kalender, los van bezettingRefDatum (dat stuurt alleen de dag-detailtabel eronder) —
  // zo verschuift het venster niet wanneer je in de kalender op een week klikt.
  const bezettingKalenderVenster = App.datum.periodeBereik('week', new Date()).start;

  function render(container) {
    container.innerHTML = `
      <h2>Dashboard</h2>
      <div id="dashboardInhoud"></div>
    `;
    tekenInhoud();
  }

  function verschuifPeriode(richting) {
    const d = new Date(refDatum.getTime());
    if (granulariteit === 'week') d.setDate(d.getDate() + 7 * richting);
    else if (granulariteit === 'maand') d.setMonth(d.getMonth() + richting);
    else d.setMonth(d.getMonth() + 3 * richting);
    refDatum = d;
  }

  function tekenInhoud() {
    const bereik = App.datum.periodeBereik(granulariteit, refDatum);

    const medewerkers = App.data.medewerkers();
    const werkitems = App.data.werkitems();
    const verlof = App.data.verlof();
    const resultaten = App.capacity.berekenAlleMedewerkers(bereik.start, bereik.eind, medewerkers, werkitems, verlof);
    const teams = App.capacity.berekenPerGroep(resultaten, splitsPerFunctie);

    const totBeschikbaar = resultaten.reduce((s, r) => s + r.beschikbaar, 0);
    const totGepland = resultaten.reduce((s, r) => s + r.gepland, 0);
    const overbelast = resultaten.filter(r => r.status === 'rood').length;
    const onderbenut = resultaten.filter(r => r.onderbenut).length;

    const perType = { operatie: 0, valuestream: 0, project: 0, changes: 0 };
    resultaten.forEach(r => Object.keys(perType).forEach(t => perType[t] += r.perType[t]));

    document.getElementById('dashboardInhoud').innerHTML = `
      <div class="grid-3">
        <div class="card kpi"><div class="waarde">${rond(totBeschikbaar)}</div><div class="label">Beschikbare uren</div></div>
        <div class="card kpi"><div class="waarde">${rond(totGepland)}</div><div class="label">Geplande uren</div></div>
        <div class="card kpi"><div class="waarde" style="color:${overbelast ? 'var(--rood)' : 'var(--groen)'}">${overbelast}</div><div class="label">Medewerkers overbelast</div></div>
      </div>

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0">Bezetting</h3>
          <div class="rij" style="margin:0;align-items:center">
            <button class="btn secundair klein" id="bezettingVorigeBtn">&larr;</button>
            <strong id="bezettingWeekLabel"></strong>
            <button class="btn secundair klein" id="bezettingVolgendeBtn">&rarr;</button>
            <div class="veld" style="margin:0"><label>Zoek week met datum</label><input type="date" id="bezettingDatumInput" value="${App.datum.naarIso(bezettingRefDatum)}"></div>
          </div>
        </div>
        <div class="toolbar" style="margin-bottom:6px">
          <span style="font-size:13px;color:var(--tekst-secundair)">Meerdere weken — klik op een week om erheen te springen</span>
          <div class="veld" style="margin:0">
            <select id="bezettingKalenderWekenSelect">
              <option value="4">4 weken</option>
              <option value="8">8 weken</option>
              <option value="12">12 weken</option>
              <option value="26">26 weken</option>
            </select>
          </div>
        </div>
        <div class="legenda">
          <span><span class="badge groen" style="margin-right:6px">Voldoende</span></span>
          <span><span class="badge oranje" style="margin-right:6px">Risico bij goedkeuring verzoeken</span></span>
          <span><span class="badge rood" style="margin-right:6px">Onder minimale bezetting</span></span>
        </div>
        ${tekenBezettingKalender(medewerkers, verlof)}
        ${tekenBezetting(medewerkers, verlof)}
      </div>

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0">Workload per medewerker</h3>
          <div class="rij" style="margin:0;align-items:center">
            <button class="btn secundair klein" id="vorigeBtn">&larr;</button>
            <select id="granulariteitSelect">
              <option value="week">Per week</option>
              <option value="maand">Per maand</option>
              <option value="kwartaal">Per kwartaal</option>
            </select>
            <button class="btn secundair klein" id="volgendeBtn">&rarr;</button>
            <strong id="periodeLabel">${bereik.label}</strong>
          </div>
        </div>
        ${onderbenut ? `<p style="font-size:13px;color:var(--tekst-secundair)">${onderbenut} medewerker(s) zijn onderbenut (&lt;50% van beschikbare capaciteit ingepland).</p>` : ''}
        <div class="tabel-wrap">
          <table>
            <thead><tr><th>Medewerker</th><th>Team</th><th>Beschikbaar</th><th>Gepland</th><th>Bezetting</th><th>Status</th></tr></thead>
            <tbody>${resultaten.map(rijMedewerker).join('') || '<tr><td colspan="6" class="leeg-melding">Geen medewerkers.</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="toolbar">
            <h3 style="margin:0">Capaciteit per team</h3>
            <label style="font-weight:normal;font-size:13px;display:flex;align-items:center;gap:4px">
              <input type="checkbox" id="splitsFunctieCheck" ${splitsPerFunctie ? 'checked' : ''}> Splits per functie
            </label>
          </div>
          <div class="tabel-wrap">
            <table>
              <thead><tr><th>Team</th>${splitsPerFunctie ? '<th>Functie</th>' : ''}<th>Beschikbaar</th><th>Gepland</th><th>Bezetting</th><th>Status</th></tr></thead>
              <tbody>${teams.map(rijTeam).join('') || `<tr><td colspan="${splitsPerFunctie ? 6 : 5}" class="leeg-melding">Geen teams.</td></tr>`}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <h3>Verdeling type werk</h3>
          ${tekenVerdeling(perType, totGepland)}
        </div>
      </div>

      <div class="card">
        <div class="toolbar">
          <h3 style="margin:0">Vooruitblik: capaciteit per week</h3>
          <div class="veld" style="margin:0">
            <select id="aantalWekenSelect">
              <option value="4">4 weken</option>
              <option value="8">8 weken</option>
              <option value="12">12 weken</option>
              <option value="26">26 weken</option>
            </select>
          </div>
        </div>
        <p style="font-size:13px;color:var(--tekst-secundair)">Bezetting per medewerker per week, vanaf de huidig geselecteerde week. Zo is toekomstige capaciteit in één oogopslag te zien.</p>
        <div class="tabel-wrap">${tekenVooruitblik(medewerkers, werkitems, verlof)}</div>
      </div>
    `;

    document.getElementById('granulariteitSelect').value = granulariteit;
    document.getElementById('granulariteitSelect').addEventListener('change', e => { granulariteit = e.target.value; tekenInhoud(); });
    document.getElementById('vorigeBtn').addEventListener('click', () => { verschuifPeriode(-1); tekenInhoud(); });
    document.getElementById('volgendeBtn').addEventListener('click', () => { verschuifPeriode(1); tekenInhoud(); });

    document.getElementById('splitsFunctieCheck').addEventListener('change', e => {
      splitsPerFunctie = e.target.checked;
      tekenInhoud();
    });
    document.getElementById('aantalWekenSelect').value = aantalWekenVooruit;
    document.getElementById('aantalWekenSelect').addEventListener('change', e => {
      aantalWekenVooruit = Number(e.target.value);
      tekenInhoud();
    });
    document.querySelectorAll('[data-toggle-medewerker]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.toggleMedewerker;
      if (uitgeklapt.has(id)) uitgeklapt.delete(id); else uitgeklapt.add(id);
      tekenInhoud();
    }));

    const bezettingBereik = App.datum.periodeBereik('week', bezettingRefDatum);
    document.getElementById('bezettingWeekLabel').textContent = bezettingBereik.label;
    document.getElementById('bezettingVorigeBtn').addEventListener('click', () => {
      const d = new Date(bezettingRefDatum.getTime()); d.setDate(d.getDate() - 7); bezettingRefDatum = d; tekenInhoud();
    });
    document.getElementById('bezettingVolgendeBtn').addEventListener('click', () => {
      const d = new Date(bezettingRefDatum.getTime()); d.setDate(d.getDate() + 7); bezettingRefDatum = d; tekenInhoud();
    });
    document.getElementById('bezettingDatumInput').addEventListener('change', e => {
      if (e.target.value) { bezettingRefDatum = App.datum.parseIso(e.target.value); tekenInhoud(); }
    });
    document.getElementById('bezettingKalenderWekenSelect').value = bezettingKalenderWeken;
    document.getElementById('bezettingKalenderWekenSelect').addEventListener('change', e => {
      bezettingKalenderWeken = Number(e.target.value);
      tekenInhoud();
    });
    document.querySelectorAll('[data-spring-week]').forEach(b => b.addEventListener('click', () => {
      bezettingRefDatum = App.datum.parseIso(b.dataset.springWeek);
      tekenInhoud();
    }));
    document.querySelectorAll('[data-toggle-dag]').forEach(b => b.addEventListener('click', () => {
      const iso = b.dataset.toggleDag;
      if (bezettingUitgeklapt.has(iso)) bezettingUitgeklapt.delete(iso); else bezettingUitgeklapt.add(iso);
      tekenInhoud();
    }));
    document.querySelectorAll('[data-goedkeuren-verzoek]').forEach(b => b.addEventListener('click', () => {
      const verzoekId = b.dataset.goedkeurenVerzoek;
      const datum = (App.data.verlof().find(v => v.id === verzoekId) || {}).datum;
      App.data.goedkeurenVerzoek([verzoekId]);
      App.ui.melding('Verzoek goedgekeurd en omgezet naar Afwezig');
      tekenInhoud();
      if (datum) {
        const instellingen = App.settings.get();
        const overschreden = App.capacity.bezettingVoorDag(App.datum.parseIso(datum), medewerkers, App.data.verlof(), instellingen).onderMinimum;
        if (overschreden) App.ui.waarschuwDrempelOverschreden();
      }
    }));
  }

  // Berekent aanwezigheid/verzoeken/drempeloverschrijding voor één dag. Gedeeld door het dag-detail
  // (tekenBezetting) en de meerdere-weken kalender (tekenBezettingKalender) zodat de drempellogica maar op één plek staat.
  function berekenDagBezetting(dag, medewerkers, verlof, instellingen) {
    const iso = App.datum.naarIso(dag);
    const naamVan = id => (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend';
    const basis = App.capacity.bezettingVoorDag(dag, medewerkers, verlof, instellingen);
    const verzoeken = [];
    const verzoekPerRol = {};
    medewerkers.forEach(m => {
      const entries = verlof.filter(v => v.medewerkerId === m.id && v.datum === iso && v.type === 'verzoek');
      if (entries.length) {
        const rol = m.rol || 'Onbekend';
        verzoekPerRol[rol] = (verzoekPerRol[rol] || 0) + entries.length;
        entries.forEach(v => verzoeken.push({ id: v.id, medewerkerId: m.id, naam: naamVan(m.id) }));
      }
    });
    const bijGoedkeuring = Math.max(0, basis.aanwezig - verzoeken.length);
    // Niet alleen de totale drempel kan bij goedkeuring overschreden worden, ook een drempel per rol
    // (bv. alle openstaande verzoeken zitten toevallig allemaal in dezelfde rol).
    const rolRisicoBijGoedkeuring = Object.entries(basis.perRol).some(([rol, v]) => {
      const minimum = instellingen.minimaleBezettingPerRol[rol] || 0;
      if (!minimum) return false;
      return Math.max(0, v.aanwezig - (verzoekPerRol[rol] || 0)) < minimum;
    });
    const risicoBijGoedkeuring = verzoeken.length > 0 && (bijGoedkeuring < instellingen.minimaleBezetting || rolRisicoBijGoedkeuring);
    return Object.assign({ dag, iso, verzoeken, bijGoedkeuring, risicoBijGoedkeuring }, basis);
  }

  function tekenBezetting(medewerkers, verlof) {
    const instellingen = App.settings.get();
    const magGoedkeuren = App.auth.magGoedkeuren();
    const weekBereik = App.datum.periodeBereik('week', bezettingRefDatum);
    const dagen = App.datum.werkdagenTussen(weekBereik.start, weekBereik.eind);
    const totaal = medewerkers.length;

    const rijen = dagen.map(dag => berekenDagBezetting(dag, medewerkers, verlof, instellingen));

    const header = '<tr><th></th><th>Dag</th><th>Datum</th><th>Aanwezig</th><th>Open verzoeken</th><th>Bij goedkeuring</th></tr>';
    const lichaam = rijen.map(r => {
      const onderMinimum = r.onderMinimum;
      const risicoBijGoedkeuring = r.risicoBijGoedkeuring;
      const isOpen = bezettingUitgeklapt.has(r.iso);
      const hoofdRij = `<tr${onderMinimum ? ' style="background:var(--rood-bg)"' : ''}>
        <td><button type="button" class="btn secundair klein" data-toggle-dag="${r.iso}">${isOpen ? '▾' : '▸'}</button></td>
        <td>${App.datum.DAGEN_KORT[r.dag.getDay()]}</td>
        <td>${App.datum.formatKort(r.dag)}</td>
        <td><strong style="color:${onderMinimum ? 'var(--rood)' : 'inherit'}">${rond(r.aanwezig)} / ${totaal}</strong></td>
        <td>${r.verzoeken.length > 0 ? `<span class="badge verzoek">${r.verzoeken.length} open</span>` : '-'}</td>
        <td${risicoBijGoedkeuring ? ' style="background:var(--oranje-bg)"' : ''}>${r.verzoeken.length > 0 ? `<strong style="color:${risicoBijGoedkeuring ? 'var(--oranje-tekst)' : 'inherit'}">${rond(r.bijGoedkeuring)} / ${totaal}</strong>${risicoBijGoedkeuring ? ' &#9888;' : ''}` : '-'}</td>
      </tr>`;
      if (!isOpen) return hoofdRij;
      return hoofdRij + `<tr><td colspan="6" style="background:var(--grijs-bg)">${tekenDagDetail(r, magGoedkeuren)}</td></tr>`;
    }).join('');

    return `<p style="font-size:13px;color:var(--tekst-secundair)">Minimale bezetting: ${instellingen.minimaleBezetting} medewerkers totaal (en eventueel per rol) — instelbaar bij Instellingen. Een hele dag verlof telt niet mee, een halve dag (ochtend/middag) telt voor een halve medewerker mee; open verzoeken worden apart getoond zodat je de impact van goedkeuring kunt inschatten. Klik op een dag om de bezetting per rol te zien.</p>
      <div class="tabel-wrap"><table><thead>${header}</thead><tbody>${lichaam || '<tr><td colspan="6" class="leeg-melding">Geen werkdagen deze week.</td></tr>'}</tbody></table></div>`;
  }

  // Rood = onder minimale bezetting op minstens 1 werkdag; oranje = geen tekort, maar goedkeuren van
  // openstaande verzoeken zou dat wel veroorzaken; groen = geen risico.
  function berekenWeekStatusBezetting(weekStart, weekEind, medewerkers, verlof, instellingen) {
    const dagen = App.datum.werkdagenTussen(weekStart, weekEind);
    let status = 'groen';
    dagen.forEach(dag => {
      const r = berekenDagBezetting(dag, medewerkers, verlof, instellingen);
      if (r.onderMinimum) status = 'rood';
      else if (status !== 'rood' && r.risicoBijGoedkeuring) status = 'oranje';
    });
    return status;
  }

  function tekenBezettingKalender(medewerkers, verlof) {
    const instellingen = App.settings.get();
    const geselecteerdeWeek = App.datum.periodeBereik('week', bezettingRefDatum);
    const achtergrond = { groen: 'var(--groen-bg)', oranje: 'var(--oranje-bg)', rood: 'var(--rood-bg)' };
    const kleur = { groen: 'var(--groen)', oranje: 'var(--oranje-tekst)', rood: 'var(--rood)' };

    const tegels = [];
    let cursor = new Date(bezettingKalenderVenster.getTime());
    for (let i = 0; i < bezettingKalenderWeken; i++) {
      const eind = new Date(cursor.getTime()); eind.setDate(cursor.getDate() + 6);
      const wk = App.datum.isoWeek(cursor);
      const status = berekenWeekStatusBezetting(cursor, eind, medewerkers, verlof, instellingen);
      const isHuidig = App.datum.naarIso(cursor) === App.datum.naarIso(geselecteerdeWeek.start);
      tegels.push({ iso: App.datum.naarIso(cursor), nr: wk.week, sub: App.datum.formatKort(cursor), status, isHuidig });
      cursor.setDate(cursor.getDate() + 7);
    }

    return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      ${tegels.map(t => `<button type="button" data-spring-week="${t.iso}" style="cursor:pointer;border:${t.isHuidig ? '2px solid var(--primair)' : '1px solid var(--grijs-rand)'};border-radius:6px;padding:6px 10px;text-align:center;background:${achtergrond[t.status]};color:${kleur[t.status]};font-size:12px;font-weight:600;min-width:70px">
        Wk ${t.nr}<br><span style="font-weight:normal;font-size:11px">${t.sub}</span>
      </button>`).join('')}
    </div>`;
  }

  function tekenDagDetail(r, magGoedkeuren) {
    const rolRijen = Object.entries(r.perRol).map(([rol, v]) => `<tr>
      <td>${App.ui.escapeHtml(rol)}</td><td>${rond(v.aanwezig)} / ${v.totaal}</td>
    </tr>`).join('');
    const rolTabel = `<table style="margin:4px 0 12px 0"><thead><tr><th>Rol</th><th>Aanwezig</th></tr></thead><tbody>${rolRijen}</tbody></table>`;

    if (!r.verzoeken.length) return rolTabel;
    const verzoekRijen = r.verzoeken.map(v => `<tr>
      <td>${App.ui.escapeHtml(v.naam)}</td>
      <td>${magGoedkeuren ? `<button type="button" class="btn klein" data-goedkeuren-verzoek="${v.id}">Goedkeuren</button>` : '<span class="leeg-melding">Geen rechten om goed te keuren</span>'}</td>
    </tr>`).join('');
    return rolTabel + `<strong>Openstaande verzoeken</strong><table style="margin:4px 0"><thead><tr><th>Medewerker</th><th></th></tr></thead><tbody>${verzoekRijen}</tbody></table>`;
  }

  function tekenVooruitblik(medewerkers, werkitems, verlof) {
    if (!medewerkers.length) return '<p class="leeg-melding">Geen medewerkers.</p>';
    const huidigeWeek = App.datum.periodeBereik('week', refDatum);
    const weken = [];
    let cursor = new Date(huidigeWeek.start.getTime());
    for (let i = 0; i < aantalWekenVooruit; i++) {
      const eind = new Date(cursor.getTime()); eind.setDate(cursor.getDate() + 6);
      const wk = App.datum.isoWeek(cursor);
      weken.push({ start: new Date(cursor.getTime()), eind, nr: wk.week, sub: App.datum.formatKort(cursor) });
      cursor.setDate(cursor.getDate() + 7);
    }

    const header = `<tr><th>Medewerker</th>${weken.map(w => `<th style="text-align:center">Wk ${w.nr}<br><span style="font-weight:normal;font-size:11px">${w.sub}</span></th>`).join('')}</tr>`;
    const rijen = medewerkers.map(m => {
      const cellen = weken.map(w => {
        const r = App.capacity.berekenMedewerker(m, w.start, w.eind, werkitems, verlof);
        if (r.opVerlof) return `<td style="text-align:center;color:var(--tekst-secundair);font-style:italic" title="Op verlof deze week">verlof</td>`;
        const pct = Math.round(r.ratio * 100);
        const bgVar = r.status === 'rood' ? '--rood-bg' : r.status === 'oranje' ? '--oranje-bg' : '--groen-bg';
        const kleurVar = r.status === 'rood' ? '--rood' : r.status === 'oranje' ? '--oranje' : '--groen';
        const titel = `${rond(r.beschikbaar)}u beschikbaar, ${rond(r.gepland)}u gepland${r.overbelastMetVerlof ? ' (incl. verlof)' : ''}`;
        return `<td style="text-align:center;background:var(${bgVar});color:var(${kleurVar});font-weight:600" title="${titel}">${pct}%</td>`;
      }).join('');
      return `<tr><td>${App.ui.escapeHtml(m.naam)}</td>${cellen}</tr>`;
    }).join('');

    return `<table><thead>${header}</thead><tbody>${rijen}</tbody></table>`;
  }

  function rond(n) { return Math.round(n * 10) / 10; }

  function balk(ratio, status) {
    const pct = Math.min(100, Math.round(ratio * 100));
    return `<div class="balk-track"><div class="balk-vulling ${status}" style="width:${pct}%"></div></div>`;
  }

  function badgeKlasse(r) {
    if (r.status !== 'groen') return r.status;
    return r.opVerlof ? 'neutraal' : 'groen';
  }

  function rijMedewerker(r) {
    const isOpen = uitgeklapt.has(r.medewerker.id);
    const hoofdRij = `<tr>
      <td>
        <button type="button" class="btn secundair klein" data-toggle-medewerker="${r.medewerker.id}" style="margin-right:6px">${isOpen ? '▾' : '▸'}</button>${App.ui.escapeHtml(r.medewerker.naam)}
      </td>
      <td>${App.ui.escapeHtml(r.medewerker.team)}</td>
      <td>${rond(r.beschikbaar)}u</td>
      <td>${rond(r.gepland)}u</td>
      <td style="min-width:120px">${balk(r.ratio, r.status)} ${Math.round(r.ratio * 100)}%</td>
      <td><span class="badge ${badgeKlasse(r)}">${labelStatusMedewerker(r)}</span></td>
    </tr>`;
    if (!isOpen) return hoofdRij;
    return hoofdRij + `<tr><td colspan="6" style="background:var(--grijs-bg)">${tekenWerkitemDetails(r)}</td></tr>`;
  }

  function tekenWerkitemDetails(r) {
    if (!r.werkitemDetails.length) {
      return '<p class="leeg-melding" style="margin:4px 0">Geen werkitems in deze periode.</p>';
    }
    const labels = App.pages.werkitems.TYPE_LABEL;
    const rijen = r.werkitemDetails.map(w => `<tr>
      <td>${App.ui.escapeHtml(w.titel)}</td>
      <td>${labels[w.type] || w.type}</td>
      <td>${rond(w.uren)}u</td>
      <td>${App.ui.escapeHtml(w.status)}</td>
    </tr>`).join('');
    return `<table style="margin:4px 0">
      <thead><tr><th>Werkitem</th><th>Type</th><th>Uren (deze periode)</th><th>Status</th></tr></thead>
      <tbody>${rijen}</tbody>
    </table>`;
  }

  function rijTeam(t) {
    const ratio = t.ratio;
    return `<tr>
      <td>${App.ui.escapeHtml(t.team)}</td>
      ${t.rol !== null && t.rol !== undefined ? `<td>${App.ui.escapeHtml(t.rol)}</td>` : ''}
      <td>${rond(t.beschikbaar)}u</td>
      <td>${rond(t.gepland)}u</td>
      <td style="min-width:120px">${balk(ratio, t.status)} ${Math.round(ratio * 100)}%</td>
      <td><span class="badge ${t.status}">${labelStatusGroep(t)}</span></td>
    </tr>`;
  }

  function labelStatusMedewerker(r) {
    if (r.status === 'rood') return r.overbelastMetVerlof ? 'Overbelast (incl. verlof)' : 'Overbelast';
    if (r.status === 'oranje') return 'Bijna vol';
    if (r.opVerlof) return 'Op verlof';
    return r.onderbenut ? 'Onderbenut' : 'Voldoende';
  }

  function labelStatusGroep(t) {
    if (t.status === 'rood') return 'Overbelast';
    if (t.status === 'oranje') return 'Bijna vol';
    return 'Voldoende';
  }

  function tekenVerdeling(perType, totaal) {
    const kleuren = { operatie: '#1d4ed8', valuestream: '#0891b2', project: '#7c3aed', changes: '#ea580c' };
    const labels = App.pages.werkitems.TYPE_LABEL;
    if (!totaal) return '<p class="leeg-melding">Geen geplande uren in deze periode.</p>';
    const balken = Object.keys(perType).map(t => {
      const pct = totaal > 0 ? Math.round((perType[t] / totaal) * 100) : 0;
      return `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:13px"><span>${labels[t]}</span><span>${rond(perType[t])}u (${pct}%)</span></div>
        <div class="balk-track"><div class="balk-vulling" style="width:${pct}%;background:${kleuren[t]}"></div></div>
      </div>`;
    }).join('');
    return balken;
  }

  return { render };
})();
