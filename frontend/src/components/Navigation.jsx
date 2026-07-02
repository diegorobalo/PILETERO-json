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
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <div className="text-xl font-black text-sky-700 mb-8 tracking-tight">🏊 PILETERO</div>

        <div className="space-y-1 flex-1">
          {[
            ['/dashboard',  '📊', 'Dashboard'],
            ['/clients',    '👥', 'Clientes'],
            ['/visitas',    '🗓️', 'Visitas'],
            ['/finance',    '💰', 'Finanzas'],
            ['/inventario', '📦', 'Inventario'],
            ['/configuracion', '⚙️', 'Config'],
          ].map(([path, icon, label]) => (
            <button key={path} onClick={() => navigate(path)}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-3 ${
                location.pathname === path
                  ? 'bg-sky-100 text-sky-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl mt-4 ${
          isOnline ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
        }`}>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? 'bg-green-500' : 'bg-amber-500'}`} />
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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] flex">
      {TABS.map(([path, icon, label]) => {
        const active = location.pathname === path || (path === '/' && location.pathname === '/agenda');
        return (
          <button key={path} onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center pt-2 pb-3 transition-colors">
            <span className={`text-2xl leading-tight px-3 py-1 rounded-xl transition-colors ${
              active ? 'bg-sky-100' : ''
            }`}>
              {icon}
            </span>
            <span className={`text-[10px] mt-0.5 ${active ? 'font-bold text-sky-600' : 'font-semibold text-gray-400'}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export default Navigation;
