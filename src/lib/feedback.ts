/**
 * Feedback aptico. Nota: iOS Safari non supporta navigator.vibrate,
 * quindi l'app abbina sempre un feedback visivo (flash) alla vibrazione.
 */
export function vibra(tipo: 'ok' | 'distrutta' | 'errore') {
  const patterns: Record<string, number[]> = {
    ok: [30],
    distrutta: [60, 50, 60],
    errore: [150]
  };
  try {
    navigator.vibrate?.(patterns[tipo]);
  } catch {
    /* non supportato */
  }
}
