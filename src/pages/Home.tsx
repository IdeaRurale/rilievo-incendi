import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Schermo, Topbar } from '../components/Layout';

export default function Home() {
  const navigate = useNavigate();
  const pratiche = useLiveQuery(() => db.pratiche.orderBy('createdAt').reverse().toArray(), []);
  const lastUnitId = localStorage.getItem('ultimaUnita');
  const lastUnit = useLiveQuery(
    async () => (lastUnitId ? await db.unita.get(Number(lastUnitId)) : null),
    [lastUnitId]
  );

  async function creaDemo() {
    const id = await db.pratiche.add({
      titolo: 'Incendio fondo Catanzano',
      cliente: 'Azienda Agricola Demo',
      comune: 'Salve',
      localita: 'Contrada Catanzano',
      dataIncendio: '2026-07-01',
      dataSopralluogo: new Date().toISOString().slice(0, 10),
      tecnico: 'Dott. Agr. Ruggero Manca',
      note: '',
      createdAt: Date.now()
    });
    navigate(`/pratica/${id}`);
  }

  return (
    <>
      <Topbar titolo="Rilievo Incendi" azione={{ label: 'Classi', to: '/classi' }} />
      <Schermo>
        {lastUnit && (
          <Link to={`/unita/${lastUnit.id}`} className="btn btn-primario">
            ▶ RIPRENDI: {lastUnit.nome}
          </Link>
        )}
        <Link to="/pratica/nuova" className="btn btn-secondario">
          + NUOVA PRATICA
        </Link>

        {pratiche?.length === 0 && (
          <div className="vuoto">
            Nessuna pratica.
            <br />
            <br />
            <button className="btn btn-secondario" onClick={creaDemo} style={{ width: '100%' }}>
              CREA PRATICA DEMO
            </button>
          </div>
        )}

        {pratiche?.map((p) => (
          <Link key={p.id} to={`/pratica/${p.id}`} className="lista-voce">
            <div className="titolo">{p.titolo}</div>
            <div className="sotto">
              {[p.comune, p.localita].filter(Boolean).join(' — ')}
              {p.dataIncendio && ` · Incendio: ${fmtData(p.dataIncendio)}`}
            </div>
          </Link>
        ))}
      </Schermo>
    </>
  );
}

export function fmtData(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
