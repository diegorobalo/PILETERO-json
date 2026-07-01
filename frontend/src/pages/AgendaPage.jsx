import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientCard from '../components/ClientCard';
import storageService from '../services/storage';
import syncService from '../services/sync';
import { apiClient } from '../services/api';
import { toastSuccess, toastError, toastInfo } from '../utils/toast';
import { interpolateMensaje, generateWhatsAppLink } from '../utils/messageInterpolation';

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

function clienteEsDeDate(cliente, dateStr) {
  const { dias_visita, frecuencia_visita, grupo_semana } = cliente;
  if (!dias_visita) return false;

  const d = new Date(dateStr + 'T00:00:00');
  const diaSemana = d.getDay();
  let diaOk = false;
  try {
    const arr = JSON.parse(dias_visita);
    if (Array.isArray(arr)) diaOk = arr.map(Number).includes(diaSemana);
  } catch {}
  if (!diaOk) {
    const variantes = DIAS[diaSemana] || [];
    diaOk = variantes.some((v) => dias_visita.toLowerCase().includes(v));
  }
  if (!diaOk) return false;

  if (frecuencia_visita === 'quincenal') {
    const semana = getISOWeek(d);
    const grupoActual = semana % 2 === 0 ? 'A' : 'B';
    return (grupo_semana || 'A') === grupoActual;
  }

  return true;
}

function getDiasSemana() {
  const hoy = new Date();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7)); // Lunes de esta semana
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d.toISOString().split('T')[0];
  });
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
  const [saltados, setSaltados] = useState({}); // { clienteId: motivo }
  const [modalSaltar, setModalSaltar] = useState(null); // clienteId
  const [motivoSaltar, setMotivoSaltar] = useState('cliente_ausente');
  const [vistaMode, setVistaMode] = useState('hoy'); // 'hoy' | 'semana'
  const [config, setConfigLocal] = useState({}); // WhatsApp config

  async function cargarDatos() {
    try {
      setLoading(true);
      await storageService.init();

      // Intentar desde la API primero (Turso es la fuente de verdad en la nube)
      let todos = [];
      try {
        const fromAPI = await apiClient.getClientes();
        if (fromAPI.length > 0) {
          for (const cliente of fromAPI) {
            await storageService.saveCliente(cliente);
          }
          todos = fromAPI;
        }
      } catch {}
      // Fallback a IndexedDB si la API no responde
      if (todos.length === 0) {
        todos = await storageService.getAllClientes();
        if (todos.length === 0) {
          try {
            const cached = JSON.parse(localStorage.getItem('piletero_clientes_cache') || '[]');
            if (cached.length > 0) todos = cached;
          } catch {}
        }
      }
      const todasVisitas = await storageService.getAllVisitas();
      const visitasHoy = todasVisitas.filter((v) => v.fecha === fecha);

      setTodosClientes(todos || []);
      setVisitas(visitasHoy || []);

      // Calcular agenda automática: clientes con visita programada hoy
      const idsAutoHoy = new Set(
        (todos || []).filter((c) => clienteEsDeDate(c, fecha)).map((c) => c.id)
      );

      // Restaurar overrides manuales del día (guardados en localStorage)
      const stored = localStorage.getItem(`agenda_${fecha}`);
      if (stored) {
        const { agregados = [], removidos = [], saltados = {} } = JSON.parse(stored);
        agregados.forEach((id) => idsAutoHoy.add(id));
        removidos.forEach((id) => idsAutoHoy.delete(id));
        setSaltados(saltados);
      } else {
        setSaltados({});
      }

      setAgendaIds(idsAutoHoy);

      // Load WhatsApp config
      try {
        const cfg = await apiClient.getConfiguracion();
        setConfigLocal(cfg);
      } catch (err) {
        console.warn('Could not load WhatsApp config:', err);
      }
    } catch (err) {
      console.error('Error cargando agenda:', err);
    } finally {
      setLoading(false);
    }
  }

  function guardarOverrides(newIds) {
    const stored = localStorage.getItem(`agenda_${fecha}`);
    const { saltados: prevSaltados = {} } = stored ? JSON.parse(stored) : {};

    // Clientes con visita hoy según días de visita
    const autoHoy = new Set(
      todosClientes.filter((c) => clienteEsDeDate(c, fecha)).map((c) => c.id)
    );

    const agregados = [...newIds].filter((id) => !autoHoy.has(id));
    const removidos = [...autoHoy].filter((id) => !newIds.has(id));

    // Si un cliente vuelve a estar en la agenda, ya no está "saltado"
    const saltados = { ...prevSaltados };
    newIds.forEach((id) => { delete saltados[id]; });

    localStorage.setItem(`agenda_${fecha}`, JSON.stringify({ agregados, removidos, saltados }));
    setSaltados(saltados);
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

  function saltarCliente() {
    const clienteId = modalSaltar;
    const stored = localStorage.getItem(`agenda_${fecha}`);
    const { agregados = [], removidos = [], saltados: prevSaltados = {} } = stored
      ? JSON.parse(stored)
      : {};

    const newIds = new Set(agendaIds);
    newIds.delete(clienteId);
    setAgendaIds(newIds);

    const nuevosSaltados = { ...prevSaltados, [clienteId]: motivoSaltar };
    setSaltados(nuevosSaltados);

    localStorage.setItem(`agenda_${fecha}`, JSON.stringify({
      agregados: agregados.filter((id) => id !== clienteId),
      removidos: [...new Set([...removidos, clienteId])],
      saltados: nuevosSaltados,
    }));

    setModalSaltar(null);
    setMotivoSaltar('cliente_ausente');
  }

  function abrirWhatsApp(cliente) {
    if (!cliente.telefono) {
      toastError('Este cliente no tiene teléfono registrado');
      return;
    }

    const mensaje = config.mensaje_whatsapp_visita ||
      'Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!';

    const interpolated = interpolateMensaje(mensaje, cliente);
    const link = generateWhatsAppLink(cliente.telefono, interpolated);

    if (link) {
      window.open(link, '_blank');
    }
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

  const clientesDeHoy = todosClientes
    .filter((c) => c.estado === 'activo')
    .filter((c) => agendaIds.has(c.id));
  const clientesNoEnAgenda = todosClientes
    .filter((c) => c.estado === 'activo')
    .filter((c) => !agendaIds.has(c.id));

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
          <button
            onClick={() => setVistaMode((v) => (v === 'hoy' ? 'semana' : 'hoy'))}
            className="px-3 py-2 bg-white/20 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
          >
            {vistaMode === 'hoy' ? '📅 Semana' : '📍 Hoy'}
          </button>
          {vistaMode === 'hoy' && clientesDeHoy.length > 0 && (
            <button
              onClick={() => setMostrarSelector(!mostrarSelector)}
              className="p-3 rounded-xl font-semibold text-white bg-white/20 active:bg-white/30 whitespace-nowrap text-sm"
            >
              + Agregar
            </button>
          )}
        </div>
      </div>

      {vistaMode === 'hoy' && (
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
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => abrirWhatsApp(cliente)}
                    className="bg-green-500 hover:bg-green-600 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-md transition"
                    title="Enviar WhatsApp"
                  >
                    💬
                  </button>
                  <button
                    onClick={() => quitarCliente(cliente.id)}
                    className="text-gray-300 hover:text-red-400 text-lg leading-none px-2"
                    title="Quitar de la agenda de hoy"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex justify-end mt-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setModalSaltar(cliente.id); }}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-xl font-medium active:bg-gray-200"
                  >
                    Saltar
                  </button>
                </div>
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

        {/* Clientes saltados hoy */}
        {Object.keys(saltados).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2 px-1">Saltados hoy</p>
            {Object.entries(saltados).map(([id, motivo]) => {
              const c = todosClientes.find((c) => String(c.id) === String(id));
              if (!c) return null;
              const motivoLabel = {
                cliente_ausente: 'Cliente ausente',
                lluvia: 'Lluvia',
                reagendado: 'Reagendado',
                otro: 'Otro',
              }[motivo] || motivo;
              return (
                <div key={id} className="bg-gray-50 rounded-xl px-4 py-3 mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-500">{c.nombre}</p>
                    <p className="text-xs text-gray-400">{motivoLabel}</p>
                  </div>
                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full">Saltado</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {vistaMode === 'semana' && (
        <div className="p-4 space-y-3">
          {getDiasSemana().map((dateStr) => {
            const clientesDia = todosClientes
              .filter((c) => c.estado === 'activo')
              .filter((c) => clienteEsDeDate(c, dateStr));
            const esHoy = dateStr === fecha;
            const d = new Date(dateStr + 'T00:00:00');
            const label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
            return (
              <div key={dateStr} className={`bg-white rounded-xl shadow-sm overflow-hidden ${esHoy ? 'ring-2 ring-sky-500' : ''}`}>
                <div className={`px-4 py-2 flex items-center justify-between ${esHoy ? 'bg-sky-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
                  <span className="font-semibold text-sm capitalize">{label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${esHoy ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                    {clientesDia.length} cliente{clientesDia.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {clientesDia.length > 0 && (
                  <div className="divide-y divide-gray-50">
                    {clientesDia.map((c) => (
                      <div key={c.id} className="px-4 py-2 text-sm text-gray-700 flex items-center justify-between">
                        <span className="font-medium">{c.nombre}</span>
                        <span className="text-gray-400 text-xs">{c.direccion}</span>
                      </div>
                    ))}
                  </div>
                )}
                {clientesDia.length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray-400">Sin visitas programadas</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de motivo para saltar */}
      {modalSaltar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">¿Por qué saltás esta visita?</h2>
            <div className="space-y-2 mb-6">
              {[
                ['cliente_ausente', 'Cliente ausente'],
                ['lluvia', 'Lluvia / mal tiempo'],
                ['reagendado', 'Reagendado para otro día'],
                ['otro', 'Otro motivo'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setMotivoSaltar(val)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${
                    motivoSaltar === val ? 'bg-sky-100 text-sky-700' : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={saltarCliente}
                className="flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl"
              >
                Confirmar
              </button>
              <button
                onClick={() => setModalSaltar(null)}
                className="px-6 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
