import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { db, emptyConteggi, UNITA_TIPI, type GpsMode, type UnitaTipo } from '../db';
import { Schermo, Topbar } from '../components/Layout';

const numOpt = z.preprocess(
  (v) => {
    if (v === '' || v === undefined || v === null) return undefined;
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
    return Number.isNaN(n) ? undefined : n;
  },
  z.number().positive().optional()
);

const schema = z.object({
  nome: z.string().min(1, 'Nome obbligatorio'),
  specie: z.string().optional(),
  cultivar: z.string().optional(),
  eta: numOpt,
  annoImpianto: numOpt,
  numeroTeorico: numOpt,
  distanza: numOpt,
  sesto: z.string().optional(),
  lunghezza: numOpt,
  numeroFilare: numOpt,
  verso: z.string().optional(),
  note: z.string().optional()
});
type FormData = z.infer<typeof schema>;

const GPS_MODES: { value: GpsMode; label: string }[] = [
  { value: 'ogni', label: 'GPS ogni pianta' },
  { value: 'iniziofine', label: 'Solo inizio/fine' },
  { value: 'punti', label: 'Solo punti importanti' }
];

export default function UnitaForm() {
  const { praticaId, id } = useParams();
  const navigate = useNavigate();
  const modifica = id !== undefined;
  const [tipo, setTipo] = useState<UnitaTipo>('siepe');
  const [gpsMode, setGpsMode] = useState<GpsMode>('punti');
  const [pid, setPid] = useState<number>(Number(praticaId));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (modifica) {
      db.unita.get(Number(id)).then((u) => {
        if (u) {
          reset(u as unknown as FormData);
          setTipo(u.tipo);
          setGpsMode(u.gpsMode);
          setPid(u.praticaId);
        }
      });
    }
  }, [id]);

  // watch() restituisce stringhe grezze: gestisce la virgola decimale italiana
  const num = (v: unknown): number | null => {
    if (v === '' || v === undefined || v === null) return null;
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const lunghezza = num(watch('lunghezza'));
  const distanza = num(watch('distanza'));
  const teoricoCalcolato =
    (tipo === 'siepe' || tipo === 'filare') && lunghezza && distanza
      ? Math.round(lunghezza / distanza)
      : null;

  async function salva(data: FormData) {
    const record = {
      ...data,
      praticaId: pid,
      tipo,
      gpsMode,
      numeroTeorico: data.numeroTeorico ?? teoricoCalcolato ?? undefined
    };
    if (modifica) {
      await db.unita.update(Number(id), record);
      navigate(`/unita/${id}`);
    } else {
      const nuovoId = await db.unita.add({
        ...record,
        stato: 'in corso',
        conteggi: tipo === 'gruppo' ? emptyConteggi() : undefined,
        createdAt: Date.now()
      } as never);
      navigate(`/unita/${nuovoId}`, { replace: true });
    }
  }

  return (
    <>
      <Topbar
        titolo={modifica ? 'Modifica unità' : 'Nuova unità'}
        indietro={modifica ? `/unita/${id}` : `/pratica/${pid}`}
      />
      <Schermo>
        <form onSubmit={handleSubmit(salva)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="campo">
            <label>Tipo di unità</label>
            <div className="chips">
              {UNITA_TIPI.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={tipo === t.value ? 'attivo' : ''}
                  onClick={() => setTipo(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <label>Nome *</label>
            <input {...register('nome')} placeholder={tipo === 'siepe' ? 'Es. Siepe lato strada' : 'Es. Filare 3'} />
            {errors.nome && <span className="errore">{errors.nome.message}</span>}
          </div>

          <div className="riga-2">
            <div className="campo">
              <label>Specie</label>
              <input {...register('specie')} placeholder="Es. Cupressus semp." />
            </div>
            <div className="campo">
              <label>Cultivar</label>
              <input {...register('cultivar')} />
            </div>
          </div>

          <div className="riga-2">
            <div className="campo">
              <label>Età (anni)</label>
              <input inputMode="numeric" {...register('eta')} />
            </div>
            <div className="campo">
              <label>Anno impianto</label>
              <input inputMode="numeric" {...register('annoImpianto')} />
            </div>
          </div>

          {(tipo === 'siepe' || tipo === 'filare') && (
            <div className="riga-2">
              <div className="campo">
                <label>Lunghezza (m)</label>
                <input inputMode="decimal" {...register('lunghezza')} placeholder="114" />
              </div>
              <div className="campo">
                <label>Distanza piante (m)</label>
                <input inputMode="decimal" {...register('distanza')} placeholder="0,60" />
              </div>
            </div>
          )}

          {tipo === 'filare' && (
            <div className="riga-2">
              <div className="campo">
                <label>N. filare</label>
                <input inputMode="numeric" {...register('numeroFilare')} />
              </div>
              <div className="campo">
                <label>Verso di percorrenza</label>
                <input {...register('verso')} placeholder="Es. N→S" />
              </div>
            </div>
          )}

          <div className="riga-2">
            <div className="campo">
              <label>N. teorico piante</label>
              <input
                inputMode="numeric"
                {...register('numeroTeorico')}
                placeholder={teoricoCalcolato ? String(teoricoCalcolato) : ''}
              />
            </div>
            <div className="campo">
              <label>Sesto d'impianto</label>
              <input {...register('sesto')} placeholder="Es. 6×6" />
            </div>
          </div>

          {teoricoCalcolato && (
            <div className="avviso-ok">
              Numero teorico calcolato: <b>{teoricoCalcolato} piante</b> (
              {lunghezza?.toLocaleString('it-IT')} m ÷ {distanza?.toLocaleString('it-IT')} m)
              <button
                type="button"
                className="btn btn-secondario"
                style={{ marginTop: 8, width: '100%', minHeight: 44 }}
                onClick={() => setValue('numeroTeorico', teoricoCalcolato)}
              >
                USA {teoricoCalcolato}
              </button>
            </div>
          )}

          {tipo !== 'gruppo' && (
            <div className="campo">
              <label>Modalità GPS</label>
              <div className="chips">
                {GPS_MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={gpsMode === m.value ? 'attivo' : ''}
                    onClick={() => setGpsMode(m.value)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="campo">
            <label>Note</label>
            <textarea rows={2} {...register('note')} />
          </div>

          <button type="submit" className="btn btn-primario">
            {modifica ? 'SALVA MODIFICHE' : 'CREA E INIZIA'}
          </button>
        </form>
      </Schermo>
    </>
  );
}
