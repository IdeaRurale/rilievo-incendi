import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db, esitoLabel, UNITA_TIPI, type Classe, type Foto, type Pianta } from '../db';
import { useClassi } from '../lib/useClassi';
import { computeStats, esitoEffettivo } from '../lib/stats';
import { generaVerbalePdf } from '../lib/verbalePdf';
import { fmtData } from './Home';

interface FotoUrl {
  foto: Foto;
  url: string;
  didascalia: string;
}

export default function Verbale() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();

  const pratica = useLiveQuery(() => db.pratiche.get(praticaId), [praticaId]);
  const unitaList = useLiveQuery(
    () => db.unita.where('praticaId').equals(praticaId).sortBy('createdAt'),
    [praticaId]
  );
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const foto = useLiveQuery(() => db.foto.where('praticaId').equals(praticaId).toArray(), [praticaId]);

  const [urls, setUrls] = useState<FotoUrl[]>([]);
  const [pdfStato, setPdfStato] = useState<'idle' | 'genero' | 'errore'>('idle');

  const nomeUnita = useMemo(
    () => new Map((unitaList ?? []).map((u) => [u.id!, u.nome])),
    [unitaList]
  );

  useEffect(() => {
    if (!foto) return;
    const list: FotoUrl[] = foto.map((f) => {
      const rif =
        f.piantaId !== undefined || f.daNumero !== undefined
          ? f.daNumero !== undefined && f.aNumero !== undefined && f.daNumero !== f.aNumero
            ? `Piante n. ${f.daNumero}–${f.aNumero}`
            : `Pianta n. ${f.daNumero ?? '—'}`
          : f.nota || 'Foto generale';
      const unitaNome = f.unitaId !== undefined ? nomeUnita.get(f.unitaId) : undefined;
      const didascalia = [unitaNome, rif].filter(Boolean).join(' — ');
      return { foto: f, url: URL.createObjectURL(f.blob), didascalia };
    });
    setUrls(list);
    return () => list.forEach((x) => URL.revokeObjectURL(x.url));
  }, [foto, nomeUnita]);

  if (!pratica || !unitaList || !piante || !foto) {
    return <div className="vuoto">Caricamento verbale…</div>;
  }

  const stats = computeStats(unitaList, piante, classi);

  // piante e foto raggruppate per unità
  const pianteByUnita = new Map<number, Pianta[]>();
  for (const p of piante) {
    if (!pianteByUnita.has(p.unitaId)) pianteByUnita.set(p.unitaId, []);
    pianteByUnita.get(p.unitaId)!.push(p);
  }
  const fotoByPianta = new Map<number, FotoUrl[]>();
  for (const fu of urls) {
    if (fu.foto.piantaId !== undefined) {
      if (!fotoByPianta.has(fu.foto.piantaId)) fotoByPianta.set(fu.foto.piantaId, []);
      fotoByPianta.get(fu.foto.piantaId)!.push(fu);
    }
  }

  const oggi = new Date().toLocaleDateString('it-IT');
  const luogo = pratica.comune || pratica.localita || '________';

  async function salvaPdf() {
    setPdfStato('genero');
    try {
      await generaVerbalePdf({ pratica: pratica!, unitaList: unitaList!, piante: piante!, foto: foto!, classi });
      setPdfStato('idle');
    } catch (e) {
      console.error(e);
      setPdfStato('errore');
    }
  }

  const dett = (p: Pianta): string => {
    if (!p.dettaglio) return '';
    return (
      [p.dettaglio.chioma, p.dettaglio.fogliame, p.dettaglio.fusto, p.dettaglio.colletto, p.dettaglio.recupero]
        .filter(Boolean)
        .join(' · ') || ''
    );
  };

  return (
    <div className="verbale-wrap">
      <div className="verbale-azioni no-print">
        <Link to={`/pratica/${id}`} className="btn btn-secondario" style={{ flex: 1 }}>
          ‹
        </Link>
        <button
          className="btn btn-primario"
          style={{ flex: 3 }}
          onClick={salvaPdf}
          disabled={pdfStato === 'genero'}
        >
          {pdfStato === 'genero' ? '⏳ Genero PDF…' : '📄 SCARICA PDF'}
        </button>
        <button
          className="btn btn-secondario"
          style={{ flex: 1 }}
          onClick={() => window.print()}
          title="Stampa dal browser"
        >
          🖨
        </button>
      </div>
      {pdfStato === 'errore' && (
        <div className="avviso-errore no-print" style={{ margin: '8px 12px' }}>
          ⚠ Non è stato possibile generare il PDF. Riprova, oppure usa il pulsante 🖨 (stampa del browser).
        </div>
      )}

      <article className="verbale">
        {/* ---------- Intestazione ---------- */}
        <header className="v-head">
          <div className="v-tecnico">{pratica.tecnico || 'Tecnico rilevatore'}</div>
          <h1>VERBALE DI SOPRALLUOGO</h1>
          <div className="v-sub">Rilievo dei danni da incendio alla vegetazione arborea</div>
        </header>

        {/* ---------- Dati generali ---------- */}
        <table className="v-dati">
          <tbody>
            <tr>
              <th>Pratica</th>
              <td>{pratica.titolo}</td>
              <th>Cliente</th>
              <td>{pratica.cliente || '—'}</td>
            </tr>
            <tr>
              <th>Comune</th>
              <td>{pratica.comune || '—'}</td>
              <th>Località</th>
              <td>{pratica.localita || '—'}</td>
            </tr>
            <tr>
              <th>Data incendio</th>
              <td>{fmtData(pratica.dataIncendio) || '—'}</td>
              <th>Data sopralluogo</th>
              <td>{fmtData(pratica.dataSopralluogo) || '—'}</td>
            </tr>
            <tr>
              <th>Tecnico</th>
              <td colSpan={3}>{pratica.tecnico || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* ---------- Premessa ---------- */}
        <section>
          <h2>1. Premessa e oggetto</h2>
          <p>
            In data {fmtData(pratica.dataSopralluogo) || oggi} il sottoscritto{' '}
            {pratica.tecnico || 'tecnico incaricato'} ha effettuato un sopralluogo presso il fondo sito in{' '}
            {luogo}
            {pratica.localita ? `, ${pratica.localita}` : ''}, al fine di rilevare e classificare i danni
            subiti dalla vegetazione arborea a seguito dell'incendio
            {pratica.dataIncendio ? ` del ${fmtData(pratica.dataIncendio)}` : ''}. Il presente verbale
            documenta le operazioni di censimento pianta per pianta, la classificazione del livello di danno
            e la documentazione fotografica raccolta in campo.
          </p>
          {pratica.note && (
            <p>
              <b>Note:</b> {pratica.note}
            </p>
          )}
        </section>

        {/* ---------- Metodologia ---------- */}
        <section>
          <h2>2. Metodologia di rilievo</h2>
          <p>
            Il censimento è stato condotto in campo mediante applicazione dedicata, con classificazione di
            ciascuna pianta in cinque classi di danno e registrazione, ove disponibile, della posizione GPS e
            di documentazione fotografica. Le classi adottate sono le seguenti:
          </p>
          <table className="v-tab">
            <thead>
              <tr>
                <th>Classe</th>
                <th>Descrizione</th>
                <th>Danno indicativo</th>
                <th>Esito tecnico predefinito</th>
              </tr>
            </thead>
            <tbody>
              {classi.map((c) => (
                <tr key={c.codice}>
                  <td>
                    <span className="v-chip" style={{ background: c.colore, color: c.testoScuro ? '#000' : '#fff' }}>
                      {c.nome}
                    </span>
                  </td>
                  <td>{c.descrizione}</td>
                  <td>
                    {c.pctMin}–{c.pctMax}%
                  </td>
                  <td>{esitoLabel(c.esitoDefault)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ---------- Riepilogo quantitativo ---------- */}
        <section>
          <h2>3. Riepilogo quantitativo</h2>
          <table className="v-tab">
            <tbody>
              <tr>
                <th>Piante teoriche</th>
                <td>{stats.teoriche || '—'}</td>
                <th>Piante censite</th>
                <td>{stats.censite}</td>
              </tr>
              <tr>
                <th>Sane</th>
                <td>{stats.sane}</td>
                <th>Danneggiate</th>
                <td>
                  {stats.danneggiate} ({stats.pctDanneggiate}%)
                </td>
              </tr>
              <tr>
                <th>Gravi</th>
                <td>
                  {stats.gravi} ({stats.pctGravi}%)
                </td>
                <th>Distrutte</th>
                <td>
                  {stats.distrutte} ({stats.pctDistrutte}%)
                </td>
              </tr>
              <tr>
                <th>Da monitorare</th>
                <td>{stats.daMonitorare}</td>
                <th>Da sostituire</th>
                <td>
                  {stats.daSostituire} ({stats.pctSostituire}%)
                </td>
              </tr>
              <tr>
                <th>Danno medio stimato</th>
                <td colSpan={3}>{stats.dannoMedio}%</td>
              </tr>
            </tbody>
          </table>
          <div className="v-distrib">
            {classi.map((c) => {
              const n = stats.perClasse[c.codice];
              const perc = stats.censite ? (n / stats.censite) * 100 : 0;
              return (
                <div className="v-distrib-riga" key={c.codice}>
                  <span className="v-distrib-nome">{c.nome}</span>
                  <span className="v-distrib-traccia">
                    <span className="v-distrib-barra" style={{ width: `${perc}%`, background: c.colore }} />
                  </span>
                  <span className="v-distrib-val">
                    {n} ({perc.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------- Dettaglio per unità ---------- */}
        <section>
          <h2>4. Dettaglio del rilievo per unità</h2>
          {unitaList.map((u, idx) => {
            const tipo = UNITA_TIPI.find((t) => t.value === u.tipo);
            const pu = (pianteByUnita.get(u.id!) ?? []).sort((a, b) => a.numero - b.numero);
            const uStats = computeStats([u], pu, classi);
            return (
              <div className="v-unita" key={u.id}>
                <h3>
                  4.{idx + 1} {u.nome} <span className="v-unita-tipo">({tipo?.label})</span>
                </h3>
                <p className="v-unita-meta">
                  {u.specie && (
                    <>
                      <b>Specie:</b> {u.specie}
                      {u.cultivar ? ` (${u.cultivar})` : ''} · {' '}
                    </>
                  )}
                  {u.numeroTeorico ? (
                    <>
                      <b>N. teorico:</b> {u.numeroTeorico} · {' '}
                    </>
                  ) : null}
                  {u.lunghezza ? (
                    <>
                      <b>Lunghezza:</b> {u.lunghezza} m · {' '}
                    </>
                  ) : null}
                  <b>Censite:</b> {uStats.censite}
                </p>

                {u.tipo === 'gruppo' && u.conteggi ? (
                  <table className="v-tab">
                    <thead>
                      <tr>
                        <th>Classe</th>
                        <th>N. piante</th>
                        <th>Esito</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classi.map((c) =>
                        (u.conteggi![c.codice] || 0) > 0 ? (
                          <tr key={c.codice}>
                            <td>
                              <span
                                className="v-chip"
                                style={{ background: c.colore, color: c.testoScuro ? '#000' : '#fff' }}
                              >
                                {c.nome}
                              </span>
                            </td>
                            <td>{u.conteggi![c.codice]}</td>
                            <td>{esitoLabel(c.esitoDefault)}</td>
                          </tr>
                        ) : null
                      )}
                    </tbody>
                  </table>
                ) : pu.length > 0 ? (
                  <table className="v-tab v-piante">
                    <thead>
                      <tr>
                        <th>N.</th>
                        <th>Classe</th>
                        <th>Esito tecnico</th>
                        <th>Dettaglio</th>
                        <th>GPS</th>
                        <th>Foto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pu.map((p) => {
                        const c = classi[p.classe];
                        const nf = fotoByPianta.get(p.id!)?.length ?? 0;
                        return (
                          <tr key={p.id}>
                            <td>{p.numero}</td>
                            <td>
                              <span
                                className="v-chip"
                                style={{ background: c.colore, color: c.testoScuro ? '#000' : '#fff' }}
                              >
                                {c.nome}
                              </span>
                            </td>
                            <td>{esitoLabel(esitoEffettivo(p, classi))}</td>
                            <td className="v-dett">{dett(p)}</td>
                            <td>{p.lat !== undefined ? `${p.lat.toFixed(5)}, ${p.lng!.toFixed(5)}` : '—'}</td>
                            <td>{nf > 0 ? `● ${nf}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="v-vuoto">Nessuna pianta censita in questa unità.</p>
                )}
                {u.note && (
                  <p className="v-unita-note">
                    <b>Note unità:</b> {u.note}
                  </p>
                )}
              </div>
            );
          })}
        </section>

        {/* ---------- Documentazione fotografica ---------- */}
        <section className="v-foto-sezione">
          <h2>5. Documentazione fotografica</h2>
          {urls.length === 0 ? (
            <p className="v-vuoto">Nessuna fotografia associata a questo rilievo.</p>
          ) : (
            <div className="v-foto-griglia">
              {urls.map((fu, i) => (
                <figure className="v-foto" key={i}>
                  <img src={fu.url} alt={fu.didascalia} />
                  <figcaption>
                    <b>Foto {i + 1}.</b> {fu.didascalia}
                    {fu.foto.lat !== undefined && (
                      <>
                        <br />
                        📍 {fu.foto.lat.toFixed(5)}, {fu.foto.lng!.toFixed(5)}
                        {fu.foto.accuracy ? ` (±${fu.foto.accuracy} m)` : ''}
                      </>
                    )}
                    <br />
                    {new Date(fu.foto.ts).toLocaleString('it-IT')}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Firma ---------- */}
        <section className="v-firma">
          <p>
            Il presente verbale, redatto in {luogo} il {oggi}, si compone di quanto sopra riportato e della
            documentazione fotografica allegata.
          </p>
          <div className="v-firma-blocco">
            <div>
              {luogo}, {oggi}
            </div>
            <div className="v-firma-riga">
              Il tecnico rilevatore
              <br />
              <br />
              {pratica.tecnico || '__________________________'}
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
