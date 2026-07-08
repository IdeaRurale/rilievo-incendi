import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_CLASSI, type ClasseConfig } from '../db';

/** Configurazione classi personalizzabile, con fallback ai default. */
export function useClassi(): ClasseConfig[] {
  const stored = useLiveQuery(async () => {
    const s = await db.settings.get('classi');
    return (s?.value as ClasseConfig[] | undefined) ?? null;
  }, []);
  return stored ?? DEFAULT_CLASSI;
}

export async function saveClassi(classi: ClasseConfig[]) {
  await db.settings.put({ key: 'classi', value: classi });
}
