import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, type Foto, type Pianta, type Unita } from '../db';
import { Topbar } from '../components/Layout';
import { useClassi } from '../lib/useClassi';

type Base = 'mappa' | 'satellite';

export default function Mappa() {
  const { id } = useParams();
  const praticaId = Number(id);
  const classi = useClassi();
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ osm: L.TileLayer; sat: L.TileLayer } | null>(null);
  const [base, setBase] = useState<Base>('satellite');
  const [info, setInfo] = useState<{ conGps: number; senzaGps: number; nFoto: number } | null>(null);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const map = L.map(divRef.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    });
    const sat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' }
    );
    layersRef.current = { osm, sat };
    sat.addTo(map);

    (async () => {
      const [unitaList, piante, foto] = await Promise.all([
        db.unita.where('praticaId').equals(praticaId).toArray(),
        db.piante.where('praticaId').equals(praticaId).toArray(),
        db.foto.where('praticaId').equals(praticaId).toArray()
      ]);
      const nomeUnita = new Map(unitaList.map((u) => [u.id!, u.nome]));
      const bounds = L.latLngBounds([]);

      const conGps = piante.filter((p) => p.lat !== undefined && p.lng !== undefined);
      for (const p of conGps as Required<Pick<Pianta, 'lat' | 'lng'>>[] & Pianta[]) {
        const cfg = classi[p.classe];
        L.circleMarker([p.lat!, p.lng!], {
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: cfg.colore,
          fillOpacity: 0.95
        })
          .bindPopup(
            `<b>N. ${p.numero} — ${cfg.nome}</b><br>${nomeUnita.get(p.unitaId) ?? ''}` +
              (p.accuracy ? `<br>±${p.accuracy} m` : '')
          )
          .addTo(map);
        bounds.extend([p.lat!, p.lng!]);
      }

      for (const u of unitaList as Unita[]) {
        for (const [punto, label] of [
          [u.gpsInizio, '▶ Inizio'],
          [u.gpsFine, '⏹ Fine']
        ] as const) {
          if (punto) {
            L.marker([punto.lat, punto.lng], {
              icon: L.divIcon({
                className: '',
                html: `<div style="background:#14532d;color:#fff;border-radius:8px;padding:2px 7px;font-weight:800;font-size:12px;white-space:nowrap;border:2px solid #fff">${label}</div>`,
                iconAnchor: [20, 12]
              })
            })
              .bindPopup(`<b>${label} — ${u.nome}</b>`)
              .addTo(map);
            bounds.extend([punto.lat, punto.lng]);
          }
        }
      }

      const fotoGps = (foto as Foto[]).filter((f) => f.lat !== undefined && f.lng !== undefined);
      for (const f of fotoGps) {
        L.marker([f.lat!, f.lng!], {
          icon: L.divIcon({
            className: '',
            html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">📷</div>`,
            iconAnchor: [11, 11]
          })
        })
          .bindPopup(
            `<b>Foto</b>` +
              (f.daNumero !== undefined
                ? `<br>Piante ${f.daNumero === f.aNumero ? f.daNumero : `${f.daNumero}–${f.aNumero}`}`
                : '') +
              (f.nota ? `<br>${f.nota}` : '')
          )
          .addTo(map);
        bounds.extend([f.lat!, f.lng!]);
      }

      setInfo({ conGps: conGps.length, senzaGps: piante.length - conGps.length, nFoto: fotoGps.length });

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.25), { maxZoom: 19 });
      } else {
        // nessun punto: prova la posizione attuale, altrimenti Italia
        map.setView([41.9, 12.5], 5);
        navigator.geolocation?.getCurrentPosition(
          (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 17),
          () => {},
          { timeout: 5000 }
        );
      }
    })();

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [praticaId]);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    if (base === 'mappa') {
      map.removeLayer(layers.sat);
      layers.osm.addTo(map);
    } else {
      map.removeLayer(layers.osm);
      layers.sat.addTo(map);
    }
  }, [base]);

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Topbar titolo="Mappa del rilievo" indietro={`/pratica/${id}`} />
      <div className="tabs" style={{ padding: '8px 12px' }}>
        <button className={base === 'satellite' ? 'attivo' : ''} onClick={() => setBase('satellite')}>
          🛰 SATELLITE
        </button>
        <button className={base === 'mappa' ? 'attivo' : ''} onClick={() => setBase('mappa')}>
          🗺 MAPPA
        </button>
      </div>
      <div ref={divRef} style={{ flex: 1 }} />
      <div
        style={{
          padding: '8px 12px calc(8px + var(--safe-bottom))',
          background: 'var(--carta)',
          borderTop: '1px solid var(--bordo)'
        }}
      >
        <div className="riepilogo-strip" style={{ justifyContent: 'flex-start', marginBottom: 6 }}>
          {classi.map((c) => (
            <span key={c.codice} className={`chip${c.testoScuro ? ' testo-scuro' : ''}`} style={{ background: c.colore, fontSize: 12 }}>
              {c.nome}
            </span>
          ))}
        </div>
        {info && (
          <div style={{ fontSize: 13, color: 'var(--testo-sec)', fontWeight: 600 }}>
            {info.conGps} piante sulla mappa · {info.nFoto} foto
            {info.senzaGps > 0 && ` · ${info.senzaGps} piante senza GPS (non mostrate)`}
          </div>
        )}
      </div>
    </div>
  );
}
