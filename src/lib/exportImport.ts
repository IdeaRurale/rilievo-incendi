import {
  db,
  DEFAULT_CLASSI,
  esitoLabel,
  UNITA_TIPI,
  type Classe,
  type ClasseConfig,
  type Foto,
  type Pianta,
  type Pratica,
  type Stima,
  type Unita
} from '../db';
import { esitoEffettivo } from './stats';

/** Su iPhone apre il foglio di condivisione (AirDrop, Mail, File…); altrove scarica il file. */
async function condividiOScarica(file: File, titolo?: string): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // annullato dall'utente
      // altrimenti prosegue col download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

interface FotoExport extends Omit<Foto, 'blob' | 'id'> {
  id?: number;
  base64: string;
  mime: string;
}

export interface PraticaExport {
  formato: 'rilievo-incendi';
  versione: 1 | 2;
  esportataIl: string;
  pratica: Pratica;
  unita: Unita[];
  piante: Pianta[];
  foto: FotoExport[];
  stima?: Stima;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function esportaPratica(praticaId: number): Promise<void> {
  const pratica = await db.pratiche.get(praticaId);
  if (!pratica) throw new Error('Pratica non trovata');
  const [unita, piante, fotoRaw, stima] = await Promise.all([
    db.unita.where('praticaId').equals(praticaId).toArray(),
    db.piante.where('praticaId').equals(praticaId).toArray(),
    db.foto.where('praticaId').equals(praticaId).toArray(),
    db.stime.get(praticaId)
  ]);
  const foto: FotoExport[] = [];
  for (const f of fotoRaw) {
    const { blob, ...meta } = f;
    foto.push({ ...meta, base64: await blobToBase64(blob), mime: blob.type || 'image/jpeg' });
  }
  const dati: PraticaExport = {
    formato: 'rilievo-incendi',
    versione: 2,
    esportataIl: new Date().toISOString(),
    pratica,
    unita,
    piante,
    foto,
    stima
  };
  const nome = `rilievo-${(pratica.titolo || 'pratica').replace(/[^\w\-]+/g, '_')}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  const file = new File([JSON.stringify(dati)], nome, { type: 'application/json' });
  await condividiOScarica(file, pratica.titolo);
}

/** Censimento in CSV apribile con Excel italiano (separatore ; e virgola decimale). */
export async function scaricaCsv(praticaId: number): Promise<void> {
  const pratica = await db.pratiche.get(praticaId);
  if (!pratica) throw new Error('Pratica non trovata');
  const classi =
    ((await db.settings.get('classi'))?.value as ClasseConfig[] | undefined) ?? DEFAULT_CLASSI;
  const [unitaList, piante] = await Promise.all([
    db.unita.where('praticaId').equals(praticaId).toArray(),
    db.piante.where('praticaId').equals(praticaId).toArray()
  ]);
  const unitaById = new Map(unitaList.map((u) => [u.id!, u]));
  const tipoLabel = (u?: Unita) => UNITA_TIPI.find((t) => t.value === u?.tipo)?.label ?? '';
  const dec = (n?: number, cifre = 6) => (n === undefined ? '' : n.toFixed(cifre).replace('.', ','));

  const righe: string[][] = [
    [
      'Pratica', 'Unità', 'Tipo unità', 'Specie', 'N. pianta', 'Classe', 'Danno %',
      'Esito tecnico', 'Conteggio', 'Latitudine', 'Longitudine', 'Precisione (m)',
      'Data', 'Ora', 'Chioma', 'Fogliame', 'Fusto', 'Colletto', 'Recupero', 'Note'
    ]
  ];

  for (const p of [...piante].sort((a, b) => a.unitaId - b.unitaId || a.numero - b.numero)) {
    const u = unitaById.get(p.unitaId);
    const cfg = classi[p.classe];
    const d = new Date(p.ts);
    righe.push([
      pratica.titolo, u?.nome ?? '', tipoLabel(u), u?.specie ?? '', String(p.numero),
      cfg.nome, `${cfg.pctMin}–${cfg.pctMax}%`, esitoLabel(esitoEffettivo(p, classi)), '1',
      dec(p.lat), dec(p.lng), p.accuracy !== undefined ? String(p.accuracy) : '',
      d.toLocaleDateString('it-IT'), d.toLocaleTimeString('it-IT'),
      p.dettaglio?.chioma ?? '', p.dettaglio?.fogliame ?? '', p.dettaglio?.fusto ?? '',
      p.dettaglio?.colletto ?? '', p.dettaglio?.recupero ?? '', p.note ?? ''
    ]);
  }

  // gruppi: una riga per classe con il conteggio aggregato
  for (const u of unitaList) {
    if (u.tipo === 'gruppo' && u.conteggi) {
      for (const c of [0, 1, 2, 3, 4] as Classe[]) {
        const n = u.conteggi[c] || 0;
        if (n === 0) continue;
        const cfg = classi[c];
        righe.push([
          pratica.titolo, u.nome, tipoLabel(u), u.specie ?? '', '', cfg.nome,
          `${cfg.pctMin}–${cfg.pctMax}%`, esitoLabel(cfg.esitoDefault), String(n),
          '', '', '', '', '', '', '', '', '', '', u.note ?? ''
        ]);
      }
    }
  }

  const esc = (v: string) => (/[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  // BOM UTF-8: fa riconoscere correttamente gli accenti a Excel
  const csv = String.fromCharCode(0xfeff) + righe.map((r) => r.map(esc).join(';')).join('\r\n');
  const nome = `censimento-${(pratica.titolo || 'pratica').replace(/[^\w\-]+/g, '_')}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  await condividiOScarica(new File([csv], nome, { type: 'text/csv' }), pratica.titolo);
}

/** Importa una pratica esportata. Restituisce l'id della nuova pratica. */
export async function importaPratica(file: File): Promise<number> {
  const testo = await file.text();
  let dati: PraticaExport;
  try {
    dati = JSON.parse(testo);
  } catch {
    throw new Error('Il file non è un JSON valido.');
  }
  if (dati.formato !== 'rilievo-incendi' || (dati.versione !== 1 && dati.versione !== 2)) {
    throw new Error('Il file non è un rilievo esportato da questa app.');
  }

  return db.transaction('rw', [db.pratiche, db.unita, db.piante, db.foto, db.stime], async () => {
    const { id: _pid, ...pratica } = dati.pratica;
    const nuovaPraticaId = (await db.pratiche.add({ ...pratica, createdAt: Date.now() })) as number;

    const mappaUnita = new Map<number, number>();
    for (const u of dati.unita) {
      const { id: vecchioId, ...resto } = u;
      const nuovoId = (await db.unita.add({ ...resto, praticaId: nuovaPraticaId })) as number;
      if (vecchioId !== undefined) mappaUnita.set(vecchioId, nuovoId);
    }

    const mappaPiante = new Map<number, number>();
    for (const p of dati.piante) {
      const { id: vecchioId, ...resto } = p;
      const nuovoId = (await db.piante.add({
        ...resto,
        praticaId: nuovaPraticaId,
        unitaId: mappaUnita.get(p.unitaId) ?? p.unitaId
      })) as number;
      if (vecchioId !== undefined) mappaPiante.set(vecchioId, nuovoId);
    }

    for (const f of dati.foto) {
      const { id: _fid, base64, mime, ...meta } = f;
      await db.foto.add({
        ...meta,
        praticaId: nuovaPraticaId,
        unitaId: meta.unitaId !== undefined ? mappaUnita.get(meta.unitaId) ?? meta.unitaId : undefined,
        piantaId: meta.piantaId !== undefined ? mappaPiante.get(meta.piantaId) ?? meta.piantaId : undefined,
        blob: base64ToBlob(base64, mime)
      });
    }

    if (dati.stima) {
      await db.stime.put({ ...dati.stima, praticaId: nuovaPraticaId });
    }

    return nuovaPraticaId;
  });
}
