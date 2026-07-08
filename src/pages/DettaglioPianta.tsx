import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, ESITI, type Classe, type DettaglioPianta as Dett, type Esito, type Pianta } from '../db';
import { Schermo, Topbar } from '../components/Layout';
import { useClassi } from '../lib/useClassi';
import { vibra } from '../lib/feedback';

const GRUPPI: { chiave: keyof Dett; titolo: string; opzioni: string[] }[] = [
  {
    chiave: 'chioma',
    titolo: 'Chioma',
    opzioni: ['Integra', 'Danno 1–10%', '11–25%', '26–50%', '51–75%', '76–100%']
  },
  {
    chiave: 'fogliame',
    titolo: 'Fogliame',
    opzioni: ['Integro', 'Disseccato', 'Bruciato', 'Consumato']
  },
  {
    chiave: 'fusto',
    titolo: 'Fusto / corteccia',
    opzioni: ['Integro', 'Danno localizzato', 'Danno su un lato', 'Danno esteso', 'Carbonizzazione completa']
  },
  {
    chiave: 'colletto',
    titolo: 'Colletto',
    opzioni: ['Integro', 'Danno lieve', 'Danno medio', 'Danno grave', 'Compromesso']
  },
  {
    chiave: 'recupero',
    titolo: 'Capacità di recupero',
    opzioni: ['Alta', 'Probabile', 'Incerta', 'Bassa', 'Nulla']
  }
];

export default function DettaglioPianta() {
  const { unitaId, piantaId } = useParams();
  const navigate = useNavigate();
  const classi = useClassi();
  const [pianta, setPianta] = useState<Pianta | null>(null);
  const [dett, setDett] = useState<Dett>({});
  const [classe, setClasse] = useState<Classe>(0);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    db.piante.get(Number(piantaId)).then((p) => {
      if (p) {
        setPianta(p);
        setDett(p.dettaglio ?? {});
        setClasse(p.classe);
        setEsito(p.esito ?? null);
        setNote(p.note ?? '');
      }
    });
  }, [piantaId]);

  if (!pianta) return null;

  const esitoRegola = classi[classe].esitoDefault;

  async function salva() {
    await db.piante.update(pianta!.id!, {
      dettaglio: dett,
      classe,
      esito,
      note: note || undefined
    });
    vibra('ok');
    navigate(`/unita/${unitaId}`);
  }

  return (
    <>
      <Topbar titolo={`Pianta n. ${pianta.numero}`} indietro={`/unita/${unitaId}`} />
      <Schermo>
        <div className="card">
          <h2>Classe di danno</h2>
          <div className="chips">
            {classi.map((c) => (
              <button
                key={c.codice}
                type="button"
                className={classe === c.codice ? 'attivo' : ''}
                style={
                  classe === c.codice
                    ? { background: c.colore, borderColor: c.colore, color: c.testoScuro ? '#1c1917' : '#fff' }
                    : {}
                }
                onClick={() => setClasse(c.codice)}
              >
                {c.nome}
              </button>
            ))}
          </div>
          {pianta.lat !== undefined && (
            <div style={{ fontSize: 13, color: 'var(--testo-sec)', marginTop: 8 }}>
              📍 {pianta.lat.toFixed(6)}, {pianta.lng?.toFixed(6)} (±{pianta.accuracy} m)
            </div>
          )}
        </div>

        {GRUPPI.map((g) => (
          <div className="card" key={g.chiave}>
            <h2>{g.titolo}</h2>
            <div className="chips">
              {g.opzioni.map((op) => (
                <button
                  key={op}
                  type="button"
                  className={dett[g.chiave] === op ? 'attivo' : ''}
                  onClick={() =>
                    setDett((prev) => ({ ...prev, [g.chiave]: prev[g.chiave] === op ? undefined : op }))
                  }
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="card">
          <h2>Esito tecnico</h2>
          <div style={{ fontSize: 14, color: 'var(--testo-sec)', marginBottom: 8 }}>
            Regola della classe: <b>{ESITI.find((e) => e.value === esitoRegola)?.label}</b>. Puoi forzare un
            esito diverso:
          </div>
          <div className="chips">
            <button type="button" className={esito === null ? 'attivo' : ''} onClick={() => setEsito(null)}>
              Segui la regola
            </button>
            {ESITI.map((e) => (
              <button
                key={e.value}
                type="button"
                className={esito === e.value ? 'attivo' : ''}
                onClick={() => setEsito(e.value)}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Note</h2>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <button className="btn btn-primario" onClick={salva}>
          SALVA E TORNA AL CENSIMENTO
        </button>
      </Schermo>
    </>
  );
}
