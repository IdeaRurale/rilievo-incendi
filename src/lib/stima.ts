import { DEFAULT_ESTIMO_RURALE } from '../db';
import type { CostiUnitari, EstimoRuraleInput, Stima, VoceDanno } from '../db';
import type { Stats } from './stats';
import { fmtEuro } from './stats';

export interface RigaCalcolo {
  voce: string;
  quantita: number;
  unitaMisura: string;
  prezzoUnitario: number;
  totale: number;
  formula: string;
}

export interface CalcoloStima {
  righeRimozione: RigaCalcolo[];
  righeImpianto: RigaCalcolo[];
  righeRecupero: RigaCalcolo[];
  righeMonitoraggio: RigaCalcolo[];
  righeMancataFunzione: { descrizione: string; importo: number; formula: string }[];
  righeAltriDanni: { descrizione: string; importo: number; formula: string }[];
  totRimozione: number;
  totImpianto: number;
  totRecupero: number;
  totMonitoraggio: number;
  totMancataFunzione: number;
  totAltriDanni: number;
  totaleGenerale: number;
}

function riga(voce: string, q: number, um: string, p: number): RigaCalcolo {
  return { voce, quantita: q, unitaMisura: um, prezzoUnitario: p, totale: q * p, formula: `${q} ${um} × ${fmtEuro(p)} = ${fmtEuro(q * p)}` };
}

export function calcolaStima(stats: Stats, stima: Stima): CalcoloStima {
  const c: CostiUnitari = stima.costi;
  const nSost = stats.daSostituire;
  const nRec = stats.daMonitorare; // "da recuperare" mappa su daMonitorare
  // piante lievi/medie non distrutte e non già in daSostituire: recupero potatura
  const nPotatura = Math.max(0, stats.danneggiate - nSost);

  const righeRimozione: RigaCalcolo[] = nSost > 0 ? [
    riga('Rimozione pianta danneggiata', nSost, 'pz', c.rimozione),
    riga('Smaltimento residui vegetali', nSost, 'pz', c.smaltimento)
  ] : [];

  const righeImpianto: RigaCalcolo[] = nSost > 0 ? [
    riga('Pianta nuova (vivaio)', nSost, 'pz', c.piantaNuova),
    riga('Preparazione terreno', nSost, 'pz', c.preparazioneTerreno),
    riga('Messa a dimora', nSost, 'pz', c.messaDimora),
    ...(c.tutore > 0 ? [riga('Tutore', nSost, 'pz', c.tutore)] : []),
    ...(c.irrigazione > 0 ? [riga('Irrigazione iniziale', nSost, 'pz', c.irrigazione)] : [])
  ] : [];

  const righeRecupero: RigaCalcolo[] = [];
  if (nPotatura > 0 && c.potaturaRecupero > 0)
    righeRecupero.push(riga('Potatura di recupero', nPotatura, 'pz', c.potaturaRecupero));
  if (nRec > 0 && c.cureColturali > 0)
    righeRecupero.push(riga('Cure colturali', nRec, 'pz', c.cureColturali));

  const righeMonitoraggio: RigaCalcolo[] = nRec > 0 && c.monitoraggio > 0
    ? [riga('Monitoraggio', nRec, 'pz', c.monitoraggio)]
    : [];

  const somma = (rr: RigaCalcolo[]) => rr.reduce((s, r) => s + r.totale, 0);

  const righeMancataFunzione = calcolaVoci(stima.mancataFunzione);
  const righeAltriDanni = calcolaVoci(stima.altriDanni);

  const totRimozione = somma(righeRimozione);
  const totImpianto = somma(righeImpianto);
  const totRecupero = somma(righeRecupero);
  const totMonitoraggio = somma(righeMonitoraggio);
  const totMancataFunzione = righeMancataFunzione.reduce((s, r) => s + r.importo, 0);
  const totAltriDanni = righeAltriDanni.reduce((s, r) => s + r.importo, 0);

  return {
    righeRimozione, righeImpianto, righeRecupero, righeMonitoraggio,
    righeMancataFunzione, righeAltriDanni,
    totRimozione, totImpianto, totRecupero, totMonitoraggio,
    totMancataFunzione, totAltriDanni,
    totaleGenerale: totRimozione + totImpianto + totRecupero + totMonitoraggio + totMancataFunzione + totAltriDanni
  };
}

function calcolaVoci(voci: VoceDanno[]): { descrizione: string; importo: number; formula: string }[] {
  return voci.filter(v => v.descrizione).map(v => {
    const importo = v.tipo === 'annuo' ? v.valore * (v.anni ?? 1) : v.valore;
    const formula = v.tipo === 'annuo'
      ? `${fmtEuro(v.valore)}/anno × ${v.anni ?? 1} anni = ${fmtEuro(importo)}`
      : `Importo a corpo: ${fmtEuro(importo)}`;
    return { descrizione: v.descrizione, importo, formula };
  });
}

export interface RigaEstimo {
  voce: string;
  formula: string;
  importo: number;
}

export interface RigaTariffa {
  descrizione: string;
  quota: number;
  aliquota: number;
  importo: number;
}

export interface CalcoloEstimoRurale {
  input: EstimoRuraleInput;
  quotaRecupero: number;
  quotaReimpianto: number;
  superficieRecuperoHa: number;
  superficieReimpiantoHa: number;
  righePatrimoniali: RigaEstimo[];
  righeReddituali: RigaEstimo[];
  righeFunzione: RigaEstimo[];
  righeTariffa: RigaTariffa[];
  valoreSoprassuolo: number;
  valoreFruttiPendenti: number;
  speseRipristino: number;
  danniFunzionePatrimoniali: number;
  danniFunzioneReddituali: number;
  mancatiRedditiRecupero: number;
  mancatiRedditiReimpiantoImproduttivo: number;
  mancatiRedditiReimpiantoCrescente: number;
  dannoEmergente: number;
  lucroCessante: number;
  dannoTotale: number;
  onorarioBase: number;
  maggiorazioneContraddittorio: number;
  maggiorazioneGiurata: number;
  onorarioTotale: number;
}

export function getEstimoRurale(stima: Stima): EstimoRuraleInput {
  return {
    ...DEFAULT_ESTIMO_RURALE,
    ...(stima.estimo ?? {}),
    danniPaesaggistici:
      stima.estimo?.danniPaesaggistici ?? DEFAULT_ESTIMO_RURALE.danniPaesaggistici
  };
}

export function calcolaEstimoRurale(stats: Stats, stima: Stima): CalcoloEstimoRurale {
  const e = getEstimoRurale(stima);
  const superficie = nonNeg(e.superficieHa);
  const livelloDanno = clamp01(e.livelloDanno);
  const saggio = Math.max(0, e.saggioSconto);
  const quotaDaRilievo = stats.censite > 0;
  const quotaReimpianto = clamp01(
    e.usaRipartoRilievo && quotaDaRilievo ? stats.daSostituire / stats.censite : e.quotaReimpianto
  );
  const quotaRecupero = clamp01(
    e.usaRipartoRilievo && quotaDaRilievo
      ? Math.max(0, stats.danneggiate - stats.daSostituire) / stats.censite
      : e.quotaRecupero
  );
  const superficieReimpiantoHa = superficie * quotaReimpianto;
  const superficieRecuperoHa = superficie * quotaRecupero;

  const valoreSoprassuolo = Math.max(0, (e.valoreMercatoHa - e.valoreTerrenoNudoHa) * superficie * livelloDanno);
  const valoreFruttiPendenti = Math.max(
    0,
    (e.produzionePersaQHa * e.prezzoOliveQ - e.speseRisparmiateHa) * superficie
  );
  const speseRipristino = nonNeg(e.speseStraordinarie);

  const righeFunzione = calcolaVociAttualizzate(e.danniPaesaggistici, saggio);
  const danniFunzionePatrimoniali = righeFunzione
    .filter((r) => r.voce.startsWith('[Patrimoniale]'))
    .reduce((s, r) => s + r.importo, 0);
  const danniFunzioneReddituali = righeFunzione
    .filter((r) => r.voce.startsWith('[Reddituale]'))
    .reduce((s, r) => s + r.importo, 0);

  const redditoRecuperoPerso =
    e.redditoNettoAnnuoHa * superficieRecuperoHa * (nonNeg(e.riduzioneResaRecuperoPct) / 100);
  const mancatiRedditiRecupero = attualizzaRata(redditoRecuperoPerso, e.anniRipresaRecupero, saggio, 1);

  const redditoReimpiantoPerso = e.redditoNettoAnnuoHa * superficieReimpiantoHa;
  const mancatiRedditiReimpiantoImproduttivo = attualizzaRata(
    redditoReimpiantoPerso,
    e.anniImproduttivitaNuove,
    saggio,
    1
  );
  const mancatiRedditiReimpiantoCrescente = attualizzaCrescitaLineare(
    redditoReimpiantoPerso,
    e.anniProduttivitaCrescenteNuove,
    saggio,
    e.anniImproduttivitaNuove + 1
  );

  const righePatrimoniali: RigaEstimo[] = [
    {
      voce: 'Valore soprassuolo olivicolo',
      formula: `(${fmtEuro(e.valoreMercatoHa)}/ha - ${fmtEuro(e.valoreTerrenoNudoHa)}/ha) x ${fmtNum(superficie)} ha x ${fmtPct(livelloDanno)}`,
      importo: valoreSoprassuolo
    },
    {
      voce: 'Frutti pendenti',
      formula: `((${fmtNum(e.produzionePersaQHa)} q/ha x ${fmtEuro(e.prezzoOliveQ)}/q) - ${fmtEuro(e.speseRisparmiateHa)}/ha) x ${fmtNum(superficie)} ha`,
      importo: valoreFruttiPendenti
    },
    {
      voce: 'Spese straordinarie di ripristino',
      formula: 'Sgombero resti, potature di riforma, scavi e reimpianto',
      importo: speseRipristino
    },
    ...righeFunzione.filter((r) => r.voce.startsWith('[Patrimoniale]'))
  ].filter((r) => r.importo > 0);

  const righeReddituali: RigaEstimo[] = [
    {
      voce: 'Mancati redditi piante in recupero',
      formula: `${fmtEuro(redditoRecuperoPerso)}/anno x ${int(e.anniRipresaRecupero)} anni attualizzati al ${fmtPct(saggio)}`,
      importo: mancatiRedditiRecupero
    },
    {
      voce: 'Reimpianti: improduttivita totale',
      formula: `${fmtEuro(redditoReimpiantoPerso)}/anno x ${int(e.anniImproduttivitaNuove)} anni attualizzati al ${fmtPct(saggio)}`,
      importo: mancatiRedditiReimpiantoImproduttivo
    },
    {
      voce: 'Reimpianti: produttivita crescente',
      formula: `Perdita decrescente lineare per ${int(e.anniProduttivitaCrescenteNuove)} anni, attualizzata al ${fmtPct(saggio)}`,
      importo: mancatiRedditiReimpiantoCrescente
    },
    ...righeFunzione.filter((r) => r.voce.startsWith('[Reddituale]'))
  ].filter((r) => r.importo > 0);

  const dannoEmergente =
    valoreSoprassuolo + valoreFruttiPendenti + speseRipristino + danniFunzionePatrimoniali;
  const lucroCessante =
    mancatiRedditiRecupero +
    mancatiRedditiReimpiantoImproduttivo +
    mancatiRedditiReimpiantoCrescente +
    danniFunzioneReddituali;
  const dannoTotale = dannoEmergente + lucroCessante;

  const { righeTariffa, onorarioBase } = calcolaTariffaIncendio(dannoTotale);
  const maggiorazioneContraddittorio = e.contraddittorio ? onorarioBase * 0.3 : 0;
  const maggiorazioneGiurata = e.periziaGiurata ? onorarioBase * 0.1 : 0;

  return {
    input: e,
    quotaRecupero,
    quotaReimpianto,
    superficieRecuperoHa,
    superficieReimpiantoHa,
    righePatrimoniali,
    righeReddituali,
    righeFunzione,
    righeTariffa,
    valoreSoprassuolo,
    valoreFruttiPendenti,
    speseRipristino,
    danniFunzionePatrimoniali,
    danniFunzioneReddituali,
    mancatiRedditiRecupero,
    mancatiRedditiReimpiantoImproduttivo,
    mancatiRedditiReimpiantoCrescente,
    dannoEmergente,
    lucroCessante,
    dannoTotale,
    onorarioBase,
    maggiorazioneContraddittorio,
    maggiorazioneGiurata,
    onorarioTotale: onorarioBase + maggiorazioneContraddittorio + maggiorazioneGiurata
  };
}

export function calcolaTariffaIncendio(valore: number): { righeTariffa: RigaTariffa[]; onorarioBase: number } {
  const scaglioni = [
    { limite: 2582.28, aliquota: 0.04 },
    { limite: 3873.43, aliquota: 0.0335 },
    { limite: 7746.85, aliquota: 0.0275 },
    { limite: 15493.71, aliquota: 0.022 },
    { limite: Number.POSITIVE_INFINITY, aliquota: 0.0165 }
  ];
  const righeTariffa: RigaTariffa[] = [];
  let precedente = 0;
  for (const scaglione of scaglioni) {
    if (valore <= precedente) break;
    const quota = Math.max(0, Math.min(valore, scaglione.limite) - precedente);
    if (quota > 0) {
      righeTariffa.push({
        descrizione: scaglione.limite === Number.POSITIVE_INFINITY
          ? `Eccedenza oltre ${fmtEuro(precedente)}`
          : `Quota fino a ${fmtEuro(scaglione.limite)}`,
        quota,
        aliquota: scaglione.aliquota,
        importo: quota * scaglione.aliquota
      });
    }
    precedente = scaglione.limite;
  }
  return {
    righeTariffa,
    onorarioBase: righeTariffa.reduce((s, r) => s + r.importo, 0)
  };
}

function calcolaVociAttualizzate(voci: VoceDanno[], saggio: number): RigaEstimo[] {
  return voci.filter((v) => v.descrizione && v.valore > 0).map((v) => {
    if (v.tipo === 'annuo') {
      const anni = int(v.anni ?? 1);
      const importo = attualizzaRata(v.valore, anni, saggio, 1);
      return {
        voce: `[Reddituale] ${v.descrizione}`,
        formula: `${fmtEuro(v.valore)}/anno x ${anni} anni attualizzati al ${fmtPct(saggio)}`,
        importo
      };
    }
    return {
      voce: `[Patrimoniale] ${v.descrizione}`,
      formula: `Importo a corpo: ${fmtEuro(v.valore)}`,
      importo: v.valore
    };
  });
}

function attualizzaRata(importoAnnuo: number, anni: number, saggio: number, primoAnno: number): number {
  let totale = 0;
  for (let i = 0; i < int(anni); i++) {
    totale += importoAnnuo / Math.pow(1 + saggio, primoAnno + i);
  }
  return totale;
}

function attualizzaCrescitaLineare(importoAnnuo: number, anni: number, saggio: number, primoAnno: number): number {
  const n = int(anni);
  if (n <= 0) return 0;
  let totale = 0;
  for (let i = 1; i <= n; i++) {
    const quotaPerdita = Math.max(0, (n - i) / n);
    totale += (importoAnnuo * quotaPerdita) / Math.pow(1 + saggio, primoAnno + i - 1);
  }
  return totale;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function nonNeg(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function int(n: number): number {
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
}

function fmtNum(n: number): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  return `${(n * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`;
}
