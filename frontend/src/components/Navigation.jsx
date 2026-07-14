import { useState, useEffect } from 'react';
import { useDeviceType } from '../hooks/useDeviceType';
import { useLocation, useNavigate } from 'react-router-dom';

function Navigation() {
  const isMobile = useDeviceType();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up   = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener('online',  up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  if (isMobile && (
    location.pathname.startsWith('/visita/') ||
    location.pathname === '/reporte' ||
    location.pathname === '/recibo'
  )) return null;

  if (!isMobile) {
    return (
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-sky-950 to-slate-900 p-6 flex flex-col shadow-2xl">
        <div className="text-xl font-black text-white mb-8 tracking-tight">🏊 PILETERO</div>

        <div className="space-y-1 flex-1">
          {[
            ['/dashboard',     '📊', 'Dashboard'],
            ['/clients',       '👥', 'Clientes'],
            ['/visitas',       '🗓️', 'Visitas'],
            ['/finance',       '💰', 'Finanzas'],
            ['/inventario',    '📦', 'Inventario'],
            ['/configuracion', '⚙️', 'Config'],
          ].map(([path, icon, label]) => (
            <button key={path} onClick={() => navigate(path)}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-3 ${
                location.pathname === path
                  ? 'bg-white/15 text-white'
                  : 'text-sky-200/60 hover:bg-white/8 hover:text-white'
              }`}>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl mt-4 ${
          isOnline ? 'bg-white/10 text-emerald-400' : 'bg-white/10 text-amber-400'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {isOnline ? 'Servidor conectado' : 'Sin conexión'}
        </div>
      </nav>
    );
  }

  const TABS = [
    ['/',           '📅', 'Agenda'],
    ['/clientes',   '👥', 'Clientes'],
    ['/historial',  '📋', 'Historial'],
    ['/finance',    '💰', 'Finanzas'],
    ['/inventario', '📦', 'Stock'],
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] flex">
      {TABS.map(([path, icon, label]) => {
        const active = location.pathname === path || (path === '/' && location.pathname === '/agenda');
        return (
          <button key={path} onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center pt-2 pb-3 transition-colors">
            <span className={`text-2xl leading-tight px-3 py-1 rounded-xl transition-colors ${
              active ? 'bg-sky-600' : ''
            }`}>
              {icon}
            </span>
            <span className={`text-[10px] mt-0.5 font-bold ${active ? 'text-sky-600' : 'text-gray-400'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default Navigation;
