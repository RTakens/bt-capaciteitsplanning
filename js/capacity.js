// Rekenkern: beschikbare vs geplande capaciteit per medewerker/team/periode.
// Uitgangspunten (MVP, bewust eenvoudig gehouden):
// - Standaard 8 uur per werkdag (40u/week) voor iedereen; weekend en NL-feestdagen tellen niet als werkdag
// - 'afwezig'/'anders' verlof = die dag 0 beschikbare uren; 'standby' telt niet als afwezig
// - Werkitems worden altijd per week per medewerker ingepland (weekUren); geen uren = geen planning
// - Alles vanaf 85% bezetting geldt als overbelast
window.App = window.App || {};

App.capacity = (function () {
  const STANDAARD_UUR_PER_DAG = 8;

  function statusVoorRatio(ratio) {
    const { roodGrens, oranjeGrens } = App.settings.get();
    if (ratio >= roodGrens) return 'rood';
    if (ratio >= oranjeGrens) return 'oranje';
    return 'groen';
  }

  function isOnderbenut(ratio) {
    return ratio < 0.5;
  }

  // Uren voor één medewerker op een werkitem binnen de opgevraagde periode, uit de weekUren-planning.
  function werkitemUrenVoorMedewerker(item, medewerkerId, periodeStart, periodeEind) {
    if (!item.weekUren) return 0;
    const weken = App.datum.wekenTussen(periodeStart, periodeEind);
    let totaal = 0;
    weken.forEach(w => {
      const perWeek = item.weekUren[w.weekKey];
      if (perWeek && perWeek[medewerkerId] != null) totaal += Number(perWeek[medewerkerId]) || 0;
    });
    return totaal;
  }

  // Totaal uren van een werkitem (alle toegewezen medewerkers) binnen de opgevraagde periode.
  function werkitemUrenInPeriode(item, periodeStart, periodeEind) {
    return item.medewerkerIds.reduce((som, id) => som + werkitemUrenVoorMedewerker(item, id, periodeStart, periodeEind), 0);
  }

  // Verdeelt een totaal aantal uren gelijk over de weken in [start, eind] en de opgegeven medewerkers.
  function verdeelGelijkOverWeken(startDatum, eindDatum, medewerkerIds, totaalUren) {
    const start = App.datum.parseFlexibel(startDatum);
    const eind = App.datum.parseFlexibel(eindDatum);
    const weekUren = {};
    if (!start || !eind || !medewerkerIds.length) return weekUren;
    const weken = App.datum.wekenTussen(start, eind);
    if (!weken.length) return weekUren;
    const perCel = Math.round((totaalUren / weken.length / medewerkerIds.length) * 10) / 10;
    weken.forEach(w => {
      weekUren[w.weekKey] = {};
      medewerkerIds.forEach(id => weekUren[w.weekKey][id] = perCel);
    });
    return weekUren;
  }

  function medewerkerBeschikbaarInPeriode(medewerker, periodeStart, periodeEind, alleVerlof) {
    const werkdagen = App.datum.werkdagenTussen(periodeStart, periodeEind);
    const eigenVerlof = alleVerlof.filter(v => v.medewerkerId === medewerker.id);

    let beschikbaar = 0, verlofDagen = 0, standbyDagen = 0, heeftVerlofNietHerhalend = false;
    werkdagen.forEach(dag => {
      const iso = App.datum.naarIso(dag);
      const entriesVandaag = eigenVerlof.filter(v => v.datum === iso);
      // 'verzoek' is nog niet bevestigd en telt daarom niet mee als afwezigheid.
      const afwezigEntry = entriesVandaag.find(v => v.type === 'afwezig' || v.type === 'anders');
      const standbyEntry = entriesVandaag.find(v => v.type === 'standby');

      if (afwezigEntry) {
        const halveDag = afwezigEntry.dagdeel === 'ochtend' || afwezigEntry.dagdeel === 'middag';
        beschikbaar += halveDag ? STANDAARD_UUR_PER_DAG / 2 : 0;
        if (!halveDag) verlofDagen++;
        if (!afwezigEntry.herhalend) heeftVerlofNietHerhalend = true;
      } else {
        beschikbaar += STANDAARD_UUR_PER_DAG;
      }
      if (standbyEntry) standbyDagen++;
    });
    return { beschikbaar, verlofDagen, standbyDagen, totaalWerkdagen: werkdagen.length, heeftVerlofNietHerhalend };
  }

  function berekenMedewerker(medewerker, periodeStart, periodeEind, alleWerkitems, alleVerlof) {
    const { beschikbaar, verlofDagen, standbyDagen, totaalWerkdagen, heeftVerlofNietHerhalend } =
      medewerkerBeschikbaarInPeriode(medewerker, periodeStart, periodeEind, alleVerlof);
    const relevanteItems = alleWerkitems.filter(w => w.medewerkerIds.includes(medewerker.id));
    const perType = { operatie: 0, valuestream: 0, project: 0 };
    const werkitemDetails = [];
    let gepland = 0;

    relevanteItems.forEach(item => {
      const uren = werkitemUrenVoorMedewerker(item, medewerker.id, periodeStart, periodeEind);
      gepland += uren;
      perType[item.type] = (perType[item.type] || 0) + uren;
      if (uren > 0) {
        werkitemDetails.push({ id: item.id, titel: item.titel, type: item.type, status: item.status, uren });
      }
    });
    werkitemDetails.sort((a, b) => b.uren - a.uren);

    const ratio = beschikbaar > 0 ? gepland / beschikbaar : (gepland > 0 ? 2 : 0);
    // Iemand die de hele periode op verlof is, is niet "onderbenut" - er is simpelweg geen capaciteit.
    const opVerlof = totaalWerkdagen > 0 && verlofDagen === totaalWerkdagen;
    const onderbenut = !opVerlof && isOnderbenut(ratio);
    const status = statusVoorRatio(ratio);

    return {
      medewerker, beschikbaar, gepland, verlofDagen, standbyDagen, totaalWerkdagen, perType, werkitemDetails, ratio, status,
      onderbenut, opVerlof, overbelastMetVerlof: status === 'rood' && heeftVerlofNietHerhalend
    };
  }

  function berekenAlleMedewerkers(periodeStart, periodeEind, medewerkers, werkitems, verlof) {
    return medewerkers.map(m => berekenMedewerker(m, periodeStart, periodeEind, werkitems, verlof));
  }

  // opFunctie=true groepeert op team + rol i.p.v. alleen team
  function berekenPerGroep(resultatenPerMedewerker, opFunctie) {
    const groepen = {};
    resultatenPerMedewerker.forEach(r => {
      const team = r.medewerker.team || 'Onbekend';
      const rol = r.medewerker.rol || 'Onbekend';
      const key = opFunctie ? team + ' — ' + rol : team;
      if (!groepen[key]) groepen[key] = { team, rol: opFunctie ? rol : null, beschikbaar: 0, gepland: 0, medewerkers: [] };
      groepen[key].beschikbaar += r.beschikbaar;
      groepen[key].gepland += r.gepland;
      groepen[key].medewerkers.push(r);
    });
    return Object.values(groepen).map(t => {
      const ratio = t.beschikbaar > 0 ? t.gepland / t.beschikbaar : (t.gepland > 0 ? 2 : 0);
      return Object.assign(t, { ratio, status: statusVoorRatio(ratio) });
    });
  }

  function berekenPerTeam(resultatenPerMedewerker) {
    return berekenPerGroep(resultatenPerMedewerker, false);
  }

  // Aanwezigheid op één dag t.o.v. de minimale bezetting (totaal en per rol) uit Instellingen.
  // Gedeeld door Dashboard (Bezetting) en Verlofplanning (drempel-waarschuwing bij invoeren/goedkeuren).
  function bezettingVoorDag(dag, medewerkers, verlof, instellingen) {
    const iso = App.datum.naarIso(dag);
    let aanwezig = 0;
    const perRol = {};
    medewerkers.forEach(m => {
      const rol = m.rol || 'Onbekend';
      if (!perRol[rol]) perRol[rol] = { aanwezig: 0, totaal: 0 };
      perRol[rol].totaal++;
      const entries = verlof.filter(v => v.medewerkerId === m.id && v.datum === iso);
      const heleDagAfwezig = entries.some(v => (v.type === 'afwezig' || v.type === 'anders') && (!v.dagdeel || v.dagdeel === 'hele-dag'));
      if (!heleDagAfwezig) { aanwezig++; perRol[rol].aanwezig++; }
    });
    const rolDrempelOverschreden = Object.entries(perRol).some(([rol, v]) =>
      (instellingen.minimaleBezettingPerRol[rol] || 0) > 0 && v.aanwezig < instellingen.minimaleBezettingPerRol[rol]);
    const onderMinimum = aanwezig < instellingen.minimaleBezetting || rolDrempelOverschreden;
    return { aanwezig, perRol, onderMinimum };
  }

  return {
    STANDAARD_UUR_PER_DAG, statusVoorRatio, isOnderbenut, werkitemUrenInPeriode, werkitemUrenVoorMedewerker,
    verdeelGelijkOverWeken, medewerkerBeschikbaarInPeriode, berekenMedewerker, berekenAlleMedewerkers,
    berekenPerGroep, berekenPerTeam, bezettingVoorDag
  };
})();
