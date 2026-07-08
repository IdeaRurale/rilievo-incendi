import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '../db';
import Censimento from '../components/Censimento';
import Gruppo from '../components/Gruppo';

/** Smista l'unità alla modalità giusta: gruppo → conta rapido, altrimenti censimento. */
export default function UnitaPage() {
  const { id } = useParams();
  const unitaId = Number(id);
  const unita = useLiveQuery(() => db.unita.get(unitaId), [unitaId]);

  useEffect(() => {
    if (unita) localStorage.setItem('ultimaUnita', String(unitaId));
  }, [unita, unitaId]);

  if (!unita) return null;
  if (unita.tipo === 'gruppo') return <Gruppo unita={unita} />;
  return <Censimento unita={unita} />;
}
