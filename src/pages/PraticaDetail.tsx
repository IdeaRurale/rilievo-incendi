import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { esportaPratica, scaricaCsv } from '../lib/exportImport';
import { db, UNITA_TIPI, type Classe, type Unita } from '../db';
import { Schermo, Topbar } from '../components/Layout';
import { useClassi } from '../lib/useClassi';
import { computeStats } from '../lib/stats';
import { fmtData } from './Home';

function MicroBarra({ unita, perClasse }: { unita: Unita; perClasse: Record<Classe, number> }) {
  const classi = useClassi();
  const tot = ([0, 1, 2, 3, 4] as Classe[]).reduce((s: number, c) => s + perClasse[c], 0);
  if (tot === 0) return null;
  return (
    <div className="barra-siepe" style={{ height: 10, marginTop: 8 }}>
      {classi.map((cfg) =>
        perClasse[cfg.codice] > 0 ? (
          <div
            key={cfg.codice}
            className="seg"
            style={{ width: `${(perClasse[cfg.codice] / tot) * 100}%`, background: cfg.colore }}
          />
        ) : null
      )}
    </div>
  );
}

export default function PraticaDetail() {
  const { id } = useParams();
  const praticaId = Number(id);
  const [msgExport, setMsgExport] = useState<string | null>(null);
  const classi = useClassi();
  const pratica = useLiveQuery(() => db.pratiche.get(praticaId), [praticaId]);
  const unitaList = useLiveQuery(
    () => db.unita.where('praticaId').equals(praticaId).sortBy('createdAt'),
    [praticaId]
  );
  const piante = useLiveQuery(() => db.piante.where('praticaId').equals(praticaId).toArray(), [praticaId]);

  if (!pratica || !unitaList || !piante) return null;

  const stats = computeStats(unitaList, piante, classi);
  const pianteByUnita = new Map<number, typeof piante>();
  for (const p of piante) {
    if (!pianteByUnita.has(p.unitaId)) pianteByUnita.set(p.unitaId, []);
    pianteByUnita.get(p.unitaId)!.push(p);
  }

  return (
    <>
      <Topbar titolo={pratica.titolo} indietro="/" azione={{ label: 'Modifica', to: `/pratica/${id}/modifica` }} />
      <Schermo>
        <div className="card">
          <div style={{ fontSize: 15, color: 'var(--testo-sec)', lineHeight: 1.6 }}>
            {pratica.cliente && <div><b>Cliente:</b> {pratica.cliente}</div>}
            {(pratica.comune || pratica.localita) && (
              <div><b>Luogo:</b> {[pratica.comune, pratica.localita].filter(Boolean).join(' — ')}</div>
            )}
            {pratica.dataIncendio && <div><b>Incendio:</b> {fmtData(pratica.dataIncendio)}</div>}
            {pratica.dataSopralluogo && <div><b>Sopralluogo:</b> {fmtData(pratica.dataSopralluogo)}</div>}
            {pratica.tecnico && <div><b>Tecnico:</b> {pratica.tecnico}</div>}
          </div>
        </div>

        <Link to={`/pratica/${id}/unita/nuova`} className="btn btn-primario">
          + NUOVA UNITÀ DI RILIEVO
        </Link>

        {unitaList.length === 0 && (
          <div className="vuoto">Nessuna unità. Crea una siepe, un filare, un gruppo…</div>
        )}

        {unitaList.map((u) => {
          const st = computeStats([u], pianteByUnita.get(u.id!) ?? [], classi);
          const tipoInfo = UNITA_TIPI.find((t) => t.value === u.tipo);
          return (
            <Link key={u.id} to={`/unita/${u.id}`} className="lista-voce">
              <div className="titolo">
                {tipoInfo?.icona} {u.nome}
              </div>
              <div className="sotto">
                {tipoInfo?.label}
                {u.specie && ` · ${u.specie}`}
                {' · '}
                Censite {st.censite}
                {st.teoriche > 0 && ` / ${st.teoriche}`}
              </div>
              <MicroBarra unita={u} perClasse={st.perClasse} />
            </Link>
          );
        })}

        {stats.censite > 0 && (
          <Link to={`/pratica/${id}/riepilogo`} className="btn btn-secondario">
            📊 RIEPILOGO ({stats.censite} piante)
          </Link>
        )}
        {stats.censite > 0 && (
          <Link to={`/pratica/${id}/stima`} className="btn btn-primario">
            💶 STIMA ECONOMICA / RELAZIONE TECNICA
          </Link>
        )}
        <Link to={`/pratica/${id}/mappa`} className="btn btn-secondario">
          🗺 MAPPA DEL RILIEVO
        </Link>
        <button
          className="btn btn-secondario"
          onClick={async () => {
            setMsgExport(null);
            try {
              await esportaPratica(praticaId);
              setMsgExport('✓ Rilievo esportato: condividilo o salvalo, poi importalo sull’altro dispositivo.');
            } catch (e) {
              setMsgExport(`Errore: ${(e as Error).message}`);
            }
          }}
        >
          📤 ESPORTA RILIEVO (per altro dispositivo)
        </button>
        <button
          className="btn btn-secondario"
          onClick={async () => {
            setMsgExport(null);
            try {
              await scaricaCsv(praticaId);
              setMsgExport('✓ CSV del censimento scaricato: si apre con Excel.');
            } catch (e) {
              setMsgExport(`Errore: ${(e as Error).message}`);
            }
          }}
        >
          📄 SCARICA CSV (Excel)
        </button>
        {msgExport && (
          <div className={msgExport.startsWith('✓') ? 'avviso-ok' : 'avviso-errore'}>{msgExport}</div>
        )}
      </Schermo>
    </>
  );
}
