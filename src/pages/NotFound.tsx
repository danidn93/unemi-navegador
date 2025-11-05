import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">404 — Página no encontrada</h1>
        <p className="mt-2 text-slate-600">La ruta que buscaste no existe.</p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link to="/" className="underline">Ir al panel</Link>
          <Link to="/navegador" className="underline">Ir al navegador público</Link>
        </div>
      </div>
    </div>
  );
}
