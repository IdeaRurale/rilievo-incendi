import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db, type Stima } from '../db';
import { useClassi } from '../lib/useClassi';
import { computeStats, fmtEuro } from '../lib/stats';
import { calcolaStima } from '../lib/stima';
import { Topbar } from '../components/Layout';

function fmtData(iso?: string) {
  if (!iso) return '___________';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface Sezione {
  titolo: string;
  righe: { voce: string; formula: string; totale: number }[];
  totale: number;
}

export default function Relazione() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();
  const pratica = useLiveQuery(() => db.pratiche.get(praticaId), [praticaId]);
  const unitaList = useLiveQuery(() => db.unita.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const [stima, setStima] = useState<Stima | null>(null);

  useEffect(() => { db.stime.get(praticaId).then(s => setStima(s ?? null)); }, [praticaId]);

  if (!pratica || !unitaList || !piante) return null;

  const stats = computeStats(unitaList, piante, classi);
  const calc = stima ? calcolaStima(stats, stima) : null;

  const sezioni: Sezione[] = calc ? [
    {
      titolo: 'A — Rimozione e smaltimento piante danneggiate',
      righe: calc.righeRimozione.map(r => ({ voce: r.voce, formula: r.formula, totale: r.totale })),
      totale: calc.totRimozione
    },
    {
      titolo: 'B — Nuovo impianto (piante da sostituire)',
      righe: calc.righeImpianto.map(r => ({ voce: r.voce, formula: r.formula, totale: r.totale })),
      totale: calc.totImpianto
    },
    {
      titolo: 'C — Recupero piante danneggiate',
      righe: calc.righeRecupero.map(r => ({ voce: r.voce, formula: r.formula, totale: r.totale })),
      totale: calc.totRecupero
    },
    {
      titolo: 'D — Monitoraggio',
      righe: calc.righeMonitoraggio.map(r => ({ voce: r.voce, formula: r.formula, totale: r.totale })),
      totale: calc.totMonitoraggio
    },
    {
      titolo: 'E — Mancata funzione e danni indiretti',
      righe: calc.righeMancataFunzione.map(r => ({ voce: r.descrizione, formula: r.formula, totale: r.importo })),
      totale: calc.totMancataFunzione
    },
    {
      titolo: 'F — Altri danni',
      righe: calc.righeAltriDanni.map(r => ({ voce: r.descrizione, formula: r.formula, totale: r.importo })),
      totale: calc.totAltriDanni
    },
  ].filter(s => s.righe.length > 0) : [];

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Barra di controllo (nascosta in stampa) */}
      <div className="no-print" style={{ background: 'var(--verde)', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link to={`/pratica/${id}/stima`} style={{ color: '#fff', fontSize: 22, fontWeight: 700, textDecoration: 'none' }}>‹</Link>
        <span style={{ flex: 1, fontWeight: 700 }}>Relazione tecnica</span>
        {!stima && (
          <Link to={`/pratica/${id}/stima`} style={{ background: 'rgba(255,255,255,.2)', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
            Compila stima →
          </Link>
        )}
        <button onClick={() => window.print()} style={{ background: '#fff', color: 'var(--verde)', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          🖨 STAMPA / PDF
        </button>
      </div>

      <div className="pagina-stampa">
        {/* INTESTAZIONE */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#555', marginBottom: 4 }}>Relazione tecnica — Stima del danno da incendio</div>
          <h1 style={{ fontSize: 22, margin: '0 0 4px', fontWeight: 900 }}>{pratica.titolo}</h1>
          {pratica.cliente && <div style={{ fontSize: 14, color: '#444' }}>Committente: <b>{pratica.cliente}</b></div>}
          {(pratica.comune || pratica.localita) && (
            <div style={{ fontSize: 14, color: '#444' }}>
              Luogo: <b>{[pratica.comune, pratica.localita].filter(Boolean).join(' — ')}</b>
            </div>
          )}
          <div style={{ fontSize: 14, color: '#444', marginTop: 2 }}>
            {pratica.dataIncendio && <>Incendio: <b>{fmtData(pratica.dataIncendio)}</b>&nbsp;&nbsp;</>}
            {pratica.dataSopralluogo && <>Sopralluogo: <b>{fmtData(pratica.dataSopralluogo)}</b></>}
          </div>
          {pratica.tecnico && <div style={{ fontSize: 13, marginTop: 4, color: '#666' }}>Tecnico: {pratica.tecnico}</div>}
        </div>

        <hr style={{ border: 'none', borderTop: '2px solid #14532d', marginBottom: 24 }} />

        {/* 1. CENSIMENTO */}
        <h2 className="titolo-sezione">1. Risultati del censimento</h2>

        <table className="tabella-relazione">
          <thead>
            <tr><th>Voce</th><th style={{ textAlign: 'right' }}>N.</th><th style={{ textAlign: 'right' }}>%</th></tr>
          </thead>
          <tbody>
            <tr><td>Piante teoriche</td><td style={{ textAlign: 'right' }}>{stats.teoriche || '—'}</td><td /></tr>
            <tr><td>Piante censite</td><td style={{ textAlign: 'right' }}><b>{stats.censite}</b></td><td /></tr>
            {classi.map(c => (
              <tr key={c.codice}>
                <td style={{ paddingLeft: 16 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: c.colore, borderRadius: 3, marginRight: 6, verticalAlign: 'middle' }} />
                  {c.nome} ({c.pctMin}–{c.pctMax}%)
                </td>
                <td style={{ textAlign: 'right' }}>{stats.perClasse[c.codice]}</td>
                <td style={{ textAlign: 'right', color: '#555' }}>
                  {stats.censite > 0 ? `${((stats.perClasse[c.codice] / stats.censite) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #ccc' }}><td><b>Danneggiate totali</b></td><td style={{ textAlign: 'right' }}><b>{stats.danneggiate}</b></td><td style={{ textAlign: 'right' }}><b>{stats.pctDanneggiate}%</b></td></tr>
            <tr><td>Di cui: da sostituire</td><td style={{ textAlign: 'right' }}>{stats.daSostituire}</td><td style={{ textAlign: 'right' }}>{stats.pctSostituire}%</td></tr>
            <tr><td>Da monitorare</td><td style={{ textAlign: 'right' }}>{stats.daMonitorare}</td><td /></tr>
            <tr><td>Danno medio ponderato</td><td style={{ textAlign: 'right' }} colSpan={2}><b>{stats.dannoMedio}%</b></td></tr>
          </tbody>
        </table>

        {/* Unità di rilievo */}
        {unitaList.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginTop: 18, marginBottom: 8 }}>Unità di rilievo</h3>
            <table className="tabella-relazione">
              <thead>
                <tr><th>Unità</th><th>Specie</th><th style={{ textAlign: 'right' }}>Teoriche</th><th style={{ textAlign: 'right' }}>Censite</th></tr>
              </thead>
              <tbody>
                {unitaList.map(u => {
                  const np = piante.filter(p => p.unitaId === u.id!).length;
                  const nc = u.tipo === 'gruppo' && u.conteggi
                    ? Object.values(u.conteggi).reduce((a, b) => a + b, 0)
                    : np;
                  return (
                    <tr key={u.id}>
                      <td>{u.nome}</td>
                      <td>{u.specie ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{u.numeroTeorico ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{nc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {/* 2. STIMA ECONOMICA */}
        {calc && (
          <>
            <h2 className="titolo-sezione" style={{ marginTop: 28 }}>2. Stima economica del danno</h2>
            {stima?.prezziarioNota && (
              <p style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                Riferimento prezziario: {stima.prezziarioNota}
              </p>
            )}

            {sezioni.map(sez => (
              <div key={sez.titolo} style={{ marginBottom: 18 }}>
                <h3 style={{ fontSize: 14, marginBottom: 6, color: '#14532d' }}>{sez.titolo}</h3>
                <table className="tabella-relazione">
                  <thead>
                    <tr><th>Voce</th><th>Formula</th><th style={{ textAlign: 'right' }}>Importo</th></tr>
                  </thead>
                  <tbody>
                    {sez.righe.map((r, i) => (
                      <tr key={i}>
                        <td>{r.voce}</td>
                        <td style={{ color: '#555', fontSize: 13 }}>{r.formula}</td>
                        <td style={{ textAlign: 'right' }}>{fmtEuro(r.totale)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid #ccc', fontWeight: 700 }}>
                      <td colSpan={2}>Subtotale {sez.titolo.split('—')[0].trim()}</td>
                      <td style={{ textAlign: 'right' }}>{fmtEuro(sez.totale)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}

            {/* Riepilogo finale */}
            <table className="tabella-relazione" style={{ marginTop: 16, borderTop: '2px solid #14532d' }}>
              <tbody>
                {calc.totRimozione > 0 && <tr><td>A — Rimozione e smaltimento</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totRimozione)}</td></tr>}
                {calc.totImpianto > 0 && <tr><td>B — Nuovo impianto</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totImpianto)}</td></tr>}
                {calc.totRecupero > 0 && <tr><td>C — Recupero</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totRecupero)}</td></tr>}
                {calc.totMonitoraggio > 0 && <tr><td>D — Monitoraggio</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totMonitoraggio)}</td></tr>}
                {calc.totMancataFunzione > 0 && <tr><td>E — Mancata funzione</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totMancataFunzione)}</td></tr>}
                {calc.totAltriDanni > 0 && <tr><td>F — Altri danni</td><td style={{ textAlign: 'right' }}>{fmtEuro(calc.totAltriDanni)}</td></tr>}
                <tr style={{ fontSize: 18, fontWeight: 900, borderTop: '2px solid #14532d', color: '#14532d' }}>
                  <td>TOTALE DANNO STIMATO</td>
                  <td style={{ textAlign: 'right' }}>{fmtEuro(calc.totaleGenerale)}</td>
                </tr>
              </tbody>
            </table>

            {stima?.note && (
              <div style={{ marginTop: 16, fontSize: 13, color: '#444', border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }}>
                <b>Note tecniche:</b> {stima.note}
              </div>
            )}
          </>
        )}

        {!calc && (
          <div style={{ padding: 20, textAlign: 'center', color: '#888', border: '2px dashed #d1d5db', borderRadius: 12, marginTop: 20 }}>
            Stima economica non ancora compilata.<br />
            <Link to={`/pratica/${id}/stima`} style={{ color: 'var(--verde)', fontWeight: 700 }}>Compila la stima →</Link>
          </div>
        )}

        {/* FIRMA */}
        <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Data e luogo</div>
              <div style={{ fontSize: 14 }}>{pratica.comune || '_______________'}, {fmtData(pratica.dataSopralluogo)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Firma del tecnico</div>
              <div style={{ fontSize: 14 }}>{pratica.tecnico || '_______________'}</div>
              <div style={{ marginTop: 30, borderTop: '1px solid #999', width: 180 }} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .pagina-stampa { padding: 20mm; max-width: 100%; }
        }
        .pagina-stampa {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px 20px 60px;
          background: white;
          color: #111;
        }
        .titolo-sezione {
          font-size: 16px;
          font-weight: 800;
          color: #14532d;
          border-bottom: 2px solid #14532d;
          padding-bottom: 4px;
          margin-bottom: 12px;
        }
        .tabella-relazione {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .tabella-relazione th {
          background: #f3f4f6;
          padding: 6px 8px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 2px solid #d1d5db;
        }
        .tabella-relazione td {
          padding: 5px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .tabella-relazione tr:last-child td { border-bottom: none; }
      `}</style>
    </div>
  );
}
