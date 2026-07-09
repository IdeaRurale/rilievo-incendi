import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import {
  db, DEFAULT_COSTI, ETICHETTE_COSTI, FUNZIONI_SUGGERITE,
  type CostiUnitari, type Stima, type VoceDanno
} from '../db';
import { useClassi } from '../lib/useClassi';
import { computeStats } from '../lib/stats';
import { calcolaStima } from '../lib/stima';
import { fmtEuro } from '../lib/stats';
import { Schermo, Topbar } from '../components/Layout';
import { vibra } from '../lib/feedback';

function emptyStima(praticaId: number): Stima {
  return { praticaId, costi: { ...DEFAULT_COSTI }, mancataFunzione: [], altriDanni: [], updatedAt: 0 };
}

function emptyVoce(): VoceDanno {
  return { descrizione: '', tipo: 'annuo', valore: 0, anni: 5 };
}

function numInput(val: number, onChange: (n: number) => void, placeholder?: string) {
  return (
    <input
      inputMode="decimal"
      value={val === 0 ? '' : String(val).replace('.', ',')}
      placeholder={placeholder ?? '0'}
      onChange={e => {
        const n = parseFloat(e.target.value.replace(',', '.'));
        onChange(isNaN(n) ? 0 : n);
      }}
    />
  );
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
    db.stime.get(praticaId).then(s => { if (s) setStima(s); });
  }, [praticaId]);

  if (!unitaList || !piante) return null;

  const stats = computeStats(unitaList, piante, classi);
  const calc = calcolaStima(stats, stima);

  function setCosto(chiave: keyof CostiUnitari, val: number) {
    setStima(s => ({ ...s, costi: { ...s.costi, [chiave]: val } }));
    setSalvato(false);
  }

  function setFunzione(i: number, patch: Partial<VoceDanno>) {
    setStima(s => {
      const mf = [...s.mancataFunzione];
      mf[i] = { ...mf[i], ...patch };
      return { ...s, mancataFunzione: mf };
    });
    setSalvato(false);
  }

  function setAltro(i: number, patch: Partial<VoceDanno>) {
    setStima(s => {
      const ad = [...s.altriDanni];
      ad[i] = { ...ad[i], ...patch };
      return { ...s, altriDanni: ad };
    });
    setSalvato(false);
  }

  async function salva() {
    await db.stime.put({ ...stima, praticaId, updatedAt: Date.now() });
    setSalvato(true);
    vibra('ok');
  }

  const gruppi = [
    { id: 'sostituzione', label: '🌱 Nuovo impianto (per pianta da sostituire)' },
    { id: 'rimozione', label: '🪓 Rimozione e smaltimento (per pianta da rimuovere)' },
    { id: 'recupero', label: '✂️ Recupero (per pianta da recuperare)' },
    { id: 'monitoraggio', label: '🔍 Monitoraggio (per pianta da monitorare)' },
  ] as const;

  return (
    <>
      <Topbar titolo="Stima economica" indietro={`/pratica/${id}`} />
      <Schermo>

        {/* RIEPILOGO PIANTE */}
        <div className="card">
          <h2>Piante censite: {stats.censite}</h2>
          <div className="stat-grid" style={{ marginTop: 8 }}>
            {[
              { e: 'Da sostituire', v: stats.daSostituire },
              { e: 'Danneggiate (recupero)', v: Math.max(0, stats.danneggiate - stats.daSostituire) },
              { e: 'Da monitorare', v: stats.daMonitorare },
              { e: 'Sane', v: stats.sane },
            ].map(x => (
              <div className="stat" key={x.e}>
                <div className="etichetta">{x.e}</div>
                <div className="valore">{x.v}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--testo-sec)', marginTop: 8 }}>
            Gli esiti derivano dalle regole per classe e dagli override manuali sulle piante.
          </div>
        </div>

        {/* PREZZI UNITARI */}
        {gruppi.map(g => {
          const voci = ETICHETTE_COSTI.filter(e => e.gruppo === g.id);
          return (
            <div className="card" key={g.id}>
              <h2 style={{ fontSize: 15 }}>{g.label}</h2>
              {voci.map(e => (
                <div className="campo" key={e.chiave} style={{ marginBottom: 10 }}>
                  <label>{e.label} (€/pz)</label>
                  {numInput(stima.costi[e.chiave], v => setCosto(e.chiave, v))}
                </div>
              ))}
            </div>
          );
        })}

        {/* MANCATA FUNZIONE */}
        <div className="card">
          <h2>🌿 Mancata funzione / danni indiretti</h2>
          <div style={{ fontSize: 13, color: 'var(--testo-sec)', marginBottom: 10 }}>
            Frangivento, privacy, ornamentale, paesaggistica, turistica... Inserisci il valore annuo × anni oppure un importo a corpo motivato.
          </div>
          {stima.mancataFunzione.map((v, i) => (
            <VoceEditor key={i} voce={v} onPatch={p => setFunzione(i, p)} onRimuovi={() => {
              setStima(s => ({ ...s, mancataFunzione: s.mancataFunzione.filter((_, j) => j !== i) }));
              setSalvato(false);
            }} />
          ))}
          {/* Suggerimenti rapidi */}
          <div className="chips" style={{ marginBottom: 10 }}>
            {FUNZIONI_SUGGERITE.map(f => (
              <button key={f} type="button" onClick={() => {
                setStima(s => ({ ...s, mancataFunzione: [...s.mancataFunzione, { ...emptyVoce(), descrizione: f }] }));
                setSalvato(false);
              }}>
                + {f}
              </button>
            ))}
            <button type="button" onClick={() => {
              setStima(s => ({ ...s, mancataFunzione: [...s.mancataFunzione, emptyVoce()] }));
              setSalvato(false);
            }}>
              + Altra voce
            </button>
          </div>
        </div>

        {/* ALTRI DANNI */}
        <div className="card">
          <h2>📋 Altri danni</h2>
          {stima.altriDanni.map((v, i) => (
            <VoceEditor key={i} voce={v} onPatch={p => setAltro(i, p)} onRimuovi={() => {
              setStima(s => ({ ...s, altriDanni: s.altriDanni.filter((_, j) => j !== i) }));
              setSalvato(false);
            }} />
          ))}
          <button className="btn btn-secondario" style={{ minHeight: 44 }} onClick={() => {
            setStima(s => ({ ...s, altriDanni: [...s.altriDanni, emptyVoce()] }));
            setSalvato(false);
          }}>
            + Aggiungi voce
          </button>
        </div>

        {/* NOTE PREZZIARIO */}
        <div className="card">
          <div className="campo">
            <label>Riferimento prezziario / note sui prezzi</label>
            <textarea rows={2} value={stima.prezziarioNota ?? ''} onChange={e => {
              setStima(s => ({ ...s, prezziarioNota: e.target.value }));
              setSalvato(false);
            }} placeholder="Es. Prezziario Regione Puglia 2024, listino vivaio X..." />
          </div>
          <div className="campo" style={{ marginTop: 8 }}>
            <label>Note tecniche</label>
            <textarea rows={2} value={stima.note ?? ''} onChange={e => {
              setStima(s => ({ ...s, note: e.target.value }));
              setSalvato(false);
            }} />
          </div>
        </div>

        {/* ANTEPRIMA TOTALI */}
        <div className="card" style={{ borderLeft: '6px solid var(--verde)' }}>
          <h2>Riepilogo stima</h2>
          {[
            { label: 'Rimozione e smaltimento', val: calc.totRimozione },
            { label: 'Nuovo impianto', val: calc.totImpianto },
            { label: 'Recupero e potatura', val: calc.totRecupero },
            { label: 'Monitoraggio', val: calc.totMonitoraggio },
            { label: 'Mancata funzione', val: calc.totMancataFunzione },
            { label: 'Altri danni', val: calc.totAltriDanni },
          ].filter(r => r.val > 0).map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--bordo)', fontSize: 15 }}>
              <span>{r.label}</span>
              <b>{fmtEuro(r.val)}</b>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 20, fontWeight: 900 }}>
            <span>TOTALE</span>
            <span style={{ color: 'var(--verde)' }}>{fmtEuro(calc.totaleGenerale)}</span>
          </div>
        </div>

        <button className={`btn ${salvato ? 'btn-secondario' : 'btn-primario'}`} onClick={salva}>
          {salvato ? '✓ SALVATO' : 'SALVA STIMA'}
        </button>

        {salvato && (
          <Link to={`/pratica/${id}/relazione`} className="btn btn-primario">
            📄 APRI RELAZIONE TECNICA
          </Link>
        )}
      </Schermo>
    </>
  );
}

function VoceEditor({ voce, onPatch, onRimuovi }: {
  voce: VoceDanno;
  onPatch: (p: Partial<VoceDanno>) => void;
  onRimuovi: () => void;
}) {
  return (
    <div style={{ borderLeft: '4px solid var(--verde)', paddingLeft: 10, marginBottom: 14 }}>
      <div className="campo" style={{ marginBottom: 6 }}>
        <label>Descrizione</label>
        <input value={voce.descrizione} onChange={e => onPatch({ descrizione: e.target.value })} />
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
        <div className="campo">
          <label>{voce.tipo === 'annuo' ? 'Valore annuo (€)' : 'Importo (€)'}</label>
          <input inputMode="decimal" value={voce.valore || ''} onChange={e => {
            const n = parseFloat(e.target.value.replace(',', '.'));
            onPatch({ valore: isNaN(n) ? 0 : n });
          }} />
        </div>
        {voce.tipo === 'annuo' && (
          <div className="campo">
            <label>Anni</label>
            <input inputMode="numeric" value={voce.anni ?? ''} onChange={e => onPatch({ anni: parseInt(e.target.value) || 1 })} />
          </div>
        )}
      </div>
      {voce.valore > 0 && (
        <div style={{ fontSize: 13, color: 'var(--testo-sec)', marginTop: 4 }}>
          {voce.tipo === 'annuo'
            ? `${fmtEuro(voce.valore)}/anno × ${voce.anni ?? 1} anni = ${fmtEuro(voce.valore * (voce.anni ?? 1))}`
            : `Importo a corpo: ${fmtEuro(voce.valore)}`}
        </div>
      )}
      <button className="btn btn-pericolo" style={{ minHeight: 36, fontSize: 13, marginTop: 6 }} onClick={onRimuovi}>
        Rimuovi
      </button>
    </div>
  );
}
