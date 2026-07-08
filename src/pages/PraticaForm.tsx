import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { Schermo, Topbar } from '../components/Layout';

const schema = z.object({
  titolo: z.string().min(1, 'Titolo obbligatorio'),
  cliente: z.string().optional(),
  comune: z.string().optional(),
  localita: z.string().optional(),
  dataIncendio: z.string().optional(),
  dataSopralluogo: z.string().optional(),
  tecnico: z.string().optional(),
  note: z.string().optional()
});
type FormData = z.infer<typeof schema>;

export default function PraticaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const modifica = id !== undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      dataSopralluogo: new Date().toISOString().slice(0, 10),
      tecnico: localStorage.getItem('tecnico') || ''
    }
  });

  useEffect(() => {
    if (modifica) {
      db.pratiche.get(Number(id)).then((p) => p && reset(p));
    }
  }, [id]);

  async function salva(data: FormData) {
    if (data.tecnico) localStorage.setItem('tecnico', data.tecnico);
    if (modifica) {
      await db.pratiche.update(Number(id), data);
      navigate(`/pratica/${id}`);
    } else {
      const nuovoId = await db.pratiche.add({ ...data, createdAt: Date.now() });
      navigate(`/pratica/${nuovoId}`, { replace: true });
    }
  }

  return (
    <>
      <Topbar titolo={modifica ? 'Modifica pratica' : 'Nuova pratica'} indietro={modifica ? `/pratica/${id}` : '/'} />
      <Schermo>
        <form onSubmit={handleSubmit(salva)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="campo">
            <label>Titolo *</label>
            <input {...register('titolo')} placeholder="Es. Incendio fondo Catanzano" />
            {errors.titolo && <span className="errore">{errors.titolo.message}</span>}
          </div>
          <div className="campo">
            <label>Cliente</label>
            <input {...register('cliente')} />
          </div>
          <div className="riga-2">
            <div className="campo">
              <label>Comune</label>
              <input {...register('comune')} />
            </div>
            <div className="campo">
              <label>Località</label>
              <input {...register('localita')} />
            </div>
          </div>
          <div className="riga-2">
            <div className="campo">
              <label>Data incendio</label>
              <input type="date" {...register('dataIncendio')} />
            </div>
            <div className="campo">
              <label>Data sopralluogo</label>
              <input type="date" {...register('dataSopralluogo')} />
            </div>
          </div>
          <div className="campo">
            <label>Tecnico</label>
            <input {...register('tecnico')} />
          </div>
          <div className="campo">
            <label>Note</label>
            <textarea rows={3} {...register('note')} />
          </div>
          <button type="submit" className="btn btn-primario">
            SALVA PRATICA
          </button>
        </form>
      </Schermo>
    </>
  );
}
