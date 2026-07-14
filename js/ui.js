// Kleine, generieke UI- en datumhelpers die door meerdere pagina's gebruikt worden.
window.App = window.App || {};
App.pages = App.pages || {};

App.ui = (function () {
  function toon(html, elId) {
    document.getElementById(elId).innerHTML = html;
  }

  function melding(tekst) {
    const el = document.getElementById('toast');
    el.textContent = tekst;
    el.classList.remove('hidden');
    clearTimeout(melding._t);
    melding._t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Blokkerende waarschuwing wanneer een verlofwijziging de bezetting onder de minimale drempel brengt.
  function waarschuwDrempelOverschreden() {
    alert('Let op: door deze wijziging komt de bezetting op minstens 1 dag onder de minimale bezetting. Neem contact op met je Admin.');
  }

  function downloadCsv(bestandsnaam, rijen) {
    const csv = rijen.map(rij => rij.map(veld => {
      const s = String(veld ?? '');
      return /[;\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = bestandsnaam;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return { toon, melding, escapeHtml, downloadCsv, waarschuwDrempelOverschreden };
})();

App.datum = (function () {
  const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const DAGEN_KORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];

  function pad(n) { return String(n).padStart(2, '0'); }

  function naarIso(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseIso(iso) {
    const [j, m, d] = iso.split('-').map(Number);
    return new Date(j, m - 1, d);
  }

  // Herkent ISO (2025-12-29), Nederlands met maandnaam (29-dec-2025) en dd-mm-jjjj
  function parseFlexibel(tekst) {
    if (!tekst) return null;
    const s = String(tekst).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})-([a-zA-Z]{3,})-(\d{4})$/);
    if (m) {
      const maandIdx = MAANDEN_KORT.indexOf(m[2].toLowerCase().slice(0, 3));
      if (maandIdx >= 0) return new Date(+m[3], maandIdx, +m[1]);
    }
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const fallback = new Date(s);
    return isNaN(fallback) ? null : fallback;
  }

  function isoWeek(d) {
    const dt = new Date(d.getTime());
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
    const jaarStart = new Date(dt.getFullYear(), 0, 4);
    const weeknr = 1 + Math.round(((dt - jaarStart) / 86400000 - 3 + ((jaarStart.getDay() + 6) % 7)) / 7);
    return { jaar: dt.getFullYear(), week: weeknr };
  }

  // Nederlandse feestdagen (vast + paasgebonden via Meeus-algoritme), gecached per jaar
  const feestdagenCache = {};

  function paasZondag(jaar) {
    const a = jaar % 19, b = Math.floor(jaar / 100), c = jaar % 100;
    const d2 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d2 - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const som = h + l - 7 * m + 114;
    return new Date(jaar, Math.floor(som / 31) - 1, (som % 31) + 1);
  }

  function koningsdag(jaar) {
    const d = new Date(jaar, 3, 27);
    if (d.getDay() === 0) d.setDate(26);
    return d;
  }

  function plusDagen(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

  function feestdagenVoorJaar(jaar) {
    if (feestdagenCache[jaar]) return feestdagenCache[jaar];
    const pasen = paasZondag(jaar);
    const lijst = [
      { naam: 'Nieuwjaarsdag', datum: new Date(jaar, 0, 1) },
      { naam: 'Goede Vrijdag', datum: plusDagen(pasen, -2) },
      { naam: 'Eerste Paasdag', datum: pasen },
      { naam: 'Tweede Paasdag', datum: plusDagen(pasen, 1) },
      { naam: 'Koningsdag', datum: koningsdag(jaar) },
      { naam: 'Bevrijdingsdag', datum: new Date(jaar, 4, 5) },
      { naam: 'Hemelvaartsdag', datum: plusDagen(pasen, 39) },
      { naam: 'Eerste Pinksterdag', datum: plusDagen(pasen, 49) },
      { naam: 'Tweede Pinksterdag', datum: plusDagen(pasen, 50) },
      { naam: 'Eerste Kerstdag', datum: new Date(jaar, 11, 25) },
      { naam: 'Tweede Kerstdag', datum: new Date(jaar, 11, 26) }
    ];
    feestdagenCache[jaar] = lijst;
    return lijst;
  }

  function feestdagNaam(d) {
    const treffer = feestdagenVoorJaar(d.getFullYear()).find(f =>
      f.datum.getMonth() === d.getMonth() && f.datum.getDate() === d.getDate());
    return treffer ? treffer.naam : null;
  }

  function isWerkdag(d) {
    const dag = d.getDay();
    if (dag === 0 || dag === 6) return false;
    return !feestdagNaam(d);
  }

  function alleDagenTussen(start, eind) {
    const dagen = [];
    const cur = new Date(start.getTime());
    while (cur <= eind) {
      dagen.push(new Date(cur.getTime()));
      cur.setDate(cur.getDate() + 1);
    }
    return dagen;
  }

  function werkdagenTussen(start, eind) {
    return alleDagenTussen(start, eind).filter(isWerkdag);
  }

  function volgendeWerkdag(d) {
    const r = new Date(d.getTime());
    do { r.setDate(r.getDate() + 1); } while (!isWerkdag(r));
    return r;
  }

  function weekKey(d) {
    const wk = isoWeek(d);
    return wk.jaar + '-W' + pad(wk.week);
  }

  // Omgekeerde van weekKey: geeft de maandag van de opgegeven ISO-weeksleutel (bv. '2026-W29') terug.
  function maandagVanWeekKey(weekKeyStr) {
    const [jaarStr, weekStr] = weekKeyStr.split('-W');
    const jaar = Number(jaarStr), week = Number(weekStr);
    const jan4 = new Date(jaar, 0, 4);
    const dagOffset = (jan4.getDay() + 6) % 7;
    const maandagWeek1 = new Date(jan4.getFullYear(), jan4.getMonth(), jan4.getDate() - dagOffset);
    const resultaat = new Date(maandagWeek1.getTime());
    resultaat.setDate(resultaat.getDate() + (week - 1) * 7);
    return resultaat;
  }

  // Geeft elke ISO-week terug die het bereik [start, eind] raakt, als {weekKey, weekStart}
  function wekenTussen(start, eind) {
    const weken = [];
    const dagOffset = (start.getDay() + 6) % 7; // maandag = 0
    let maandag = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dagOffset);
    while (maandag <= eind) {
      const wk = isoWeek(maandag);
      weken.push({ weekKey: weekKey(maandag), weekStart: new Date(maandag), jaar: wk.jaar, week: wk.week });
      maandag = plusDagen(maandag, 7);
    }
    return weken;
  }

  // Geeft start/eind terug voor de periode (week/maand/kwartaal) die refDatum bevat
  function periodeBereik(granulariteit, refDatum) {
    const d = new Date(refDatum.getTime());
    if (granulariteit === 'week') {
      const dagOffset = (d.getDay() + 6) % 7; // maandag = 0
      const start = new Date(d); start.setDate(d.getDate() - dagOffset);
      const eind = new Date(start); eind.setDate(start.getDate() + 6);
      const wk = isoWeek(start);
      return { start, eind, label: `Week ${wk.week}, ${wk.jaar} (${formatKort(start)} t/m ${formatKort(eind)})` };
    }
    if (granulariteit === 'maand') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const eind = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { start, eind, label: start.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) };
    }
    const kwartaal = Math.floor(d.getMonth() / 3);
    const start = new Date(d.getFullYear(), kwartaal * 3, 1);
    const eind = new Date(d.getFullYear(), kwartaal * 3 + 3, 0);
    return { start, eind, label: `Q${kwartaal + 1} ${d.getFullYear()}` };
  }

  function formatKort(d) {
    return pad(d.getDate()) + '-' + MAANDEN_KORT[d.getMonth()] + '-' + d.getFullYear();
  }

  return {
    naarIso, parseIso, parseFlexibel, isoWeek, isWerkdag, alleDagenTussen, werkdagenTussen,
    volgendeWerkdag, weekKey, maandagVanWeekKey, wekenTussen, feestdagNaam, periodeBereik, formatKort, DAGEN_KORT, MAANDEN_KORT
  };
})();
