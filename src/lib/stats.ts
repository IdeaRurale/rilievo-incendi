import type { Classe, ClasseConfig, Esito, Pianta, Unita } from '../db';
import { emptyConteggi } from '../db';

export interface Stats {
  teoriche: number;
  censite: number;
  mancanti: number;
  perClasse: Record<Classe, number>;
  sane: number;
  danneggiate: number;
  distrutte: number;
  gravi: number;
  daMonitorare: number;
  daSostituire: number;
  pctDanneggiate: number;
  pctGravi: number;
  pctDistrutte: number;
  pctSostituire: number;
  dannoMedio: number; // % media pesata sui punti medi degli intervalli di classe
}

function pct(n: number, tot: number): number {
  return tot > 0 ? Math.round((n / tot) * 1000) / 10 : 0;
}

export function esitoEffettivo(p: Pianta, classi: ClasseConfig[]): Esito {
  return p.esito ?? classi[p.classe].esitoDefault;
}

/** Statistiche per un insieme di unità con le relative piante censite. */
export function computeStats(
  unitaList: Unita[],
  piante: Pianta[],
  classi: ClasseConfig[]
): Stats {
  const perClasse = emptyConteggi();
  let daMonitorare = 0;
  let daSostituire = 0;
  let teoriche = 0;

  for (const u of unitaList) {
    if (u.tipo === 'gruppo' && u.conteggi) {
      let tot = 0;
      for (const c of [0, 1, 2, 3, 4] as Classe[]) {
        const n = u.conteggi[c] || 0;
        perClasse[c] += n;
        tot += n;
        const esito = classi[c].esitoDefault;
        if (esito === 'monitoraggio') daMonitorare += n;
        if (esito === 'sostituzione') daSostituire += n;
      }
      teoriche += u.numeroTeorico || tot;
    } else {
      teoriche += u.numeroTeorico || 0;
    }
  }

  for (const p of piante) {
    perClasse[p.classe]++;
    const esito = esitoEffettivo(p, classi);
    if (esito === 'monitoraggio') daMonitorare++;
    if (esito === 'sostituzione') daSostituire++;
  }

  const censite = perClasse[0] + perClasse[1] + perClasse[2] + perClasse[3] + perClasse[4];
  const danneggiate = censite - perClasse[0];

  let sommaDanno = 0;
  for (const c of [0, 1, 2, 3, 4] as Classe[]) {
    const mid = (classi[c].pctMin + classi[c].pctMax) / 2;
    sommaDanno += perClasse[c] * mid;
  }

  return {
    teoriche,
    censite,
    mancanti: Math.max(0, teoriche - censite),
    perClasse,
    sane: perClasse[0],
    danneggiate,
    distrutte: perClasse[4],
    gravi: perClasse[3],
    daMonitorare,
    daSostituire,
    pctDanneggiate: pct(danneggiate, censite),
    pctGravi: pct(perClasse[3], censite),
    pctDistrutte: pct(perClasse[4], censite),
    pctSostituire: pct(daSostituire, censite),
    dannoMedio: censite > 0 ? Math.round(sommaDanno / censite) : 0
  };
}

export interface Segmento {
  da: number;
  a: number;
  classe: Classe | null; // null = non censita
}

/** Rappresentazione lineare (siepe/filare): tratti consecutivi con la stessa classe. */
export function computeSegmenti(piante: Pianta[], teorico: number): Segmento[] {
  const byNumero = new Map<number, Classe>();
  let maxN = teorico;
  for (const p of piante) {
    byNumero.set(p.numero, p.classe);
    if (p.numero > maxN) maxN = p.numero;
  }
  const segs: Segmento[] = [];
  for (let n = 1; n <= maxN; n++) {
    const c = byNumero.has(n) ? byNumero.get(n)! : null;
    const last = segs[segs.length - 1];
    if (last && last.classe === c && last.a === n - 1) last.a = n;
    else segs.push({ da: n, a: n, classe: c });
  }
  return segs;
}

export function fmtEuro(n: number): string {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
