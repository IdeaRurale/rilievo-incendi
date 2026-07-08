import Dexie, { type EntityTable } from 'dexie';

export type Classe = 0 | 1 | 2 | 3 | 4;
export const CLASSI_CODICI: Classe[] = [0, 1, 2, 3, 4];

export type Esito =
  | 'nessuno'
  | 'monitoraggio'
  | 'cure'
  | 'potatura'
  | 'incerto'
  | 'decisione'
  | 'sostituzione';

export const ESITI: { value: Esito; label: string }[] = [
  { value: 'nessuno', label: 'Nessun intervento' },
  { value: 'monitoraggio', label: 'Monitoraggio' },
  { value: 'cure', label: 'Cure colturali' },
  { value: 'potatura', label: 'Potatura di recupero' },
  { value: 'incerto', label: 'Recupero incerto' },
  { value: 'decisione', label: 'Decisione tecnica' },
  { value: 'sostituzione', label: 'Sostituzione' }
];

export function esitoLabel(e: Esito): string {
  return ESITI.find((x) => x.value === e)?.label ?? e;
}

export interface ClasseConfig {
  codice: Classe;
  nome: string;
  descrizione: string;
  pctMin: number;
  pctMax: number;
  colore: string;
  testoScuro?: boolean;
  esitoDefault: Esito;
}

export const DEFAULT_CLASSI: ClasseConfig[] = [
  { codice: 0, nome: 'SANA', descrizione: 'Nessun danno visibile', pctMin: 0, pctMax: 5, colore: '#16a34a', esitoDefault: 'nessuno' },
  { codice: 1, nome: 'LIEVE', descrizione: 'Danno lieve', pctMin: 6, pctMax: 25, colore: '#eab308', testoScuro: true, esitoDefault: 'cure' },
  { codice: 2, nome: 'MEDIA', descrizione: 'Danno medio', pctMin: 26, pctMax: 50, colore: '#f97316', esitoDefault: 'monitoraggio' },
  { codice: 3, nome: 'GRAVE', descrizione: 'Danno grave', pctMin: 51, pctMax: 75, colore: '#dc2626', esitoDefault: 'decisione' },
  { codice: 4, nome: 'DISTRUTTA', descrizione: 'Pianta distrutta', pctMin: 76, pctMax: 100, colore: '#1f2937', esitoDefault: 'sostituzione' }
];

export interface Pratica {
  id?: number;
  titolo: string;
  cliente?: string;
  comune?: string;
  localita?: string;
  dataIncendio?: string;
  dataSopralluogo?: string;
  tecnico?: string;
  note?: string;
  createdAt: number;
}

export type UnitaTipo = 'singola' | 'filare' | 'siepe' | 'gruppo' | 'parcella';

export const UNITA_TIPI: { value: UnitaTipo; label: string; icona: string }[] = [
  { value: 'singola', label: 'Pianta singola', icona: '🌳' },
  { value: 'filare', label: 'Filare', icona: '🌲🌲' },
  { value: 'siepe', label: 'Siepe', icona: '🌿' },
  { value: 'gruppo', label: 'Gruppo di piante', icona: '🌳🌳' },
  { value: 'parcella', label: 'Parcella', icona: '⬛' }
];

export type GpsMode = 'ogni' | 'iniziofine' | 'punti';

export interface Unita {
  id?: number;
  praticaId: number;
  tipo: UnitaTipo;
  nome: string;
  specie?: string;
  cultivar?: string;
  eta?: number;
  annoImpianto?: number;
  numeroTeorico?: number;
  distanza?: number; // m tra le piante
  sesto?: string;
  lunghezza?: number; // m, siepe/filare
  numeroFilare?: number;
  verso?: string;
  gpsMode: GpsMode;
  conteggi?: Record<Classe, number>; // modalità gruppo / conta rapido
  gpsInizio?: GpsPoint | null;
  gpsFine?: GpsPoint | null;
  stato: 'in corso' | 'completata';
  note?: string;
  createdAt: number;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  ts: number;
}

export interface DettaglioPianta {
  chioma?: string;
  fogliame?: string;
  fusto?: string;
  colletto?: string;
  recupero?: string;
}

export interface Pianta {
  id?: number;
  praticaId: number;
  unitaId: number;
  numero: number;
  classe: Classe;
  esito?: Esito | null; // override manuale; null/undefined = regola della classe
  lat?: number;
  lng?: number;
  accuracy?: number;
  ts: number;
  dettaglio?: DettaglioPianta;
  note?: string;
}

export interface Foto {
  id?: number;
  praticaId: number;
  unitaId?: number;
  piantaId?: number;
  daNumero?: number;
  aNumero?: number;
  blob: Blob;
  lat?: number;
  lng?: number;
  accuracy?: number;
  ts: number;
  nota?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie('rilievo-incendi') as Dexie & {
  pratiche: EntityTable<Pratica, 'id'>;
  unita: EntityTable<Unita, 'id'>;
  piante: EntityTable<Pianta, 'id'>;
  foto: EntityTable<Foto, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  pratiche: '++id, createdAt',
  unita: '++id, praticaId, createdAt',
  piante: '++id, unitaId, praticaId, [unitaId+numero]',
  foto: '++id, praticaId, unitaId, piantaId',
  settings: 'key'
});

export function emptyConteggi(): Record<Classe, number> {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
}
