import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db, type Classe, type Pianta, type Unita } from '../db';
import { useClassi } from '../lib/useClassi';
import { getGps } from '../lib/gps';
import { vibra } from '../lib/feedback';
import { computeSegmenti } from '../lib/stats';
import FotoInput from './FotoInput';

type Tab = 'censisci' | 'sequenza';

export default function Censimento({ unita }: { unita: Unita }) {
  const navigate = useNavigate();
  const classi = useClassi();
  const unitaId = unita.id!;
  const [tab, setTab] = useState<Tab>('censisci');
  const [flash, setFlash] = useState<{ key: number; testo: string } | null>(null);
  const [gpsInfo, setGpsInfo] = useState<string | null>(null);

  const piante = useLiveQuery(
    () => db.piante.where('unitaId').equals(unitaId).sortBy('numero'),
    [unitaId]
  );
  const nFoto = useLiveQuery(() => db.foto.where('unitaId').equals(unitaId).count(), [unitaId]);

  if (!piante) return null;

  const ultimaPianta = piante.length ? piante[piante.length - 1] : null;
  const maxNumero = piante.reduce((m, p) => Math.max(m, p.numero), 0);
  const prossimo = maxNumero + 1;
  const conte = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Classe, number>;
  for (const p of piante) conte[p.classe]++;

  function mostraFlash(testo: string) {
    setFlash({ key: Date.now(), testo });
  }

  async function registra(classe: Classe) {
    const numero = prossimo;
    const id = await db.piante.add({
      praticaId: unita.praticaId,
      unitaId,
      numero,
      classe,
      ts: Date.now()
    });
    vibra(classe === 4 ? 'distrutta' : 'ok');
    mostraFlash(`✓ N. ${numero} — ${classi[classe].nome}`);
    if (unita.gpsMode === 'ogni') {
      getGps().then((g) => {
        if (g) {
          db.piante.update(id, { lat: g.lat, lng: g.lng, accuracy: g.accuracy });
          setGpsInfo(`GPS ±${g.accuracy} m`);
        } else setGpsInfo('GPS non disponibile');
      });
    }
  }

  async function annullaUltima() {
    if (!ultimaPianta) return;
    await db.piante.delete(ultimaPianta.id!);
    vibra('errore');
    mostraFlash(`✗ Annullata N. ${ultimaPianta.numero}`);
  }

  async function salvaFoto(file: File) {
    const id = await db.foto.add({
      praticaId: unita.praticaId,
      unitaId,
      piantaId: ultimaPianta?.id,
      daNumero: ultimaPianta?.numero,
      aNumero: ultimaPianta?.numero,
      blob: file,
      ts: Date.now()
    });
    mostraFlash(ultimaPianta ? `📷 Foto → pianta ${ultimaPianta.numero}` : '📷 Foto salvata');
    getGps().then((g) => g && db.foto.update(id, { lat: g.lat, lng: g.lng, accuracy: g.accuracy }));
  }

  async function puntoGps() {
    if (!ultimaPianta) return;
    setGpsInfo('GPS…');
    const g = await getGps();
    if (g) {
      await db.piante.update(ultimaPianta.id!, { lat: g.lat, lng: g.lng, accuracy: g.accuracy });
      setGpsInfo(`GPS su N. ${ultimaPianta.numero} ±${g.accuracy} m`);
      mostraFlash(`📍 GPS → N. ${ultimaPianta.numero}`);
    } else {
      setGpsInfo('GPS non disponibile');
      vibra('errore');
    }
  }

  async function iniziaFilare() {
    const g = await getGps();
    await db.unita.update(unitaId, { gpsInizio: g ?? null, stato: 'in corso' });
    mostraFlash(g ? `▶ Inizio filare ±${g.accuracy} m` : '▶ Inizio filare (no GPS)');
  }

  async function fineFilare() {
    const g = await getGps();
    await db.unita.update(unitaId, { gpsFine: g ?? null, stato: 'completata' });
    mostraFlash(g ? `⏹ Fine filare ±${g.accuracy} m` : '⏹ Fine filare (no GPS)');
  }

  const lineare = unita.tipo === 'siepe' || unita.tipo === 'filare';

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header className="topbar">
        <Link to={`/pratica/${unita.praticaId}`} className="indietro" aria-label="Indietro">
          ‹
        </Link>
        <h1>{unita.nome}</h1>
        <Link to={`/unita/${unitaId}/modifica`} className="azione">
          ⚙
        </Link>
      </header>

      {lineare && (
        <div className="tabs" style={{ padding: '8px 12px 0' }}>
          <button className={tab === 'censisci' ? 'attivo' : ''} onClick={() => setTab('censisci')}>
            CENSISCI
          </button>
          <button className={tab === 'sequenza' ? 'attivo' : ''} onClick={() => setTab('sequenza')}>
            SEQUENZA
          </button>
        </div>
      )}

      {tab === 'censisci' ? (
        <div className="schermo-censimento">
          <div className="pianta-numero">
            Pianta n.
            <b>{prossimo}</b>
          </div>

          <div className="riepilogo-strip">
            <span style={{ color: 'var(--testo-sec)' }}>
              Censite: <b>{piante.length}</b>
              {unita.numeroTeorico ? ` / ${unita.numeroTeorico}` : ''}
            </span>
            {classi.map((c) => (
              <span
                key={c.codice}
                className={`chip${c.testoScuro ? ' testo-scuro' : ''}`}
                style={{ background: c.colore }}
              >
                {conte[c.codice]}
              </span>
            ))}
          </div>
          {gpsInfo && (
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--testo-sec)' }}>{gpsInfo}</div>
          )}

          {classi.map((c) => (
            <button
              key={c.codice}
              className={`classe-btn${c.testoScuro ? ' testo-scuro' : ''}`}
              style={{ background: c.colore }}
              onClick={() => registra(c.codice)}
            >
              <span>{c.nome}</span>
              <span className="conta">{conte[c.codice]}</span>
            </button>
          ))}

          {unita.tipo === 'filare' && unita.gpsMode === 'iniziofine' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-secondario" style={{ minHeight: 48, fontSize: 14 }} onClick={iniziaFilare}>
                ▶ INIZIA FILARE
              </button>
              <button className="btn btn-secondario" style={{ minHeight: 48, fontSize: 14 }} onClick={fineFilare}>
                ⏹ FINE FILARE
              </button>
            </div>
          )}

          <div className="barra-azioni">
            <button onClick={annullaUltima} disabled={!ultimaPianta} style={{ opacity: ultimaPianta ? 1 : 0.4 }}>
              <span className="icona">↩</span>ANNULLA
            </button>
            <FotoInput onFoto={salvaFoto}>
              <span className="icona">📷</span>FOTO{nFoto ? ` (${nFoto})` : ''}
            </FotoInput>
            {ultimaPianta ? (
              <Link to={`/unita/${unitaId}/pianta/${ultimaPianta.id}`}>
                <span className="icona">📝</span>DETTAGLIO
              </Link>
            ) : (
              <button disabled style={{ opacity: 0.4 }}>
                <span className="icona">📝</span>DETTAGLIO
              </button>
            )}
            {unita.gpsMode === 'punti' ? (
              <button onClick={puntoGps} disabled={!ultimaPianta} style={{ opacity: ultimaPianta ? 1 : 0.4 }}>
                <span className="icona">📍</span>GPS
              </button>
            ) : (
              <button onClick={() => navigate(`/pratica/${unita.praticaId}`)}>
                <span className="icona">⏸</span>PAUSA
              </button>
            )}
          </div>
          {unita.gpsMode === 'punti' && (
            <button
              className="btn btn-secondario"
              style={{ minHeight: 48, fontSize: 14 }}
              onClick={() => navigate(`/pratica/${unita.praticaId}`)}
            >
              ⏸ PAUSA — tutto è già salvato
            </button>
          )}
        </div>
      ) : (
        <Sequenza unita={unita} piante={piante} onFlash={mostraFlash} />
      )}

      {flash && (
        <div className="flash" key={flash.key}>
          {flash.testo}
        </div>
      )}
    </div>
  );
}

/* ---------- vista SEQUENZA (siepe/filare) ---------- */

function Sequenza({
  unita,
  piante,
  onFlash
}: {
  unita: Unita;
  piante: Pianta[];
  onFlash: (t: string) => void;
}) {
  const classi = useClassi();
  const [da, setDa] = useState('');
  const [a, setA] = useState('');
  const [classeSel, setClasseSel] = useState<Classe | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const teorico = unita.numeroTeorico ?? 0;
  const segmenti = computeSegmenti(piante, teorico);
  const totale = Math.max(teorico, piante.reduce((m, p) => Math.max(m, p.numero), 0));

  async function applica() {
    setErrore(null);
    const nDa = parseInt(da, 10);
    const nA = parseInt(a, 10);
    if (!nDa || !nA || nDa < 1 || nA < nDa) {
      setErrore('Intervallo non valido: controlla i numeri.');
      vibra('errore');
      return;
    }
    if (classeSel === null) {
      setErrore('Seleziona una classe di danno.');
      vibra('errore');
      return;
    }
    await db.transaction('rw', db.piante, async () => {
      const esistenti = await db.piante
        .where('unitaId')
        .equals(unita.id!)
        .and((p) => p.numero >= nDa && p.numero <= nA)
        .toArray();
      const perNumero = new Map(esistenti.map((p) => [p.numero, p]));
      for (let n = nDa; n <= nA; n++) {
        const ex = perNumero.get(n);
        if (ex) await db.piante.update(ex.id!, { classe: classeSel });
        else
          await db.piante.add({
            praticaId: unita.praticaId,
            unitaId: unita.id!,
            numero: n,
            classe: classeSel,
            ts: Date.now()
          });
      }
    });
    vibra(classeSel === 4 ? 'distrutta' : 'ok');
    onFlash(`✓ Piante ${nDa}–${nA} → ${classi[classeSel].nome}`);
    setDa('');
    setA('');
    setClasseSel(null);
  }

  return (
    <div className="contenuto">
      <div className="card">
        <h2>
          Rappresentazione lineare {totale > 0 && `(1–${totale})`}
        </h2>
        {totale === 0 ? (
          <div className="vuoto">Nessuna pianta ancora. Imposta il numero teorico o censisci.</div>
        ) : (
          <>
            <div className="barra-siepe">
              {segmenti.map((s, i) => (
                <div
                  key={i}
                  className="seg"
                  title={`${s.da}–${s.a}`}
                  style={{
                    width: `${((s.a - s.da + 1) / totale) * 100}%`,
                    background: s.classe === null ? '#e5e7eb' : classi[s.classe].colore
                  }}
                />
              ))}
            </div>
            <div className="seg-lista" style={{ marginTop: 10 }}>
              {segmenti.map((s, i) => (
                <div key={i}>
                  <span
                    className="pallino"
                    style={{ background: s.classe === null ? '#e5e7eb' : classi[s.classe].colore }}
                  />
                  <b>
                    {s.da === s.a ? s.da : `${s.da}–${s.a}`}
                  </b>{' '}
                  {s.classe === null ? 'non censite' : classi[s.classe].nome.toLowerCase()}
                  {` (${s.a - s.da + 1})`}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>Assegna classe a un intervallo</h2>
        <div className="riga-2" style={{ marginBottom: 10 }}>
          <div className="campo">
            <label>Da pianta n.</label>
            <input inputMode="numeric" value={da} onChange={(e) => setDa(e.target.value)} placeholder="35" />
          </div>
          <div className="campo">
            <label>A pianta n.</label>
            <input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} placeholder="62" />
          </div>
        </div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {classi.map((c) => (
            <button
              key={c.codice}
              type="button"
              className={classeSel === c.codice ? 'attivo' : ''}
              style={
                classeSel === c.codice
                  ? { background: c.colore, borderColor: c.colore, color: c.testoScuro ? '#1c1917' : '#fff' }
                  : {}
              }
              onClick={() => setClasseSel(c.codice)}
            >
              {c.nome}
            </button>
          ))}
        </div>
        {errore && <div className="avviso-errore" style={{ marginBottom: 10 }}>{errore}</div>}
        <button className="btn btn-primario" style={{ width: '100%' }} onClick={applica}>
          APPLICA ALL'INTERVALLO
        </button>
      </div>
    </div>
  );
}
