import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientCard from '../components/ClientCard';
import storageService from '../services/storage';
import syncService from '../services/sync';
import { toastSuccess, toastError, toastInfo } from '../utils/toast';

const DIAS = {
  0: ['domingo'],
  1: ['lunes'],
  2: ['martes'],
  3: ['miercoles', 'miércoles'],
  4: ['jueves'],
  5: ['viernes'],
  6: ['sabado', 'sábado'],
};

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function clienteEsDeHoy(cliente) {
  const { dias_visita, frecuencia_visita, grupo_semana } = cliente;
  if (!dias_visita) return false;

  const hoy = new Date().getDay();
  let diaOk = false;
  try {
    const arr = JSON.parse(dias_visita);
    if (Array.isArray(arr)) diaOk = arr.map(Number).includes(hoy);
  } catch {}
  if (!diaOk) {
    const variantes = DIAS[hoy] || [];
    diaOk = variantes.some((v) => dias_visita.toLowerCase().includes(v));
  }
  if (!diaOk) return false;

  if (frecuencia_visita === 'quincenal') {
    const semana = getISOWeek(new Date());
    const grupoActual = semana % 2 === 0 ? 'A' : 'B';
    return (grupo_semana || 'A') === grupoActual;
  }

  return true;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatDateSpanish(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const fecha = getTodayDate();

  const [todosClientes, setTodosClientes] = useState([]);
  const [agendaIds, setAgendaIds] = useState(new Set()); // IDs en la agenda de hoy
  const [visitas, setVisitas] = useState([]);
  const [syncStatus, setSyncStatus] = useState('offline');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  async function cargarDatos() {
    try {
      setLoading(true);
      await storageService.init();

      let todos = await storageService.getAllClientes();
      // Fallback a localStorage si IndexedDB está vacío
      if (todos.length === 0) {
        try {
          const cached = JSON.parse(localStorage.getItem('piletero_clientes_cache') || '[]');
          if (cached.length > 0) todos = cached;
        } catch {}
      }
      const todasVisitas = await storageService.getAllVisitas();
      const visitasHoy = todasVisitas.filter((v) => v.fecha === fecha);

      setTodosClientes(todos || []);
      setVisitas(visitasHoy || []);

      // Calcular agenda automática: clientes con visita programada hoy
      const idsAutoHoy = new Set(
        (todos || []).filter((c) => clienteEsDeHoy(c)).map((c) => c.id)
      );

      // Restaurar overrides manuales del día (guardados en localStorage)
      const stored = localStorage.getItem(`agenda_${fecha}`);
      if (stored) {
        const { agregados = [], removidos = [] } = JSON.parse(stored);
        agregados.forEach((id) => idsAutoHoy.add(id));
        removidos.forEach((id) => idsAutoHoy.delete(id));
      }

      setAgendaIds(idsAutoHoy);
    } catch (err) {
      console.error('Error cargando agenda:', err);
    } finally {
      setLoading(false);
    }
  }

  function guardarOverrides(newIds) {
    const stored = localStorage.getItem(`agenda_${fecha}`);
    const { agregados: prevAgregados = [], removidos: prevRemovidoss = [] } = stored
      ? JSON.parse(stored)
      : {};

    // Clientes con visita hoy según días de visita
    const autoHoy = new Set(
      todosClientes.filter((c) => clienteEsDeHoy(c)).map((c) => c.id)
    );

    const agregados = [...newIds].filter((id) => !autoHoy.has(id));
    const removidos = [...autoHoy].filter((id) => !newIds.has(id));

    localStorage.setItem(`agenda_${fecha}`, JSON.stringify({ agregados, removidos }));
  }

  function agregarCliente(clienteId) {
    const newIds = new Set(agendaIds);
    newIds.add(clienteId);
    setAgendaIds(newIds);
    guardarOverrides(newIds);
    setMostrarSelector(false);
  }

  function quitarCliente(clienteId) {
    if (!confirm('¿Quitar este cliente de la agenda de hoy?')) return;
    const newIds = new Set(agendaIds);
    newIds.delete(clienteId);
    setAgendaIds(newIds);
    guardarOverrides(newIds);
  }

  function setupSync() {
    syncService.on('connected', () => setSyncStatus('online'));
    syncService.on('disconnected', () => setSyncStatus('offline'));
    syncService.on('offline', () => setSyncStatus('offline'));
    syncService.connect();
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      await syncService.connect();
      const ok = await syncService.requestSync();
      if (ok) {
        await cargarDatos();
        try {
          const cached = JSON.parse(localStorage.getItem('piletero_clientes_cache') || '[]');
          toastSuccess(`Sincronización completada\n${cached.length} clientes guardados en el celular`);
        } catch {
          toastSuccess('Sincronización completada');
        }
      } else {
        toastError('No se pudo sincronizar. Verifica que la compu esté encendida.');
      }
    } catch {
      toastError('Error durante la sincronización');
    } finally {
      setIsSyncing(false);
    }
  }

  async function autoSync() {
    try {
      await syncService.connect();
      const ok = await syncService.requestSync();
      if (ok) {
        await cargarDatos();
        toastInfo('Sincronización automática completada');
      }
    } catch {}
  }

  function getClienteStatus(clienteId) {
    const visita = visitas.find((v) => v.cliente_id === clienteId);
    if (!visita) return 'pendiente';
    if (visita.hora_fin) return 'completado';
    return 'en progreso';
  }

  function getClienteTime(cliente) {
    const visita = visitas.find((v) => v.cliente_id === cliente.id);
    if (!visita?.hora_inicio) return '';
    try {
      const d = new Date(visita.hora_inicio);
      return `Visitado a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch { return ''; }
  }

  function getCompletedCount() {
    return visitas.filter((v) => v.hora_fin).length;
  }

  useEffect(() => {
    cargarDatos();
    setupSync();
    window.addEventListener('online', autoSync);
    return () => window.removeEventListener('online', autoSync);
  }, []);

  const clientesDeHoy = todosClientes.filter((c) => agendaIds.has(c.id));
  const clientesNoEnAgenda = todosClientes.filter((c) => !agendaIds.has(c.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando agenda...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-start justify-between mb-1">
            <h1 className="text-xl font-bold text-white">Agenda del día</h1>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              syncStatus === 'online' ? 'bg-white/20 text-white' : 'bg-amber-400/30 text-amber-100'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'online' ? 'bg-green-300' : 'bg-amber-300'}`} />
              {syncStatus === 'online' ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          <p className="text-sky-100 text-sm capitalize">{formatDateSpanish(fecha)}</p>
          {clientesDeHoy.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 bg-white/25 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all"
                  style={{ width: clientesDeHoy.length ? `${(getCompletedCount() / clientesDeHoy.length) * 100}%` : '0%' }}
                />
              </div>
              <p className="text-white text-xs font-bold whitespace-nowrap">
                {getCompletedCount()}/{clientesDeHoy.length} listas
              </p>
            </div>
          )}
        </div>

        {/* Sync button */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex-1 p-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
              isSyncing ? 'bg-white/40 text-white cursor-not-allowed' : 'bg-white text-sky-700 active:bg-sky-50'
            }`}
          >
            <span className={isSyncing ? 'animate-spin inline-block' : ''}>⟳</span>
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
          {clientesDeHoy.length > 0 && (
            <button
              onClick={() => setMostrarSelector(!mostrarSelector)}
              className="p-3 rounded-xl font-semibold text-white bg-white/20 active:bg-white/30 whitespace-nowrap text-sm"
            >
              + Agregar
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Selector para agregar clientes */}
        {mostrarSelector && clientesNoEnAgenda.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
            <p className="font-bold text-gray-800 mb-3">Agregar a la agenda de hoy:</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clientesNoEnAgenda.map((c) => (
                <button
                  key={c.id}
                  onClick={() => agregarCliente(c.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-sky-50 text-gray-800 active:bg-sky-100"
                >
                  {c.nombre}
                  {c.direccion && <span className="text-gray-400 text-sm ml-2">· {c.direccion}</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => setMostrarSelector(false)}
              className="mt-3 w-full text-sm text-gray-500 py-2"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Lista de clientes */}
        {clientesDeHoy.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏊</div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">
              {todosClientes.length === 0
                ? 'Sin clientes cargados'
                : 'Sin piscinas para hoy'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {todosClientes.length === 0
                ? 'Sincronizá con la computadora para cargar los clientes'
                : 'Podés agregar clientes manualmente'}
            </p>
            {todosClientes.length > 0 && (
              <button
                onClick={() => setMostrarSelector(true)}
                className="bg-sky-600 text-white font-bold py-3 px-8 rounded-xl"
              >
                + Agregar cliente a hoy
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {clientesDeHoy.map((cliente) => (
              <div key={cliente.id} className="relative">
                <ClientCard
                  cliente={cliente}
                  hora={getClienteTime(cliente)}
                  estado={getClienteStatus(cliente.id)}
                  onStart={(id) => navigate(`/visita/${id}/${fecha}`)}
                />
                <button
                  onClick={() => quitarCliente(cliente.id)}
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-400 text-lg leading-none px-2"
                  title="Quitar de la agenda de hoy"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              onClick={() => setMostrarSelector(true)}
              className="w-full py-3 border-2 border-dashed border-sky-200 rounded-xl text-sky-500 text-sm font-semibold"
            >
              + Agregar otro cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
