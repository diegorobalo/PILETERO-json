import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientCard from '../components/ClientCard';
import storageService from '../services/storage';
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

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let raf
    const start = performance.now()
    function step(now) {
      const t = Math.min((now - start) / duration, 1)
      setVal(Math.round((1 - Math.pow(1 - t, 3)) * target))
      if (t < 1) raf = requestAnimationFrame(step)
      else setVal(target)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
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
  const [menuWA, setMenuWA] = useState(null); // clienteId con menú WA abierto
  const [modalRuta, setModalRuta] = useState(null); // array de clientes para la ruta

  async function cargarDatos() {
    let apiOk = false;
    try {
      setLoading(true);
      await storageService.init();

      // Intentar desde la API primero (Turso es la fuente de verdad en la nube)
      let todos = [];
      try {
        const fromAPI = await apiClient.getClientes();
        apiOk = true;
        if (fromAPI.length > 0) {
          for (const cliente of fromAPI) {
            await storageService.saveCliente(cliente);
          }
          todos = fromAPI;
        }
      } catch {}
      setSyncStatus(apiOk ? 'online' : 'offline');

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

      // Cargar visitas del día desde la API, con fallback a IndexedDB
      let visitasHoy = [];
      try {
        visitasHoy = await apiClient.getVisitasByFecha(fecha) || [];
      } catch {
        const todasVisitas = await storageService.getAllVisitas();
        visitasHoy = todasVisitas.filter((v) => v.fecha === fecha);
      }

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
    return apiOk;
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

  function abrirWhatsApp(cliente, tipo) {
    if (!cliente.telefono) {
      toastError('Este cliente no tiene teléfono registrado');
      setMenuWA(null);
      return;
    }
    const defaults = {
      visita: 'Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!',
      reprogramado: 'Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.',
    };
    const clave = tipo === 'reprogramado' ? 'mensaje_whatsapp_reprogramado' : 'mensaje_whatsapp_visita';
    const mensaje = config[clave] || defaults[tipo];
    const interpolated = interpolateMensaje(mensaje, cliente);
    const link = generateWhatsAppLink(cliente.telefono, interpolated);
    if (link) window.open(link, '_blank');
    setMenuWA(null);
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const ok = await cargarDatos();
      if (ok) toastSuccess('Datos actualizados');
      else toastError('Sin conexión a la nube');
    } finally {
      setIsSyncing(false);
    }
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

  function abrirRutaMaps() {
    const pendientes = clientesDeHoy.filter(c => getClienteStatus(c.id) !== 'completado' && c.direccion);
    if (pendientes.length === 0) {
      toastInfo('¡Todas las visitas de hoy están completadas! 🎉');
      return;
    }
    setModalRuta(pendientes);
  }

  function confirmarRuta() {
    if (!modalRuta) return;
    const url = `https://www.google.com/maps/dir/${modalRuta.map(c => encodeURIComponent(c.direccion)).join('/')}`;
    window.open(url, '_blank');
    setModalRuta(null);
  }

  useEffect(() => {
    cargarDatos();
    const goOffline = () => setSyncStatus('offline');
    const onVisible = () => { if (document.visibilityState === 'visible') cargarDatos(); };
    window.addEventListener('online', cargarDatos);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    const intervalo = setInterval(cargarDatos, 60_000);
    return () => {
      window.removeEventListener('online', cargarDatos);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(intervalo);
    };
  }, []);

  const clientesDeHoy = todosClientes
    .filter((c) => c.estado === 'activo')
    .filter((c) => agendaIds.has(c.id));
  const clientesNoEnAgenda = todosClientes
    .filter((c) => c.estado === 'activo')
    .filter((c) => !agendaIds.has(c.id));

  const completadosHoy = getCompletedCount()
  const animTotal      = useCountUp(clientesDeHoy.length)
  const animHechos     = useCountUp(completadosHoy)
  const animPendientes = useCountUp(clientesDeHoy.length - completadosHoy)

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
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 relative">
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-start justify-between mb-0.5">
            <h1 className="text-2xl font-black text-white tracking-tight">Agenda del día</h1>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mt-0.5 ${
              syncStatus === 'online' ? 'bg-white/20 text-white' : 'bg-amber-400/30 text-amber-100'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === 'online' ? 'bg-green-300' : 'bg-amber-300'}`} />
              {syncStatus === 'online' ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
          <p className="text-sky-100 text-sm capitalize mb-2">{formatDateSpanish(fecha)}</p>
          {clientesDeHoy.length > 0 && (
            <>
              <div className="flex gap-2 mb-3">
                <div className="bg-white/20 rounded-xl flex-1 py-2 text-center">
                  <p className="text-white text-xl font-black leading-none">{animTotal}</p>
                  <p className="text-sky-100 text-xs mt-0.5">clientes</p>
                </div>
                <div className="bg-white/20 rounded-xl flex-1 py-2 text-center">
                  <p className="text-emerald-300 text-xl font-black leading-none">{animHechos}</p>
                  <p className="text-sky-100 text-xs mt-0.5">listos ✓</p>
                </div>
                <div className="bg-white/20 rounded-xl flex-1 py-2 text-center">
                  <p className="text-amber-200 text-xl font-black leading-none">{animPendientes}</p>
                  <p className="text-sky-100 text-xs mt-0.5">pendientes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-[width] duration-500"
                    style={{ width: clientesDeHoy.length ? `${(getCompletedCount() / clientesDeHoy.length) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-white text-xs font-bold whitespace-nowrap">
                  {getCompletedCount()}/{clientesDeHoy.length} listas
                </p>
              </div>
            </>
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
        <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 800 32" preserveAspectRatio="none" className="wave-anim absolute top-0 left-0 h-full" style={{width:'200%'}}>
            <path d="M0,16 C133,0 266,32 400,16 C533,0 666,32 800,16 L800,32 L0,32 Z" fill="white" fillOpacity="0.2"/>
            <path d="M0,22 C150,6 250,32 400,20 C550,8 650,32 800,22 L800,32 L0,32 Z" fill="white" fillOpacity="0.45"/>
          </svg>
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

        {/* Botón hoja de ruta */}
        {(() => {
          const paradasPendientes = clientesDeHoy.filter(c => getClienteStatus(c.id) !== 'completado' && c.direccion).length;
          return paradasPendientes > 0 ? (
            <button
              onClick={abrirRutaMaps}
              className="w-full flex items-center justify-center gap-2 py-3 bg-sky-600 text-white rounded-xl font-semibold text-sm mb-4 active:bg-sky-700 shadow-sm"
            >
              🗺️ Ver ruta en Maps · {paradasPendientes} {paradasPendientes === 1 ? 'parada' : 'paradas'}
            </button>
          ) : null;
        })()}

        {/* Lista de clientes */}
        {clientesDeHoy.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4 swim-float">🏊</div>
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
                  onWhatsApp={() => setMenuWA(menuWA === cliente.id ? null : cliente.id)}
                />
                {menuWA === cliente.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuWA(null)} />
                    <div className="absolute right-4 bottom-12 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-48">
                      <button
                        onClick={() => abrirWhatsApp(cliente, 'visita')}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-green-50 active:bg-green-100 flex items-center gap-2"
                      >
                        🏊 Voy hoy
                      </button>
                      <button
                        onClick={() => abrirWhatsApp(cliente, 'reprogramado')}
                        className="w-full px-4 py-3 text-left text-sm font-medium text-gray-800 hover:bg-orange-50 active:bg-orange-100 flex items-center gap-2 border-t border-gray-100"
                      >
                        📅 Reprogramando
                      </button>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <button
                    onClick={() => quitarCliente(cliente.id)}
                    className="text-xs text-gray-400 active:text-red-400 px-2 py-1.5 font-medium"
                  >
                    ✕ Quitar de hoy
                  </button>
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

      {/* Modal hoja de ruta */}
      {modalRuta && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setModalRuta(null)}>
          <div className="bottom-sheet bg-white rounded-t-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h2 className="text-lg font-bold text-gray-900">🗺️ Ruta de hoy</h2>
              <button onClick={() => setModalRuta(null)} className="text-gray-400 text-xl font-bold w-8 h-8 flex items-center justify-center">✕</button>
            </div>
            <p className="text-xs text-gray-400 px-6 pb-3">Las letras corresponden a las paradas en Google Maps</p>
            <div className="space-y-2 px-6 pb-4 max-h-72 overflow-y-auto">
              {modalRuta.map((cliente, i) => (
                <div key={cliente.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{cliente.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{cliente.direccion}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={confirmarRuta}
                className="w-full py-4 bg-sky-600 text-white font-bold rounded-xl text-base active:bg-sky-700"
              >
                Abrir en Google Maps →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de motivo para saltar */}
      {modalSaltar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bottom-sheet bg-white rounded-t-2xl w-full max-w-md p-6">
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
