import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Topbar({
  titolo,
  indietro,
  azione
}: {
  titolo: string;
  indietro?: string;
  azione?: { label: string; to: string };
}) {
  return (
    <header className="topbar">
      {indietro && (
        <Link to={indietro} className="indietro" aria-label="Indietro">
          ‹
        </Link>
      )}
      <h1>{titolo}</h1>
      {azione && (
        <Link to={azione.to} className="azione">
          {azione.label}
        </Link>
      )}
    </header>
  );
}

export function Schermo({ children }: { children: ReactNode }) {
  return <main className="contenuto">{children}</main>;
}
