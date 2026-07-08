import { useRef } from 'react';

/** Pulsante foto: apre la fotocamera, restituisce il file al padre. */
export default function FotoInput({
  onFoto,
  className,
  children
}: {
  onFoto: (file: File) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFoto(f);
          e.target.value = '';
        }}
      />
    </>
  );
}
