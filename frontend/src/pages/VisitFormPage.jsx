import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskChecklist from '../components/TaskChecklist';
import WaterMeasurement from '../components/WaterMeasurement';
import PhotoUpload from '../components/PhotoUpload';
import DosisCalculadora from '../components/DosisCalculadora';
import SelectorInsumo from '../components/SelectorInsumo';
import storageService from '../services/storage';
import { apiClient } from '../services/api';
import { toastError, toastWarn } from '../utils/toast';

export default function VisitFormPage() {
  const { clienteId, fecha } = useParams();
  const navigate = useNavigate();

  const DRAFT_KEY = `visita_draft_${clienteId}_${fecha}`;
  const draft = (() => { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {} } catch { return {} } })();

  const [cliente, setCliente] = useState(null);
  const [tasks, setTasks] = useState(draft.tasks || []);
  const [cloro, setCloro] = useState(draft.cloro ?? '');
  const [ph, setPh] = useState(draft.ph ?? '');
  const [quimicosUsados, setQuimicosUsados] = useState(draft.quimicosUsados || []);
  const [observaciones, setObservaciones] = useState(draft.observaciones || '');
  const [fotos, setFotos] = useState(draft.fotos || []);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadCliente() {
    try {
      setLoading(true);
      await storageService.init();

      const todasVisitas = await storageService.getAllVisitas();
      const visitaExistente = todasVisitas.find(
        (v) => v.cliente_id === parseInt(clienteId) && v.fecha === fecha
      );
      if (visitaExistente) {
        let clienteData = await storageService.getCliente(parseInt(clienteId));
        const fotosExistentes = await storageService.getFotosByVisita(visitaExistente.id);
        navigate('/reporte', {
          replace: true,
          state: {
            visita: {
              ...visitaExistente,
              cliente_nombre: clienteData?.nombre,
              cliente_direccion: clienteData?.direccion,
            },
            fotos: fotosExistentes,
          },
        });
        return;
      }

      let clienteData = await storageService.getCliente(parseInt(clienteId));
      if (!clienteData) {
        try { clienteData = await apiClient.getCliente(parseInt(clienteId)); } catch {}
      }

      if (!clienteData) {
        setError('Cliente no encontrado. Sincronizá la agenda primero.');
      } else {
        setCliente(clienteData);
      }
    } catch {
      setError('Error cargando cliente');
    } finally {
      setLoading(false);
    }
  }

  function handleMeasurementChange(key, value) {
    if (key === 'cloro') setCloro(value);
    else if (key === 'ph') setPh(value);
  }

  function handleAgregarInsumo(insumo) {
    setQuimicosUsados(prev => {
      const idx = prev.findIndex(q => q.insumo_id === insumo.insumo_id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], cantidad: parseFloat(updated[idx].cantidad) + parseFloat(insumo.cantidad) };
        return updated;
      }
      return [...prev, insumo];
    });
  }

  function handleEliminarInsumo(idx) {
    setQuimicosUsados(prev => prev.filter((_, i) => i !== idx));
  }

  function handleAddFoto(foto) {
    setFotos(prev => [...prev, foto]);
  }

  function handleRemoveFoto(index) {
    setFotos(prev => prev.filter((_, i) => i !== index));
  }

  function handleBack() {
    const hasData = tasks.length > 0 || cloro !== '' || ph !== '' || fotos.length > 0 || observaciones.trim() !== '';
    if (hasData && !window.confirm('¿Salir sin guardar? Perderás las mediciones ingresadas.')) return;
    sessionStorage.removeItem(DRAFT_KEY);
    navigate('/');
  }

  async function handleSaveVisit() {
    if ((cloro === '' || cloro === null) && (ph === '' || ph === null)) {
      toastWarn('Registrá al menos una medición (cloro o pH)');
      return;
    }

    try {
      setSaving(true);

      const visita = {
        cliente_id: parseInt(clienteId),
        fecha,
        hora_inicio: new Date().toISOString(),
        hora_fin: new Date().toISOString(),
        tareas_realizadas: tasks,
        cloro_ppm: cloro === '' ? null : parseFloat(cloro),
        ph: ph === '' ? null : parseFloat(ph),
        quimicos_usados: quimicosUsados,
        observaciones,
      };

      const visitaCreada = await apiClient.createVisita(visita);
      const visitaId = visitaCreada.id;

      const visitaParaReporte = {
        ...visita,
        id: visitaId,
        cliente_nombre: cliente.nombre,
        cliente_direccion: cliente.direccion,
      };
      sessionStorage.removeItem(DRAFT_KEY);
      navigate('/reporte', { state: { visita: visitaParaReporte, fotos } });
    } catch {
      toastError('Error al guardar la visita. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ tasks, cloro, ph, quimicosUsados, observaciones, fotos }));
    } catch {
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ tasks, cloro, ph, quimicosUsados, observaciones }));
      } catch {}
    }
  }, [tasks, cloro, ph, quimicosUsados, observaciones, fotos, loading]);

  useEffect(() => {
    loadCliente();
  }, [clienteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando cliente...</p>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 font-bold mb-4">{error || 'Cliente no encontrado'}</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-sky-600 text-white font-semibold rounded-xl">
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 pb-36">
      <div className="bg-gradient-to-br from-sky-700 to-cyan-600 sticky top-0 z-10 px-4 py-4">
        <h1 className="text-lg font-bold text-white truncate">{cliente.nombre}</h1>
        <p className="text-sky-100 text-sm mt-0.5 truncate">
          {cliente.direccion || 'Sin dirección'}
          {cliente.volumen_litros ? ` · ${Number(cliente.volumen_litros).toLocaleString('es-AR')} L` : ''}
        </p>
      </div>

      <div className="p-4">
        <TaskChecklist tasks={tasks} onChange={setTasks} />
        <WaterMeasurement cloro={cloro} ph={ph} onChange={handleMeasurementChange} />
        <DosisCalculadora
          volumenLitros={cliente.volumen_litros}
          cloroActual={cloro}
          phActual={ph}
        />

        {/* Lo que usaste */}
        <div className="mb-6">
          <h2 className="section-heading text-lg font-bold text-gray-900">Lo que usaste</h2>
          <p className="text-xs text-gray-400 mb-3">Agregá los insumos que aplicaste. Estos descuentan del stock.</p>
          {quimicosUsados.length > 0 ? (
            <div className="space-y-2 mb-3">
              {quimicosUsados.map((insumo, idx) => (
                <div key={insumo.insumo_id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <span className="flex-1 text-sm font-medium text-gray-800">{insumo.nombre}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={insumo.cantidad}
                    onChange={e => {
                      const updated = [...quimicosUsados];
                      updated[idx] = { ...updated[idx], cantidad: parseFloat(e.target.value) || 0 };
                      setQuimicosUsados(updated);
                    }}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                  />
                  <span className="text-xs text-gray-500 w-8">{insumo.unidad}</span>
                  <button onClick={() => handleEliminarInsumo(idx)} className="text-red-400 active:text-red-600 text-lg leading-none px-1">✕</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Sin insumos agregados aún</p>
          )}
          <SelectorInsumo onAgregarInsumo={handleAgregarInsumo} />
        </div>

        <PhotoUpload fotos={fotos} onAddFoto={handleAddFoto} onRemoveFoto={handleRemoveFoto} />

        <div className="mb-6">
          <h2 className="section-heading text-lg font-bold text-gray-900">Observaciones</h2>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej: Agua cristalina, mucha hoja por tormenta, etc."
            rows="5"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] p-4 space-y-2">
        <button
          onClick={handleSaveVisit}
          disabled={saving}
          className={`w-full px-4 py-4 font-bold text-white rounded-xl text-lg transition-all active:scale-[0.98] ${
            saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-sky-600 active:bg-sky-700'
          }`}
        >
          {saving ? 'Guardando...' : '✓ Terminar visita'}
        </button>
        <button
          onClick={handleBack}
          disabled={saving}
          className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}
