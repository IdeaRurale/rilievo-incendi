import type { Classe, ClasseConfig } from '../db';

/** Grafico a barre orizzontali della distribuzione delle classi. */
export default function GraficoClassi({
  perClasse,
  classi
}: {
  perClasse: Record<Classe, number>;
  classi: ClasseConfig[];
}) {
  const max = Math.max(1, ...([0, 1, 2, 3, 4] as Classe[]).map((c) => perClasse[c]));
  return (
    <div className="grafico-classi">
      {classi.map((cfg) => (
        <div className="grafico-riga" key={cfg.codice}>
          <span>{cfg.nome}</span>
          <div className="traccia">
            <div
              className="barra"
              style={{
                width: `${(perClasse[cfg.codice] / max) * 100}%`,
                background: cfg.colore
              }}
            />
          </div>
          <span style={{ textAlign: 'right' }}>{perClasse[cfg.codice]}</span>
        </div>
      ))}
    </div>
  );
}
