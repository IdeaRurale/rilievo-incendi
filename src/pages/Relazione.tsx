import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db, type Stima } from '../db';
import { useClassi } from '../lib/useClassi';
import { computeStats } from '../lib/stats';
import { calcolaEstimoRurale, calcolaStima, type RigaEstimo } from '../lib/stima';

function fmtData(iso?: string) {
  if (!iso) return '___________';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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
  return `${(n * 100).toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`;
}

function num(n: number): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

export default function Relazione() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();
  const pratica = useLiveQuery(() => db.pratiche.get(praticaId), [praticaId]);
  const unitaList = useLiveQuery(() => db.unita.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const [stima, setStima] = useState<Stima | null>(null);

  useEffect(() => {
    db.stime.get(praticaId).then((s) => setStima(s ?? null));
  }, [praticaId]);

  if (!pratica || !unitaList || !piante) return null;

  const stats = computeStats(unitaList, piante, classi);
  const calcPiante = stima ? calcolaStima(stats, stima) : null;
  const calcEstimo = stima ? calcolaEstimoRurale(stats, stima) : null;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div className="no-print barra-relazione">
        <Link to={`/pratica/${id}/stima`} className="indietro-relazione">‹</Link>
        <span style={{ flex: 1, fontWeight: 800 }}>Scheda pre-relazione tecnica</span>
        {!stima && (
          <Link to={`/pratica/${id}/stima`} className="link-relazione">
            Compila stima
          </Link>
        )}
        <button onClick={() => window.print()} className="stampa-relazione">
          STAMPA / PDF
        </button>
      </div>

      <div className="pagina-stampa">
        <header style={{ textAlign: 'center', marginBottom: 24 }}>
          <div className="eyebrow">Scheda pre-relazione tecnica estimativa</div>
          <h1 style={{ fontSize: 23, margin: '0 0 5px', fontWeight: 900 }}>{pratica.titolo}</h1>
          {pratica.cliente && <div>Committente: <b>{pratica.cliente}</b></div>}
          {(pratica.comune || pratica.localita) && (
            <div>Ubicazione: <b>{[pratica.comune, pratica.localita].filter(Boolean).join(' - ')}</b></div>
          )}
          <div>
            {pratica.dataIncendio && <>Evento incendio: <b>{fmtData(pratica.dataIncendio)}</b>&nbsp;&nbsp;</>}
            {pratica.dataSopralluogo && <>Sopralluogo: <b>{fmtData(pratica.dataSopralluogo)}</b></>}
          </div>
          {pratica.tecnico && <div style={{ marginTop: 4 }}>Tecnico incaricato: {pratica.tecnico}</div>}
        </header>

        <hr style={{ border: 'none', borderTop: '2px solid #14532d', marginBottom: 22 }} />

        {!calcEstimo && (
          <div className="box-vuoto">
            Stima estimativa non ancora compilata.
            <br />
            <Link to={`/pratica/${id}/stima`}>Apri la scheda di stima</Link>
          </div>
        )}

        {calcEstimo && (
          <>
            <h2 className="titolo-sezione">1. Quadro tecnico</h2>
            <p>
              Il fondo oggetto di stima e' costituito da oliveto interessato da incendio. La superficie colpita
              indicata nella scheda e' pari a <b>{num(calcEstimo.input.superficieHa)} ha</b>, con livello medio di
              danneggiamento <b>LD = {pct(calcEstimo.input.livelloDanno)}</b>.
            </p>
            <p>
              Il riparto tecnico usato ai fini reddituali individua <b>{num(calcEstimo.superficieRecuperoHa)} ha</b>{' '}
              in recupero e <b>{num(calcEstimo.superficieReimpiantoHa)} ha</b> equivalenti a reimpianto. Il riparto
              deriva {calcEstimo.input.usaRipartoRilievo ? 'dal censimento delle piante' : 'dai valori inseriti dal tecnico'}.
            </p>
            {calcEstimo.input.noteQuadroTecnico && <p>{calcEstimo.input.noteQuadroTecnico}</p>}

            <table className="tabella-relazione">
              <tbody>
                <tr><td>Piante censite</td><td style={{ textAlign: 'right' }}>{stats.censite}</td></tr>
                <tr><td>Piante danneggiate</td><td style={{ textAlign: 'right' }}>{stats.danneggiate} ({stats.pctDanneggiate}%)</td></tr>
                <tr><td>Piante da sostituire</td><td style={{ textAlign: 'right' }}>{stats.daSostituire} ({stats.pctSostituire}%)</td></tr>
                <tr><td>Danno medio ponderato da classi</td><td style={{ textAlign: 'right' }}>{stats.dannoMedio}%</td></tr>
              </tbody>
            </table>

            <h3 className="sottotitolo">Distribuzione per classe</h3>
            <table className="tabella-relazione">
              <thead>
                <tr><th>Classe</th><th>Intervallo danno</th><th style={{ textAlign: 'right' }}>N.</th></tr>
              </thead>
              <tbody>
                {classi.map((c) => (
                  <tr key={c.codice}>
                    <td>{c.nome}</td>
                    <td>{c.pctMin}-{c.pctMax}%</td>
                    <td style={{ textAlign: 'right' }}>{stats.perClasse[c.codice]}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h2 className="titolo-sezione">2. Stima patrimoniale - danno emergente</h2>
            <TabellaRighe righe={calcEstimo.righePatrimoniali} totale={calcEstimo.dannoEmergente} />

            <h2 className="titolo-sezione">3. Stima reddituale - lucro cessante</h2>
            <TabellaRighe righe={calcEstimo.righeReddituali} totale={calcEstimo.lucroCessante} />

            <h2 className="titolo-sezione">4. Sintesi risarcitoria</h2>
            <table className="tabella-relazione riepilogo-finale">
              <tbody>
                <tr><td>Danno emergente patrimoniale</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.dannoEmergente)}</td></tr>
                <tr><td>Lucro cessante reddituale</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.lucroCessante)}</td></tr>
                <tr className="totale"><td>Danno totale stimato</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.dannoTotale)}</td></tr>
              </tbody>
            </table>
            <p className="nota">
              Nota fiscale: la quota stimata come danno emergente ha natura reintegrativa patrimoniale; la quota
              stimata come lucro cessante sostituisce redditi non conseguiti e va distinta ai fini IRPEF/IRES secondo
              il titolo liquidatorio e la posizione fiscale del beneficiario.
            </p>

            <h2 className="titolo-sezione">5. Parcella estimativa - D.M. 372/1993, Tabella 3 Incendio</h2>
            <table className="tabella-relazione">
              <thead>
                <tr><th>Scaglione</th><th style={{ textAlign: 'right' }}>Quota</th><th style={{ textAlign: 'right' }}>Aliquota</th><th style={{ textAlign: 'right' }}>Compenso</th></tr>
              </thead>
              <tbody>
                {calcEstimo.righeTariffa.map((r) => (
                  <tr key={r.descrizione}>
                    <td>{r.descrizione}</td>
                    <td style={{ textAlign: 'right' }}>{euro(r.quota)}</td>
                    <td style={{ textAlign: 'right' }}>{pct(r.aliquota)}</td>
                    <td style={{ textAlign: 'right' }}>{euro(r.importo)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3}>Onorario base</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.onorarioBase)}</td></tr>
                {calcEstimo.maggiorazioneContraddittorio > 0 && (
                  <tr><td colSpan={3}>Maggiorazione contraddittorio 30%</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.maggiorazioneContraddittorio)}</td></tr>
                )}
                {calcEstimo.maggiorazioneGiurata > 0 && (
                  <tr><td colSpan={3}>Maggiorazione perizia giurata 10%</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.maggiorazioneGiurata)}</td></tr>
                )}
                <tr className="totale"><td colSpan={3}>Totale parcella estimativa</td><td style={{ textAlign: 'right' }}>{euro(calcEstimo.onorarioTotale)}</td></tr>
              </tbody>
            </table>

            {calcPiante && calcPiante.totaleGenerale > 0 && (
              <>
                <h2 className="titolo-sezione">6. Computo operativo da censimento</h2>
                <table className="tabella-relazione">
                  <tbody>
                    {calcPiante.totRimozione > 0 && <tr><td>Rimozione e smaltimento</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totRimozione)}</td></tr>}
                    {calcPiante.totImpianto > 0 && <tr><td>Nuovo impianto</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totImpianto)}</td></tr>}
                    {calcPiante.totRecupero > 0 && <tr><td>Recupero e potature</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totRecupero)}</td></tr>}
                    {calcPiante.totMonitoraggio > 0 && <tr><td>Monitoraggio</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totMonitoraggio)}</td></tr>}
                    {calcPiante.totMancataFunzione > 0 && <tr><td>Mancata funzione da computo</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totMancataFunzione)}</td></tr>}
                    {calcPiante.totAltriDanni > 0 && <tr><td>Altri danni da computo</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totAltriDanni)}</td></tr>}
                    <tr className="totale"><td>Totale computo operativo</td><td style={{ textAlign: 'right' }}>{euro(calcPiante.totaleGenerale)}</td></tr>
                  </tbody>
                </table>
              </>
            )}

            {stima?.prezziarioNota && (
              <p className="nota"><b>Fonti valori/prezzi:</b> {stima.prezziarioNota}</p>
            )}
            {stima?.note && (
              <p className="nota"><b>Note tecniche:</b> {stima.note}</p>
            )}
          </>
        )}

        <div className="firma">
          <div>
            <div className="firma-label">Data e luogo</div>
            <div>{pratica.comune || '_______________'}, {fmtData(pratica.dataSopralluogo)}</div>
          </div>
          <div>
            <div className="firma-label">Firma del tecnico</div>
            <div>{pratica.tecnico || '_______________'}</div>
            <div className="linea-firma" />
          </div>
        </div>
      </div>

      <style>{`
        .barra-relazione {
          background: var(--verde);
          color: #fff;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .indietro-relazione {
          color: #fff;
          font-size: 26px;
          font-weight: 800;
          text-decoration: none;
          line-height: 1;
        }
        .link-relazione {
          color: #fff;
          font-weight: 800;
          text-decoration: none;
          background: rgba(255,255,255,.18);
          border-radius: 8px;
          padding: 9px 11px;
        }
        .stampa-relazione {
          background: #fff;
          color: var(--verde);
          border: none;
          border-radius: 8px;
          padding: 10px 14px;
          font-weight: 900;
          font-size: 14px;
        }
        .pagina-stampa {
          max-width: 780px;
          margin: 0 auto;
          padding: 24px 20px 60px;
          background: #fff;
          color: #111;
          line-height: 1.45;
        }
        .eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.6px;
          color: #555;
          margin-bottom: 5px;
        }
        .titolo-sezione {
          font-size: 16px;
          font-weight: 900;
          color: #14532d;
          border-bottom: 2px solid #14532d;
          padding-bottom: 4px;
          margin: 24px 0 10px;
        }
        .sottotitolo {
          font-size: 14px;
          margin: 16px 0 7px;
        }
        .tabella-relazione {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .tabella-relazione th {
          background: #f3f4f6;
          padding: 6px 8px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: .04em;
          border-bottom: 2px solid #d1d5db;
        }
        .tabella-relazione td {
          padding: 6px 8px;
          border-bottom: 1px solid #e5e7eb;
          vertical-align: top;
        }
        .tabella-relazione .totale td,
        .riepilogo-finale .totale td {
          font-weight: 900;
          color: #14532d;
          border-top: 2px solid #14532d;
        }
        .nota {
          font-size: 13px;
          color: #444;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 9px 10px;
          margin-top: 12px;
        }
        .box-vuoto {
          padding: 20px;
          text-align: center;
          color: #666;
          border: 2px dashed #d1d5db;
          border-radius: 12px;
        }
        .box-vuoto a {
          color: #14532d;
          font-weight: 800;
        }
        .firma {
          margin-top: 42px;
          border-top: 1px solid #ccc;
          padding-top: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        .firma-label {
          font-size: 12px;
          color: #777;
          margin-bottom: 6px;
        }
        .linea-firma {
          margin-top: 32px;
          border-top: 1px solid #999;
          width: 190px;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .pagina-stampa { padding: 18mm; max-width: 100%; }
          .titolo-sezione { break-after: avoid; }
          table { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}

function TabellaRighe({ righe, totale }: { righe: RigaEstimo[]; totale: number }) {
  if (righe.length === 0) {
    return <p className="nota">Nessuna voce valorizzata in questa sezione.</p>;
  }
  return (
    <table className="tabella-relazione">
      <thead>
        <tr><th>Voce</th><th>Formula</th><th style={{ textAlign: 'right' }}>Importo</th></tr>
      </thead>
      <tbody>
        {righe.map((r, i) => (
          <tr key={i}>
            <td>{r.voce.replace('[Patrimoniale] ', '').replace('[Reddituale] ', '')}</td>
            <td style={{ color: '#555', fontSize: 13 }}>{r.formula}</td>
            <td style={{ textAlign: 'right' }}>{euro(r.importo)}</td>
          </tr>
        ))}
        <tr className="totale">
          <td colSpan={2}>Subtotale</td>
          <td style={{ textAlign: 'right' }}>{euro(totale)}</td>
        </tr>
      </tbody>
    </table>
  );
}
