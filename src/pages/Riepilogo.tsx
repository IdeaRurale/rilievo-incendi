import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db, type Classe } from '../db';
import { Schermo, Topbar } from '../components/Layout';
import { useClassi } from '../lib/useClassi';
import { computeStats } from '../lib/stats';
import GraficoClassi from '../components/GraficoClassi';

function Stat({ etichetta, valore, percento, colore }: { etichetta: string; valore: number | string; percento?: number; colore?: string }) {
  return (
    <div className="stat">
      <div className="etichetta">{etichetta}</div>
      <div className="valore" style={colore ? { color: colore } : undefined}>
        {valore}
      </div>
      {percento !== undefined && <div className="percento">{percento.toLocaleString('it-IT')}%</div>}
    </div>
  );
}

export default function Riepilogo() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();
  const pratica = useLiveQuery(() => db.pratiche.get(praticaId), [praticaId]);
  const unitaList = useLiveQuery(() => db.unita.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const foto = useLiveQuery(() => db.foto.where('praticaId').equals(praticaId).toArray(), [praticaId]);
  const [urls, setUrls] = useState<{ url: string; cap: string }[]>([]);

  useEffect(() => {
    if (!foto) return;
    const list = foto.map((f) => ({
      url: URL.createObjectURL(f.blob),
      cap:
        f.daNumero !== undefined
          ? f.daNumero === f.aNumero
            ? `N. ${f.daNumero}`
            : `${f.daNumero}–${f.aNumero}`
          : f.nota ?? 'Foto'
    }));
    setUrls(list);
    return () => list.forEach((x) => URL.revokeObjectURL(x.url));
  }, [foto]);

  if (!pratica || !unitaList || !piante) return null;

  const s = computeStats(unitaList, piante, classi);
  const completo = s.teoriche > 0 && s.censite >= s.teoriche;

  return (
    <>
      <Topbar titolo="Riepilogo" indietro={`/pratica/${id}`} />
      <Schermo>
        <div className={completo ? 'avviso-ok' : 'card'} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900 }}>
            {completo ? '✅ RILIEVO COMPLETATO' : '⏳ RILIEVO IN CORSO'}
          </div>
          <div style={{ fontSize: 15, marginTop: 4 }}>{pratica.titolo}</div>
        </div>

        <div className="stat-grid">
          <Stat etichetta="Piante teoriche" valore={s.teoriche || '—'} />
          <Stat etichetta="Piante censite" valore={s.censite} />
          <Stat etichetta="Mancanti" valore={s.mancanti} />
          <Stat etichetta="Danno medio" valore={`${s.dannoMedio}%`} />
        </div>

        <div className="card">
          <h2>Distribuzione classi</h2>
          <GraficoClassi perClasse={s.perClasse} classi={classi} />
        </div>

        <div className="stat-grid">
          <Stat etichetta="Sane" valore={s.sane} colore={classi[0].colore} />
          <Stat etichetta="Danneggiate" valore={s.danneggiate} percento={s.pctDanneggiate} colore={classi[2].colore} />
          <Stat etichetta="Gravi" valore={s.gravi} percento={s.pctGravi} colore={classi[3].colore} />
          <Stat etichetta="Distrutte" valore={s.distrutte} percento={s.pctDistrutte} colore={classi[4].colore} />
          <Stat etichetta="Da monitorare" valore={s.daMonitorare} />
          <Stat etichetta="Da sostituire" valore={s.daSostituire} percento={s.pctSostituire} colore="var(--rosso)" />
        </div>

        <div className="card" style={{ fontSize: 14, color: 'var(--testo-sec)' }}>
          Gli esiti derivano dalle regole per classe (modificabili in <b>Classi</b>) e dagli esiti forzati
          manualmente sulle singole piante.
        </div>

        {urls.length > 0 && (
          <div className="card">
            <h2>Fotografie ({urls.length})</h2>
            <div className="foto-strip">
              {urls.map((f, i) => (
                <div className="foto-box" key={i}>
                  <img src={f.url} alt={f.cap} />
                  <span className="foto-cap">{f.cap}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Schermo>
    </>
  );
}
