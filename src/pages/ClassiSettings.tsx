import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, DEFAULT_CLASSI, ESITI, type ClasseConfig } from '../db';
import { Schermo, Topbar } from '../components/Layout';
import { saveClassi } from '../lib/useClassi';
import { vibra } from '../lib/feedback';

export default function ClassiSettings() {
  const navigate = useNavigate();
  const [classi, setClassi] = useState<ClasseConfig[]>(DEFAULT_CLASSI);

  useEffect(() => {
    db.settings.get('classi').then((s) => {
      if (s?.value) setClassi(s.value as ClasseConfig[]);
    });
  }, []);

  function aggiorna(i: number, patch: Partial<ClasseConfig>) {
    setClassi(classi.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function salva() {
    await saveClassi(classi);
    vibra('ok');
    navigate(-1);
  }

  return (
    <>
      <Topbar titolo="Classi di danno" indietro="/" />
      <Schermo>
        <div className="card" style={{ fontSize: 14, color: 'var(--testo-sec)' }}>
          Gli intervalli percentuali sono indicativi e personalizzabili: non sono automaticamente validi per
          tutte le specie. L'esito predefinito si applica quando il tecnico non forza un esito sulla pianta.
        </div>

        {classi.map((c, i) => (
          <div className="card" key={c.codice} style={{ borderLeft: `8px solid ${c.colore}` }}>
            <div className="riga-2">
              <div className="campo">
                <label>Nome (classe {c.codice})</label>
                <input value={c.nome} onChange={(e) => aggiorna(i, { nome: e.target.value.toUpperCase() })} />
              </div>
              <div className="campo">
                <label>Colore</label>
                <input
                  type="color"
                  value={c.colore}
                  style={{ height: 49, padding: 4 }}
                  onChange={(e) => aggiorna(i, { colore: e.target.value })}
                />
              </div>
            </div>
            <div className="campo" style={{ marginTop: 8 }}>
              <label>Descrizione</label>
              <input value={c.descrizione} onChange={(e) => aggiorna(i, { descrizione: e.target.value })} />
            </div>
            <div className="riga-2" style={{ marginTop: 8 }}>
              <div className="campo">
                <label>% min</label>
                <input
                  inputMode="numeric"
                  value={c.pctMin}
                  onChange={(e) => aggiorna(i, { pctMin: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
              <div className="campo">
                <label>% max</label>
                <input
                  inputMode="numeric"
                  value={c.pctMax}
                  onChange={(e) => aggiorna(i, { pctMax: parseInt(e.target.value, 10) || 0 })}
                />
              </div>
            </div>
            <div className="campo" style={{ marginTop: 8 }}>
              <label>Esito tecnico predefinito</label>
              <select value={c.esitoDefault} onChange={(e) => aggiorna(i, { esitoDefault: e.target.value as never })}>
                {ESITI.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}

        <button className="btn btn-primario" onClick={salva}>
          SALVA CLASSI
        </button>
        <button
          className="btn btn-secondario"
          onClick={() => setClassi(DEFAULT_CLASSI)}
        >
          RIPRISTINA PREDEFINITE
        </button>
      </Schermo>
    </>
  );
}
