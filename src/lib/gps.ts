import type { GpsPoint } from '../db';

/** Legge la posizione senza bloccare il rilievo: risolve null se non disponibile. */
export function getGps(timeoutMs = 5000): Promise<GpsPoint | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    let done = false;
    const finish = (p: GpsPoint | null) => {
      if (!done) {
        done = true;
        resolve(p);
      }
    };
    const timer = setTimeout(() => finish(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
          ts: Date.now()
        });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 4000 }
    );
  });
}
