import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, emptyConteggi, type Classe, type Unita } from '../db';
import { useClassi } from '../lib/useClassi';
import { vibra } from '../lib/feedback';
import FotoInput from './FotoInput';
import { getGps } from '../lib/gps';

type Tab = 'rapido' | 'modulo';

export default function Gruppo({ unita }: { unita: Unita }) {
  const navigate = useNavigate();
  const classi = useClassi();
  const unitaId = unita.id!;
  const [tab, setTab] = useState<Tab>('rapido');
  const [flash, setFlash] = useState<{ key: number; testo: string } | null>(null);

  const conteggi = unita.conteggi ?? emptyConteggi();
  const totaleContato = ([0, 1, 2, 3, 4] as Classe[]).reduce((s: number, c) => s + (conteggi[c] || 0), 0);

  function mostraFlash(testo: string) {
    setFlash({ key: Date.now(), testo });
  }

  async function cambia(classe: Classe, delta: 1 | -1) {
    const nuovo = { ...conteggi, [classe]: Math.max(0, (conteggi[classe] || 0) + delta) };
    if (delta === -1 && (conteggi[classe] || 0) === 0) {
      vibra('errore');
      return;
    }
    await db.unita.update(unitaId, { conteggi: nuovo });
    if (delta === 1) {
      vibra(classe === 4 ? 'distrutta' : 'ok');
      mostraFlash(`+1 ${classi[classe].nome}`);
    } else {
      vibra('errore');
      mostraFlash(`−1 ${classi[classe].nome}`);
    }
  }

  async function salvaFoto(file: File) {
    const id = await db.foto.add({
      praticaId: unita.praticaId,
      unitaId,
      blob: file,
      ts: Date.now(),
      nota: 'Foto di gruppo'
    });
    mostraFlash('📷 Foto di gruppo salvata');
    getGps().then((g) => g && db.foto.update(id, { lat: g.lat, lng: g.lng, accuracy: g.accuracy }));
  }

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

      <div className="tabs" style={{ padding: '8px 12px 0' }}>
        <button className={tab === 'rapido' ? 'attivo' : ''} onClick={() => setTab('rapido')}>
          CONTA RAPIDO
        </button>
        <button className={tab === 'modulo' ? 'attivo' : ''} onClick={() => setTab('modulo')}>
          MODULO
        </button>
      </div>

      {tab === 'rapido' ? (
        <div className="schermo-censimento">
          <div className="riepilogo-strip">
            <span style={{ color: 'var(--testo-sec)' }}>
              Totale: <b>{totaleContato}</b>
              {unita.numeroTeorico ? ` / ${unita.numeroTeorico}` : ''}
            </span>
            <span style={{ color: 'var(--testo-sec)', fontWeight: 500 }}>
              (tocco = +1, tieni premuto = −1)
            </span>
          </div>

          {classi.map((c) => (
            <ContaBtn
              key={c.codice}
              nome={c.nome}
              colore={c.colore}
              testoScuro={!!c.testoScuro}
              valore={conteggi[c.codice] || 0}
              onPiu={() => cambia(c.codice, 1)}
              onMeno={() => cambia(c.codice, -1)}
            />
          ))}

          <div className="barra-azioni" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <FotoInput onFoto={salvaFoto}>
              <span className="icona">📷</span>FOTO GRUPPO
            </FotoInput>
            <button onClick={() => navigate(`/pratica/${unita.praticaId}`)}>
              <span className="icona">⏸</span>PAUSA
            </button>
          </div>
        </div>
      ) : (
        <Modulo unita={unita} onFlash={mostraFlash} />
      )}

      {flash && (
        <div className="flash" key={flash.key}>
          {flash.testo}
        </div>
      )}
    </div>
  );
}

/** Pulsante con contatore: tocco = +1, pressione lunga (550 ms) = −1. */
function ContaBtn({
  nome,
  colore,
  testoScuro,
  valore,
  onPiu,
  onMeno
}: {
  nome: string;
  colore: string;
  testoScuro: boolean;
  valore: number;
  onPiu: () => void;
  onMeno: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);

  function giu() {
    longFired.current = false;
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      onMeno();
    }, 550);
  }
  function su() {
    if (timer.current) clearTimeout(timer.current);
    if (!longFired.current) onPiu();
  }
  function annulla() {
    if (timer.current) clearTimeout(timer.current);
  }

  return (
    <button
      className={`conta-btn${testoScuro ? ' testo-scuro' : ''}`}
      style={{ background: colore }}
      onPointerDown={giu}
      onPointerUp={su}
      onPointerLeave={annulla}
      onPointerCancel={annulla}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span>{nome}</span>
      <span className="numero">{valore}</span>
    </button>
  );
}

/** Inserimento diretto dei conteggi con verifica di coerenza col totale. */
function Modulo({ unita, onFlash }: { unita: Unita; onFlash: (t: string) => void }) {
  const classi = useClassi();
  const conteggi = unita.conteggi ?? emptyConteggi();
  const [valori, setValori] = useState<Record<Classe, string>>({
    0: String(conteggi[0] || 0),
    1: String(conteggi[1] || 0),
    2: String(conteggi[2] || 0),
    3: String(conteggi[3] || 0),
    4: String(conteggi[4] || 0)
  });
  const [totale, setTotale] = useState(unita.numeroTeorico ? String(unita.numeroTeorico) : '');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  const somma = ([0, 1, 2, 3, 4] as Classe[]).reduce((s: number, c) => s + (parseInt(valori[c], 10) || 0), 0);
  const nTotale = parseInt(totale, 10) || 0;
  const incoerente = totale !== '' && somma !== nTotale;

  async function salva() {
    if (incoerente) {
      setMsg({
        tipo: 'errore',
        testo: `I conteggi non coincidono: somma classi = ${somma}, totale dichiarato = ${nTotale}.`
      });
      vibra('errore');
      return;
    }
    const nuovi = emptyConteggi();
    for (const c of [0, 1, 2, 3, 4] as Classe[]) nuovi[c] = parseInt(valori[c], 10) || 0;
    await db.unita.update(unita.id!, {
      conteggi: nuovi,
      numeroTeorico: totale !== '' ? nTotale : unita.numeroTeorico
    });
    setMsg({ tipo: 'ok', testo: `Salvato: ${somma} piante registrate.` });
    vibra('ok');
    onFlash('✓ Conteggi salvati');
  }

  return (
    <div className="contenuto">
      <div className="card">
        <h2>Conteggi del gruppo</h2>
        <div className="campo" style={{ marginBottom: 10 }}>
          <label>Numero totale piante</label>
          <input inputMode="numeric" value={totale} onChange={(e) => setTotale(e.target.value)} />
        </div>
        {classi.map((c) => (
          <div className="campo" key={c.codice} style={{ marginBottom: 10 }}>
            <label>
              <span
                className="pallino"
                style={{
                  background: c.colore,
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  marginRight: 6
                }}
              />
              {c.nome}
            </label>
            <input
              inputMode="numeric"
              value={valori[c.codice]}
              onChange={(e) => setValori({ ...valori, [c.codice]: e.target.value })}
            />
          </div>
        ))}
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          Somma classi: {somma}
          {totale !== '' && ` / totale ${nTotale}`}
        </div>
        {incoerente && (
          <div className="avviso-errore" style={{ marginBottom: 10 }}>
            ⚠ La somma delle classi ({somma}) non coincide con il totale ({nTotale}).
          </div>
        )}
        {msg && (
          <div className={msg.tipo === 'ok' ? 'avviso-ok' : 'avviso-errore'} style={{ marginBottom: 10 }}>
            {msg.testo}
          </div>
        )}
        <button className="btn btn-primario" style={{ width: '100%' }} onClick={salva}>
          SALVA CONTEGGI
        </button>
      </div>
    </div>
  );
}
