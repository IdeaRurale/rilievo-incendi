import type { CostiUnitari, Stima, VoceDanno } from '../db';
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
