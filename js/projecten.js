// Pagina: Projecten overzicht (medewerkers, uren per week, afhankelijkheden, doorschuiven)
window.App = window.App || {};

App.pages.projecten = (function () {
  let uitgeklapt = new Set();

  function render(container) {
    container.innerHTML = `
      <h2>Projecten overzicht</h2>
      <div id="conflictenWrap"></div>
      <div class="card">
        <h3>Ganttchart</h3>
        <div id="ganttWrap"></div>
      </div>
      <div class="card">
        <div class="tabel-wrap">
          <table>
            <thead><tr>
              <th></th><th>Titel</th><th>Medewerkers</th><th>Totaal uren</th><th>Periode</th>
              <th>Beschikbaar vanaf</th><th>Afhankelijk van</th><th>Status</th>
            </tr></thead>
            <tbody id="projectenTbody"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h3>Aangepaste planningen</h3>
        <p style="font-size:13px;color:#6b7280">Projecten waarvan de planning is doorgeschoven t.o.v. de oorspronkelijke periode (bv. door vertraging van een afhankelijkheid).</p>
        <div id="aangepastWrap"></div>
      </div>
    `;
    teken();
  }

  function naamVan(id, medewerkers) { return (medewerkers.find(m => m.id === id) || {}).naam || 'Onbekend'; }

  function totaalUren(w) {
    return Object.values(w.weekUren || {}).reduce((som, perWeek) =>
      som + Object.values(perWeek).reduce((s, u) => s + (Number(u) || 0), 0), 0);
  }

  function rond(n) { return Math.round(n * 10) / 10; }

  function vindConflict(item, alleItems) {
    const afhankelijkheden = (item.afhankelijkVan || []).map(id => alleItems.find(w => w.id === id)).filter(Boolean);
    if (!afhankelijkheden.length) return { conflict: false };
    const start = App.datum.parseFlexibel(item.startDatum);
    let laatsteEind = null;
    afhankelijkheden.forEach(dep => {
      if (dep.status === 'afgerond') return;
      const depEind = App.datum.parseFlexibel(dep.eindDatum);
      if (!laatsteEind || depEind > laatsteEind) laatsteEind = depEind;
    });
    if (laatsteEind && laatsteEind >= start) {
      return { conflict: true, nieuweStart: App.datum.volgendeWerkdag(laatsteEind) };
    }
    return { conflict: false };
  }

  function verschuifWerkitem(item, nieuweStartDatum) {
    const oudeStart = App.datum.parseFlexibel(item.startDatum);
    const oudeEind = App.datum.parseFlexibel(item.eindDatum);
    const deltaDagen = Math.round((nieuweStartDatum - oudeStart) / 86400000);
    const nieuweEind = new Date(oudeEind.getTime());
    nieuweEind.setDate(nieuweEind.getDate() + deltaDagen);

    const nieuweWeekUren = {};
    Object.keys(item.weekUren || {}).forEach(wk => {
      const maandag = App.datum.maandagVanWeekKey(wk);
      const nieuweMaandag = new Date(maandag.getTime());
      nieuweMaandag.setDate(nieuweMaandag.getDate() + deltaDagen);
      nieuweWeekUren[App.datum.weekKey(nieuweMaandag)] = item.weekUren[wk];
    });

    return Object.assign({}, item, {
      startDatum: App.datum.naarIso(nieuweStartDatum),
      eindDatum: App.datum.naarIso(nieuweEind),
      weekUren: nieuweWeekUren,
      laatsteAanpassingDatum: App.datum.naarIso(new Date())
    });
  }

  function doorschuiven(itemId, nieuweStartDatum) {
    const lijst = App.data.werkitems();
    const idx = lijst.findIndex(w => w.id === itemId);
    if (idx < 0) return;
    lijst[idx] = verschuifWerkitem(lijst[idx], nieuweStartDatum);
    App.data.bewaarWerkitems(lijst);
    App.ui.melding('Planning doorgeschoven');
    teken();
  }

  function teken() {
    const alleWerkitems = App.data.werkitems();
    const projecten = alleWerkitems.filter(w => w.type === 'project');
    const medewerkers = App.data.medewerkers();

    const conflicten = projecten.map(p => Object.assign({ item: p }, vindConflict(p, alleWerkitems))).filter(c => c.conflict);
    document.getElementById('conflictenWrap').innerHTML = conflicten.length
      ? conflicten.map(c => `
        <div class="card" style="border-color:var(--rood);background:var(--rood-bg)">
          <strong>${App.ui.escapeHtml(c.item.titel)}</strong> kan niet starten op ${c.item.startDatum} — een afhankelijkheid loopt door tot na de geplande start.
          ${App.auth.magBewerken() ? `<button class="btn gevaar klein" data-doorschuiven="${c.item.id}" data-nieuwe-start="${App.datum.naarIso(c.nieuweStart)}" style="margin-left:8px">Doorschuiven naar ${App.datum.formatKort(c.nieuweStart)}</button>` : ''}
        </div>
      `).join('')
      : '';
    document.querySelectorAll('[data-doorschuiven]').forEach(b => b.addEventListener('click', () =>
      doorschuiven(b.dataset.doorschuiven, App.datum.parseIso(b.dataset.nieuweStart))));

    document.getElementById('ganttWrap').innerHTML = tekenGantt(projecten, alleWerkitems);

    const tbody = document.getElementById('projectenTbody');
    if (!projecten.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="leeg-melding">Nog geen projecten (type "Project") aangemaakt.</td></tr>';
    } else {
      tbody.innerHTML = projecten.map(p => rijProject(p, medewerkers, alleWerkitems)).join('');
      tbody.querySelectorAll('[data-toggle-project]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.toggleProject;
        if (uitgeklapt.has(id)) uitgeklapt.delete(id); else uitgeklapt.add(id);
        teken();
      }));
    }

    const aangepast = projecten.filter(p => p.startDatum !== p.oorspronkelijkeStartDatum || p.eindDatum !== p.oorspronkelijkeEindDatum);
    document.getElementById('aangepastWrap').innerHTML = aangepast.length
      ? `<div class="tabel-wrap"><table>
          <thead><tr><th>Project</th><th>Oorspronkelijke periode</th><th>Nieuwe periode</th><th>Aangepast op</th></tr></thead>
          <tbody>${aangepast.map(p => `<tr>
            <td>${App.ui.escapeHtml(p.titel)}</td>
            <td>${p.oorspronkelijkeStartDatum} &rarr; ${p.oorspronkelijkeEindDatum}</td>
            <td>${p.startDatum} &rarr; ${p.eindDatum}</td>
            <td>${p.laatsteAanpassingDatum ? App.datum.formatKort(App.datum.parseIso(p.laatsteAanpassingDatum)) : '-'}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : '<p class="leeg-melding">Geen aangepaste planningen.</p>';
  }

  // Eenvoudige Ganttchart (SVG) op basis van start/eind per project en afhankelijkVan-koppelingen.
  function tekenGantt(projecten, alleWerkitems) {
    if (!projecten.length) return '<p class="leeg-melding">Nog geen projecten om in de Ganttchart te tonen.</p>';

    const parsed = projecten.map(p => ({
      project: p,
      start: App.datum.parseFlexibel(p.startDatum),
      eind: App.datum.parseFlexibel(p.eindDatum)
    })).filter(p => p.start && p.eind).sort((a, b) => a.start - b.start);
    if (!parsed.length) return '<p class="leeg-melding">Nog geen projecten met een geldige periode.</p>';

    const minDatum = new Date(Math.min(...parsed.map(p => p.start.getTime())));
    const maxDatum = new Date(Math.max(...parsed.map(p => p.eind.getTime())));
    const totaalDagen = Math.max(1, Math.round((maxDatum - minDatum) / 86400000) + 1);

    const pxPerDag = 8;
    const rijHoogte = 34;
    const labelBreedte = 220;
    const breedte = labelBreedte + totaalDagen * pxPerDag + 20;
    const hoogte = 30 + parsed.length * rijHoogte;

    const xVoorDatum = d => labelBreedte + Math.round((d - minDatum) / 86400000) * pxPerDag;
    const idIndex = {};
    parsed.forEach((p, i) => { idIndex[p.project.id] = i; });

    const maanden = [];
    let cursor = new Date(minDatum.getFullYear(), minDatum.getMonth(), 1);
    while (cursor <= maxDatum) {
      maanden.push(new Date(cursor.getTime()));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    const maandLijnen = maanden.map(m => {
      const x = xVoorDatum(m);
      return `<line x1="${x}" y1="20" x2="${x}" y2="${hoogte}" stroke="var(--grijs-rand)" stroke-width="1"></line>
        <text x="${x + 4}" y="14" font-size="11" fill="#6b7280">${App.ui.escapeHtml(m.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' }))}</text>`;
    }).join('');

    const afhankelijkheidLijnen = parsed.map((p, i) => (p.project.afhankelijkVan || []).map(depId => {
      const depIdx = idIndex[depId];
      if (depIdx == null) return '';
      const dep = parsed[depIdx];
      const x1 = xVoorDatum(dep.eind) + pxPerDag;
      const y1 = 28 + depIdx * rijHoogte + rijHoogte / 2;
      const x2 = xVoorDatum(p.start);
      const y2 = 28 + i * rijHoogte + rijHoogte / 2;
      const xTussen = x1 + 10;
      return `<path d="M${x1},${y1} L${xTussen},${y1} L${xTussen},${y2} L${x2},${y2}" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="3,2" marker-end="url(#gantt-arrow)"></path>`;
    }).join('')).join('');

    const balken = parsed.map((p, i) => {
      const y = 28 + i * rijHoogte;
      const x1 = xVoorDatum(p.start);
      const x2 = xVoorDatum(p.eind) + pxPerDag;
      const conflict = vindConflict(p.project, alleWerkitems).conflict;
      const kleur = conflict ? 'var(--rood)' : 'var(--blauw)';
      return `<text x="4" y="${y + rijHoogte / 2 + 4}" font-size="12" fill="var(--tekst)">${App.ui.escapeHtml(p.project.titel)}</text>
        <rect x="${x1}" y="${y + 6}" width="${Math.max(4, x2 - x1)}" height="${rijHoogte - 14}" rx="4" fill="${kleur}"><title>${App.ui.escapeHtml(p.project.titel)}: ${p.project.startDatum} &rarr; ${p.project.eindDatum}</title></rect>`;
    }).join('');

    return `<div class="tabel-wrap">
      <svg width="${breedte}" height="${hoogte}" style="font-family:inherit;min-width:100%">
        <defs>
          <marker id="gantt-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af"></path>
          </marker>
        </defs>
        ${maandLijnen}
        ${afhankelijkheidLijnen}
        ${balken}
      </svg>
    </div>
    <p style="font-size:12px;color:#6b7280;margin-top:6px">Gestippelde lijnen tonen afhankelijkheden tussen projecten. Rode balken hebben een planningsconflict (zie hierboven).</p>`;
  }

  function rijProject(p, medewerkers, alleWerkitems) {
    const isOpen = uitgeklapt.has(p.id);
    const beschikbaarVanaf = App.datum.formatKort(App.datum.volgendeWerkdag(App.datum.parseFlexibel(p.eindDatum)));
    const afhankelijkNamen = (p.afhankelijkVan || []).map(id => {
      const dep = alleWerkitems.find(w => w.id === id);
      return dep ? dep.titel : null;
    }).filter(Boolean).join(', ') || '-';

    const hoofdRij = `<tr>
      <td><button type="button" class="btn secundair klein" data-toggle-project="${p.id}">${isOpen ? '▾' : '▸'}</button></td>
      <td>${App.ui.escapeHtml(p.titel)}</td>
      <td>${p.medewerkerIds.map(id => App.ui.escapeHtml(naamVan(id, medewerkers))).join(', ') || '-'}</td>
      <td>${rond(totaalUren(p))}u</td>
      <td>${p.startDatum} &rarr; ${p.eindDatum}</td>
      <td>${beschikbaarVanaf}</td>
      <td>${App.ui.escapeHtml(afhankelijkNamen)}</td>
      <td>${App.ui.escapeHtml(p.status)}</td>
    </tr>`;
    if (!isOpen) return hoofdRij;
    return hoofdRij + `<tr><td colspan="8" style="background:var(--grijs-bg)">${tekenWeekdetail(p, medewerkers)}</td></tr>`;
  }

  function tekenWeekdetail(p, medewerkers) {
    const weekKeys = Object.keys(p.weekUren || {}).sort();
    if (!weekKeys.length) return '<p class="leeg-melding" style="margin:4px 0">Geen weekplanning.</p>';
    const gekozen = p.medewerkerIds.map(id => medewerkers.find(m => m.id === id)).filter(Boolean);
    const header = `<tr><th>Week</th>${gekozen.map(m => `<th>${App.ui.escapeHtml(m.naam)}</th>`).join('')}<th>Totaal</th></tr>`;
    const rijen = weekKeys.map(wk => {
      const perWeek = p.weekUren[wk] || {};
      const totaalWeek = gekozen.reduce((s, m) => s + (Number(perWeek[m.id]) || 0), 0);
      const cellen = gekozen.map(m => `<td>${rond(Number(perWeek[m.id]) || 0)}u</td>`).join('');
      return `<tr><td>${wk}</td>${cellen}<td><strong>${rond(totaalWeek)}u</strong></td></tr>`;
    }).join('');
    return `<table style="margin:4px 0"><thead>${header}</thead><tbody>${rijen}</tbody></table>`;
  }

  return { render };
})();
