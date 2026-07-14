// Datamodellen + repository-laag (CRUD bovenop App.storage).
// Employee:   { id, naam, team, rol, standbyDienst } - beschikbaarheid gaat uit van een vaste standaard (zie capacity.js);
//             standbyDienst geeft aan of deze medewerker meedoet in de standby-rooster (zie standby.js)
// LeaveEntry: { id, medewerkerId, datum, type: 'afwezig'|'standby'|'anders'|'verzoek', dagdeel: 'hele-dag'|'ochtend'|'middag', opmerking, herhalend }
// WorkItem:   { id, titel, type: 'operatie'|'valuestream'|'project'|'changes',
//               startDatum, eindDatum, medewerkerIds[], team,
//               applicatie, waardestroom, status, opmerking,
//               afhankelijkVan: [werkitemId] (alleen relevant voor type 'project'),
//               oorspronkelijkeStartDatum, oorspronkelijkeEindDatum (snapshot bij aanmaken, ongebruikt buiten dit veld),
//               aanpassingen: [{ vanStart, vanEind, naarStart, naarEind, datum, reden }] (één los record per
//               doorschuiving, voor 'Aangepaste planningen' — behoudt de volledige historie i.p.v. alleen de laatste),
//               weekUren: { [weekKey]: { [medewerkerId]: uren } } (verplichte weekplanning) }
// Gebruiker:  { id, gebruikersnaam, wachtwoord, rol: 'teamlead'|'projectmanager'|'teammember'|'viewer', medewerkerId }
// StandbyDienst: { id, weekKey, medewerkerId, verlofIds[] } - één standby-week; verlofIds verwijst naar de
//                gegenereerde LeaveEntry's (type 'standby') zodat Verlofplanning in sync blijft (zie standby.js)
// StandbyVerzoek: { id, type: 'overdracht'|'ruil', dienstId, ruilDienstId (alleen bij 'ruil'),
//                   vanMedewerkerId, naarMedewerkerId, status: 'open'|'goedgekeurd'|'afgewezen' }
window.App = window.App || {};

App.model = (function () {
  const WERK_TYPES = ['operatie', 'valuestream', 'project', 'changes'];
  const VERLOF_TYPES = ['afwezig', 'standby', 'anders', 'verzoek'];
  const DAGDELEN = ['hele-dag', 'ochtend', 'middag'];
  const STATUSSEN = ['gepland', 'lopend', 'afgerond', 'geannuleerd'];
  const ROLLEN = ['teamlead', 'projectmanager', 'teammember', 'viewer'];
  const ROL_LABEL = { teamlead: 'Admin', projectmanager: 'Teammember', teammember: 'Teammember', viewer: 'Viewer' };

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function nieuweMedewerker(overrides) {
    return Object.assign({
      id: uid(), naam: '', team: '', rol: '', standbyDienst: false
    }, overrides);
  }

  function nieuwVerlof(overrides) {
    return Object.assign({
      id: uid(), medewerkerId: '', datum: '', type: 'afwezig', dagdeel: 'hele-dag', opmerking: '', herhalend: false
    }, overrides);
  }

  function nieuwWerkitem(overrides) {
    const basis = {
      id: uid(), titel: '', type: 'project', startDatum: '', eindDatum: '',
      medewerkerIds: [], team: '', applicatie: '',
      waardestroom: '', status: 'gepland', opmerking: '', weekUren: {}, afhankelijkVan: [], aanpassingen: []
    };
    const item = Object.assign(basis, overrides);
    if (!item.oorspronkelijkeStartDatum) item.oorspronkelijkeStartDatum = item.startDatum;
    if (!item.oorspronkelijkeEindDatum) item.oorspronkelijkeEindDatum = item.eindDatum;
    return item;
  }

  function nieuweGebruiker(overrides) {
    return Object.assign({
      id: uid(), gebruikersnaam: '', wachtwoord: '', rol: 'teammember', medewerkerId: ''
    }, overrides);
  }

  function nieuweStandbyDienst(overrides) {
    return Object.assign({
      id: uid(), weekKey: '', medewerkerId: '', verlofIds: []
    }, overrides);
  }

  function nieuwStandbyVerzoek(overrides) {
    return Object.assign({
      id: uid(), type: 'overdracht', dienstId: '', ruilDienstId: null,
      vanMedewerkerId: '', naarMedewerkerId: '', status: 'open'
    }, overrides);
  }

  return {
    WERK_TYPES, VERLOF_TYPES, DAGDELEN, STATUSSEN, ROLLEN, ROL_LABEL,
    uid, nieuweMedewerker, nieuwVerlof, nieuwWerkitem, nieuweGebruiker,
    nieuweStandbyDienst, nieuwStandbyVerzoek
  };
})();

App.data = (function () {
  function medewerkers() { return App.storage.laad('medewerkers', []); }
  function bewaarMedewerkers(lijst) { App.storage.bewaar('medewerkers', lijst); }

  function verlof() { return App.storage.laad('verlof', []); }
  function bewaarVerlof(lijst) { App.storage.bewaar('verlof', lijst); }

  function werkitems() { return App.storage.laad('werkitems', []); }
  function bewaarWerkitems(lijst) { App.storage.bewaar('werkitems', lijst); }

  function gebruikers() { return App.storage.laad('gebruikers', []); }
  function bewaarGebruikers(lijst) { App.storage.bewaar('gebruikers', lijst); }

  function standbyDiensten() { return App.storage.laad('standbyDiensten', []); }
  function bewaarStandbyDiensten(lijst) { App.storage.bewaar('standbyDiensten', lijst); }

  function standbyVerzoeken() { return App.storage.laad('standbyVerzoeken', []); }
  function bewaarStandbyVerzoeken(lijst) { App.storage.bewaar('standbyVerzoeken', lijst); }

  function upsert(lijst, item) {
    const idx = lijst.findIndex(x => x.id === item.id);
    if (idx >= 0) lijst[idx] = item; else lijst.push(item);
    return lijst;
  }

  function verwijder(lijst, id) {
    return lijst.filter(x => x.id !== id);
  }

  function goedkeurenVerzoek(ids) {
    const lijst = verlof();
    lijst.forEach(v => { if (ids.includes(v.id)) v.type = 'afwezig'; });
    bewaarVerlof(lijst);
  }

  return {
    medewerkers, bewaarMedewerkers,
    verlof, bewaarVerlof,
    werkitems, bewaarWerkitems,
    gebruikers, bewaarGebruikers,
    standbyDiensten, bewaarStandbyDiensten,
    standbyVerzoeken, bewaarStandbyVerzoeken,
    upsert, verwijder, goedkeurenVerzoek
  };
})();

App.seed = function seedData() {
  if (App.storage.isGeinitialiseerd()) return;

  const rollen = {
    Boudewijn: 'Teamlead', Jari: 'Developer', Jesse: 'Developer', Laurens: 'Developer',
    Wesley: 'Systeembeheerder', Erwin: 'Systeembeheerder', Niels: 'Developer',
    Rick: 'Systeembeheerder', Wim: 'Functioneel beheerder', Roelof: 'Functioneel beheerder'
  };
  const medewerkers = Object.keys(rollen).map(naam => App.model.nieuweMedewerker({ naam, team: 'BT', rol: rollen[naam] }));
  const idVan = naam => medewerkers.find(m => m.naam === naam).id;

  const verlof = [
    App.model.nieuwVerlof({ medewerkerId: idVan('Boudewijn'), datum: '2025-12-29', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Jesse'), datum: '2025-12-29', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Laurens'), datum: '2025-12-29', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Wesley'), datum: '2025-12-29', type: 'standby' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Niels'), datum: '2025-12-29', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Boudewijn'), datum: '2025-12-30', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Jesse'), datum: '2025-12-30', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Laurens'), datum: '2025-12-30', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Niels'), datum: '2025-12-30', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Boudewijn'), datum: '2026-01-05', type: 'afwezig' }),
    App.model.nieuwVerlof({ medewerkerId: idVan('Rick'), datum: '2026-01-05', type: 'standby' })
  ];

  const item1 = App.model.nieuwWerkitem({
    titel: 'Dagelijks applicatiebeheer', type: 'operatie', startDatum: '2025-12-01', eindDatum: '2026-03-31',
    medewerkerIds: [idVan('Erwin'), idVan('Wim')], team: 'BT', applicatie: 'Kassasysteem',
    waardestroom: 'Beheer', status: 'lopend', opmerking: 'Doorlopend beheer en kleine fixes'
  });
  const item2 = App.model.nieuwWerkitem({
    titel: 'Vernieuwing kassasysteem', type: 'project', startDatum: '2025-12-15', eindDatum: '2026-02-28',
    medewerkerIds: [idVan('Jari'), idVan('Jesse')], team: 'BT', applicatie: 'Kassasysteem',
    waardestroom: 'Winkelervaring', status: 'lopend', opmerking: ''
  });
  const item3 = App.model.nieuwWerkitem({
    titel: 'Voorraad-integratie webshop', type: 'valuestream', startDatum: '2026-01-05', eindDatum: '2026-03-15',
    medewerkerIds: [idVan('Laurens'), idVan('Niels')], team: 'BT', applicatie: 'Webshop',
    waardestroom: 'Voorraadbeheer', status: 'gepland', opmerking: ''
  });
  const item4 = App.model.nieuwWerkitem({
    titel: 'Koppeling webshop-kassasysteem', type: 'project', startDatum: '2026-03-01', eindDatum: '2026-04-15',
    medewerkerIds: [idVan('Jari')], team: 'BT', applicatie: 'Kassasysteem', waardestroom: 'Winkelervaring',
    status: 'gepland', opmerking: '', afhankelijkVan: [item2.id]
  });
  item1.weekUren = App.capacity.verdeelGelijkOverWeken(item1.startDatum, item1.eindDatum, item1.medewerkerIds, 400);
  item2.weekUren = App.capacity.verdeelGelijkOverWeken(item2.startDatum, item2.eindDatum, item2.medewerkerIds, 320);
  item3.weekUren = App.capacity.verdeelGelijkOverWeken(item3.startDatum, item3.eindDatum, item3.medewerkerIds, 250);
  item4.weekUren = App.capacity.verdeelGelijkOverWeken(item4.startDatum, item4.eindDatum, item4.medewerkerIds, 120);
  const werkitems = [item1, item2, item3, item4];

  App.data.bewaarMedewerkers(medewerkers);
  App.data.bewaarVerlof(verlof);
  App.data.bewaarWerkitems(werkitems);
  App.storage.markeerGeinitialiseerd();
};

// Los van App.seed (die alleen bij een lege installatie draait): zorgt dat er altijd
// standaard gebruikersaccounts bestaan, ook als medewerkers/verlof/werkitems al gevuld waren.
App.seedGebruikers = function seedGebruikers() {
  if (App.storage.laad('gebruikersGeinitialiseerd', false)) return;

  const medewerkers = App.data.medewerkers();
  const idVan = naam => { const m = medewerkers.find(x => x.naam === naam); return m ? m.id : ''; };

  const gebruikers = [
    App.model.nieuweGebruiker({ gebruikersnaam: 'Admin', wachtwoord: 'Admin', rol: 'teamlead', medewerkerId: idVan('Boudewijn') }),
    App.model.nieuweGebruiker({ gebruikersnaam: 'Teammember', wachtwoord: 'Teammember', rol: 'projectmanager', medewerkerId: idVan('Jari') }),
    App.model.nieuweGebruiker({ gebruikersnaam: 'Viewer', wachtwoord: 'Viewer', rol: 'viewer', medewerkerId: '' })
  ];

  App.data.bewaarGebruikers(gebruikers);
  App.storage.bewaar('gebruikersGeinitialiseerd', true);
};
