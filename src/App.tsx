import { HashRouter, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import PraticaForm from './pages/PraticaForm';
import PraticaDetail from './pages/PraticaDetail';
import UnitaForm from './pages/UnitaForm';
import UnitaPage from './pages/UnitaPage';
import DettaglioPianta from './pages/DettaglioPianta';
import Riepilogo from './pages/Riepilogo';
import { lazy, Suspense } from 'react';

const Mappa = lazy(() => import('./pages/Mappa'));
import ClassiSettings from './pages/ClassiSettings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pratica/nuova" element={<PraticaForm />} />
        <Route path="/pratica/:id/modifica" element={<PraticaForm />} />
        <Route path="/pratica/:id" element={<PraticaDetail />} />
        <Route path="/pratica/:praticaId/unita/nuova" element={<UnitaForm />} />
        <Route path="/unita/:id/modifica" element={<UnitaForm />} />
        <Route path="/unita/:id" element={<UnitaPage />} />
        <Route path="/unita/:unitaId/pianta/:piantaId" element={<DettaglioPianta />} />
        <Route path="/pratica/:id/riepilogo" element={<Riepilogo />} />
        <Route
          path="/pratica/:id/mappa"
          element={
            <Suspense fallback={<div className="vuoto">Caricamento mappa…</div>}>
              <Mappa />
            </Suspense>
          }
        />
        <Route path="/classi" element={<ClassiSettings />} />
      </Routes>
    </HashRouter>
  );
}
