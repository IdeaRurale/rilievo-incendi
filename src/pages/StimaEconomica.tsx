import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import {
  db,
  DEFAULT_COSTI,
  DEFAULT_ESTIMO_RURALE,
  ETICHETTE_COSTI,
  type CostiUnitari,
  type EstimoRuraleInput,
  type Stima,
  type VoceDanno
} from '../db';
import { useClassi } from '../lib/useClassi';
import { computeStats } from '../lib/stats';
import { calcolaEstimoRurale, calcolaStima, getEstimoRurale, type RigaEstimo } from '../lib/stima';
import { Schermo, Topbar } from '../components/Layout';
import { vibra } from '../lib/feedback';

const FUNZIONI_PAESAGGISTICHE = [
  'Danno paesaggistico e ornamentale in adiacenza ad attivita turistica',
  'Perdita funzione di quinta verde e schermatura',
  'Riduzione attrattivita degli spazi esterni turistici',
  'Perdita funzione di mitigazione visiva del fondo',
  'Perdita valore estetico del fronte olivetato'
];

function copiaEstimoDefault(): EstimoRuraleInput {
  return {
    ...DEFAULT_ESTIMO_RURALE,
    danniPaesaggistici: DEFAULT_ESTIMO_RURALE.danniPaesaggistici.map((v) => ({ ...v }))
  };
}

function emptyStima(praticaId: number): Stima {
  return {
    praticaId,
    costi: { ...DEFAULT_COSTI },
    mancataFunzione: [],
    altriDanni: [],
    estimo: copiaEstimoDefault(),
    updatedAt: 0
  };
}

function emptyVoce(descrizione = ''): VoceDanno {
  return { descrizione, tipo: 'annuo', valore: 0, anni: 5 };
}

function euro(n: number): string {
  return n.toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function pct(n: number): string {
  return `${(n * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`;
}

export default function StimaEconomica() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();
  const [stima, setStima] = useState<Stima>(emptyStima(praticaId));
  const [salvato, setSalvato] = useState(false);

  const unitaList = useLiveQuery(() => db.unita.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);

  useEffect(() => {
    db.stime.get(praticaId).then((s) => {
      if (!s) return;
      setStima({
        ...s,
        estimo: {
          ...copiaEstimoDefault(),
          ...(s.estimo ?? {}),
          danniPaesaggistici: s.estimo?.danniPaesaggistici ?? copiaEstimoDefault().danniPaesaggistici
        }
      });
    });
  }, [praticaId]);

  if (!unitaList || !piante) return null;

  const stats = computeStats(unitaList, piante, classi);
  const estimo = getEstimoRurale(stima);
  const calcEstimo = calcolaEstimoRurale(stats, stima);
  const calcPiante = calcolaStima(stats, stima);

  function aggiornaEstimo(patch: Partial<EstimoRuraleInput>) {
    setStima((s) => ({ ...s, estimo: { ...getEstimoRurale(s), ...patch } }));
    setSalvato(false);
  }

  function aggiornaCosto(chiave: keyof CostiUnitari, val: number) {
    setStima((s) => ({ ...s, costi: { ...s.costi, [chiave]: val } }));
    setSalvato(false);
  }

  function aggiornaVocePaesaggistica(i: number, patch: Partial<VoceDanno>) {
    aggiornaEstimo({
      danniPaesaggistici: estimo.danniPaesaggistici.map((v, j) => (i === j ? { ...v, ...patch } : v))
    });
  }

  function rimuoviVocePaesaggistica(i: number) {
    aggiornaEstimo({
      danniPaesaggistici: estimo.danniPaesaggistici.filter((_, j) => i !== j)
    });
  }

  function aggiungiVocePaesaggistica(descrizione = '') {
    aggiornaEstimo({
      danniPaesaggistici: [...estimo.danniPaesaggistici, emptyVoce(descrizione)]
    });
  }

  async function salva() {
    await db.stime.put({ ...stima, praticaId, estimo, updatedAt: Date.now() });
    setSalvato(true);
    vibra('ok');
  }

  const gruppiCosto = [
    { id: 'sostituzione', label: 'Nuovo impianto per pianta da sostituire' },
    { id: 'rimozione', label: 'Rimozione e smaltimento' },
    { id: 'recupero', label: 'Recupero piante danneggiate' },
    { id: 'monitoraggio', label: 'Monitoraggio' }
  ] as const;

  return (
    <>
      <Topbar titolo="Pre-relazione e stima" indietro={`/pratica/${id}`} />
      <Schermo>
        <div className="card">
          <h2>Quadro tecnico</h2>
          <div className="stat-grid" style={{ marginBottom: 10 }}>
            <StatMini label="Censite" value={String(stats.censite)} />
            <StatMini label="Danno medio rilievo" value={`${stats.dannoMedio}%`} />
            <StatMini label="Da reimpiantare" value={String(stats.daSostituire)} />
            <StatMini label="In recupero" value={String(Math.max(0, stats.danneggiate - stats.daSostituire))} />
          </div>
          <div className="riga-2">
            <NumberField
              label="Superficie colpita (ha)"
              value={estimo.superficieHa}
              onChange={(v) => aggiornaEstimo({ superficieHa: v })}
              placeholder="2,00"
            />
            <PercentDecimalField
              label="Livello danno LD"
              value={estimo.livelloDanno}
              onChange={(v) => aggiornaEstimo({ livelloDanno: v })}
              placeholder="70"
            />
          </div>
          <button
            className="btn btn-secondario"
            style={{ minHeight: 42, fontSize: 14, marginTop: 10 }}
            type="button"
            onClick={() => aggiornaEstimo({ livelloDanno: stats.dannoMedio / 100 })}
          >
            USA LD DA CENSIMENTO ({stats.dannoMedio}%)
          </button>
          <div className="campo" style={{ marginTop: 10 }}>
            <label>Descrizione fondo e incidenza danno</label>
            <textarea
              rows={3}
              value={estimo.noteQuadroTecnico ?? ''}
              onChange={(e) => aggiornaEstimo({ noteQuadroTecnico: e.target.value })}
              placeholder="Oliveto in Puglia, con danno da incendio e interferenza con attivita turistica confinante."
            />
          </div>
        </div>

        <div className="card">
          <h2>Danno emergente</h2>
          <div className="riga-2">
            <MoneyField
              label="Valore oliveto integro V_m (euro/ha)"
              value={estimo.valoreMercatoHa}
              onChange={(v) => aggiornaEstimo({ valoreMercatoHa: v })}
              placeholder="28000"
            />
            <MoneyField
              label="Valore terreno nudo V_0 (euro/ha)"
              value={estimo.valoreTerrenoNudoHa}
              onChange={(v) => aggiornaEstimo({ valoreTerrenoNudoHa: v })}
              placeholder="9000"
            />
          </div>
          <div className="riga-2" style={{ marginTop: 10 }}>
            <NumberField
              label="Produzione persa (q/ha)"
              value={estimo.produzionePersaQHa}
              onChange={(v) => aggiornaEstimo({ produzionePersaQHa: v })}
              placeholder="40"
            />
            <MoneyField
              label="Prezzo olive (euro/q)"
              value={estimo.prezzoOliveQ}
              onChange={(v) => aggiornaEstimo({ prezzoOliveQ: v })}
              placeholder="90"
            />
          </div>
          <div className="riga-2" style={{ marginTop: 10 }}>
            <MoneyField
              label="Spese risparmiate (euro/ha)"
              value={estimo.speseRisparmiateHa}
              onChange={(v) => aggiornaEstimo({ speseRisparmiateHa: v })}
              placeholder="500"
            />
            <MoneyField
              label="Spese straordinarie totali"
              value={estimo.speseStraordinarie}
              onChange={(v) => aggiornaEstimo({ speseStraordinarie: v })}
              placeholder="4500"
            />
          </div>
        </div>

        <div className="card">
          <h2>Lucro cessante</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={estimo.usaRipartoRilievo}
              onChange={(e) => aggiornaEstimo({ usaRipartoRilievo: e.target.checked })}
              style={{ width: 'auto' }}
            />
            Usa riparto piante da censimento
          </label>
          <div style={{ fontSize: 13, color: 'var(--testo-sec)', marginTop: 6 }}>
            Riparto usato: recupero {pct(calcEstimo.quotaRecupero)}, reimpianto {pct(calcEstimo.quotaReimpianto)}.
          </div>

          {!estimo.usaRipartoRilievo && (
            <div className="riga-2" style={{ marginTop: 10 }}>
              <PercentDecimalField
                label="Quota superficie recupero"
                value={estimo.quotaRecupero}
                onChange={(v) => aggiornaEstimo({ quotaRecupero: v })}
              />
              <PercentDecimalField
                label="Quota superficie reimpianto"
                value={estimo.quotaReimpianto}
                onChange={(v) => aggiornaEstimo({ quotaReimpianto: v })}
              />
            </div>
          )}

          <div className="riga-2" style={{ marginTop: 10 }}>
            <PercentPlainField
              label="Riduzione resa recupero"
              value={estimo.riduzioneResaRecuperoPct}
              onChange={(v) => aggiornaEstimo({ riduzioneResaRecuperoPct: v })}
              placeholder="40"
            />
            <NumberField
              label="Anni ripresa recupero"
              value={estimo.anniRipresaRecupero}
              onChange={(v) => aggiornaEstimo({ anniRipresaRecupero: Math.round(v) })}
              placeholder="4"
            />
          </div>
          <div className="riga-2" style={{ marginTop: 10 }}>
            <NumberField
              label="Anni improduttivita nuove"
              value={estimo.anniImproduttivitaNuove}
              onChange={(v) => aggiornaEstimo({ anniImproduttivitaNuove: Math.round(v) })}
              placeholder="5"
            />
            <NumberField
              label="Anni produttivita crescente"
              value={estimo.anniProduttivitaCrescenteNuove}
              onChange={(v) => aggiornaEstimo({ anniProduttivitaCrescenteNuove: Math.round(v) })}
              placeholder="5"
            />
          </div>
          <div className="riga-2" style={{ marginTop: 10 }}>
            <MoneyField
              label="Reddito netto annuo Rn (euro/ha)"
              value={estimo.redditoNettoAnnuoHa}
              onChange={(v) => aggiornaEstimo({ redditoNettoAnnuoHa: v })}
              placeholder="3500"
            />
            <PercentDecimalField
              label="Saggio di sconto r"
              value={estimo.saggioSconto}
              onChange={(v) => aggiornaEstimo({ saggioSconto: v })}
              placeholder="3"
            />
          </div>
        </div>

        <div className="card">
          <h2>Danno paesaggistico e ornamentale</h2>
          {estimo.danniPaesaggistici.map((voce, i) => (
            <VoceEditor
              key={i}
              voce={voce}
              onPatch={(p) => aggiornaVocePaesaggistica(i, p)}
              onRimuovi={() => rimuoviVocePaesaggistica(i)}
            />
          ))}
          <div className="chips" style={{ marginBottom: 10 }}>
            {FUNZIONI_PAESAGGISTICHE.map((f) => (
              <button key={f} type="button" onClick={() => aggiungiVocePaesaggistica(f)}>
                + {f}
              </button>
            ))}
            <button type="button" onClick={() => aggiungiVocePaesaggistica()}>
              + Altra voce
            </button>
          </div>
        </div>

        <div className="card">
          <h2>Parcella estimativa</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
            <input
              type="checkbox"
              checked={estimo.contraddittorio}
              onChange={(e) => aggiornaEstimo({ contraddittorio: e.target.checked })}
              style={{ width: 'auto' }}
            />
            +30% contraddittorio
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={estimo.periziaGiurata}
              onChange={(e) => aggiornaEstimo({ periziaGiurata: e.target.checked })}
              style={{ width: 'auto' }}
            />
            +10% perizia giurata
          </label>
        </div>

        <div className="card" style={{ borderLeft: '6px solid var(--verde)' }}>
          <h2>Sintesi risarcitoria</h2>
          <div className="stat-grid">
            <StatMini label="Danno emergente" value={euro(calcEstimo.dannoEmergente)} />
            <StatMini label="Lucro cessante" value={euro(calcEstimo.lucroCessante)} />
            <StatMini label="Danno totale" value={euro(calcEstimo.dannoTotale)} />
            <StatMini label="Parcella" value={euro(calcEstimo.onorarioTotale)} />
          </div>
          <RighePreview title="Stima patrimoniale" righe={calcEstimo.righePatrimoniali} totale={calcEstimo.dannoEmergente} />
          <RighePreview title="Stima reddituale" righe={calcEstimo.righeReddituali} totale={calcEstimo.lucroCessante} />
        </div>

        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 900 }}>Computo operativo da censimento</summary>
          <div style={{ fontSize: 13, color: 'var(--testo-sec)', margin: '8px 0' }}>
            Totale computo piante: <b>{euro(calcPiante.totaleGenerale)}</b>
          </div>
          {gruppiCosto.map((g) => {
            const voci = ETICHETTE_COSTI.filter((e) => e.gruppo === g.id);
            return (
              <div key={g.id} style={{ marginTop: 12 }}>
                <h2 style={{ fontSize: 15 }}>{g.label}</h2>
                {voci.map((e) => (
                  <MoneyField
                    key={e.chiave}
                    label={`${e.label} (euro/pz)`}
                    value={stima.costi[e.chiave]}
                    onChange={(v) => aggiornaCosto(e.chiave, v)}
                  />
                ))}
              </div>
            );
          })}
        </details>

        <div className="card">
          <div className="campo">
            <label>Riferimento prezziario / fonti dei valori</label>
            <textarea
              rows={2}
              value={stima.prezziarioNota ?? ''}
              onChange={(e) => {
                setStima((s) => ({ ...s, prezziarioNota: e.target.value }));
                setSalvato(false);
              }}
              placeholder="Prezziario regionale, listini vivaio, preventivi, valori agricoli o fonti documentate."
            />
          </div>
          <div className="campo" style={{ marginTop: 8 }}>
            <label>Note tecniche</label>
            <textarea
              rows={2}
              value={stima.note ?? ''}
              onChange={(e) => {
                setStima((s) => ({ ...s, note: e.target.value }));
                setSalvato(false);
              }}
            />
          </div>
        </div>

        <button className={`btn ${salvato ? 'btn-secondario' : 'btn-primario'}`} onClick={salva}>
          {salvato ? 'SALVATO' : 'SALVA SCHEDA'}
        </button>

        {salvato && (
          <Link to={`/pratica/${id}/relazione`} className="btn btn-primario">
            APRI RELAZIONE STAMPABILE
          </Link>
        )}
      </Schermo>
    </>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="campo">
      <label>{label}</label>
      <input
        inputMode="decimal"
        value={value === 0 ? '' : String(value).replace('.', ',')}
        placeholder={placeholder ?? '0'}
        onChange={(e) => onChange(parseNumero(e.target.value))}
      />
    </div>
  );
}

function MoneyField(props: Parameters<typeof NumberField>[0]) {
  return <NumberField {...props} />;
}

function PercentDecimalField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return (
    <NumberField
      label={`${label} (%)`}
      value={value * 100}
      onChange={(n) => onChange(Math.max(0, Math.min(100, n)) / 100)}
      placeholder={placeholder}
    />
  );
}

function PercentPlainField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}) {
  return <NumberField label={`${label} (%)`} value={value} onChange={onChange} placeholder={placeholder} />;
}

function VoceEditor({
  voce,
  onPatch,
  onRimuovi
}: {
  voce: VoceDanno;
  onPatch: (p: Partial<VoceDanno>) => void;
  onRimuovi: () => void;
}) {
  return (
    <div style={{ borderLeft: '4px solid var(--verde)', paddingLeft: 10, marginBottom: 14 }}>
      <div className="campo" style={{ marginBottom: 6 }}>
        <label>Descrizione</label>
        <input value={voce.descrizione} onChange={(e) => onPatch({ descrizione: e.target.value })} />
      </div>
      <div className="chips" style={{ marginBottom: 6 }}>
        <button type="button" className={voce.tipo === 'annuo' ? 'attivo' : ''} onClick={() => onPatch({ tipo: 'annuo' })}>
          Valore annuo
        </button>
        <button type="button" className={voce.tipo === 'corpo' ? 'attivo' : ''} onClick={() => onPatch({ tipo: 'corpo' })}>
          A corpo
        </button>
      </div>
      <div className="riga-2">
        <MoneyField
          label={voce.tipo === 'annuo' ? 'Valore annuo' : 'Importo'}
          value={voce.valore}
          onChange={(v) => onPatch({ valore: v })}
        />
        {voce.tipo === 'annuo' && (
          <NumberField
            label="Anni"
            value={voce.anni ?? 1}
            onChange={(v) => onPatch({ anni: Math.max(1, Math.round(v)) })}
          />
        )}
      </div>
      <button className="btn btn-pericolo" style={{ minHeight: 36, fontSize: 13, marginTop: 8 }} onClick={onRimuovi}>
        Rimuovi
      </button>
    </div>
  );
}

function RighePreview({ title, righe, totale }: { title: string; righe: RigaEstimo[]; totale: number }) {
  if (righe.length === 0) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 15 }}>{title}</h2>
      {righe.map((r, i) => (
        <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--bordo)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontWeight: 800 }}>
            <span>{r.voce.replace('[Patrimoniale] ', '').replace('[Reddituale] ', '')}</span>
            <span>{euro(r.importo)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--testo-sec)' }}>{r.formula}</div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, fontWeight: 900 }}>
        <span>Subtotale</span>
        <span>{euro(totale)}</span>
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="etichetta">{label}</div>
      <div className="valore" style={{ fontSize: value.length > 10 ? 20 : undefined }}>{value}</div>
    </div>
  );
}

function parseNumero(v: string): number {
  const normalizzato = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
  const n = parseFloat(normalizzato);
  return Number.isFinite(n) ? n : 0;
}
