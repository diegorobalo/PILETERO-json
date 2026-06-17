/**
 * VisitFormPage - Main registration form page for visit data
 * Allows tecnico to register visit data while at client's pool
 * Handles offline data storage and navigation
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskChecklist from '../components/TaskChecklist';
import WaterMeasurement from '../components/WaterMeasurement';
import PhotoUpload from '../components/PhotoUpload';
import storageService from '../services/storage';

export default function VisitFormPage() {
  const { clienteId, fecha } = useParams();
  const navigate = useNavigate();

  // State
  const [cliente, setCliente] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [cloro, setCloro] = useState('');
  const [ph, setPh] = useState('');
  const [fotos, setFotos] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Load cliente from storage on mount
   */
  async function loadCliente() {
    try {
      setLoading(true);
      await storageService.init();

      const clienteData = await storageService.getCliente(parseInt(clienteId));
      if (!clienteData) {
        setError('Cliente no encontrado');
      } else {
        setCliente(clienteData);
      }
    } catch (err) {
      console.error('Error loading cliente:', err);
      setError('Error cargando cliente');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Handle water measurement changes
   */
  function handleMeasurementChange(key, value) {
    if (key === 'cloro') {
      setCloro(value);
    } else if (key === 'ph') {
      setPh(value);
    }
  }

  /**
   * Handle adding a photo
   */
  function handleAddFoto(foto) {
    setFotos([...fotos, foto]);
  }

  /**
   * Validate and save the visit
   */
  async function handleSaveVisit() {
    // Validation: require at least one measurement
    if ((cloro === '' || cloro === null) && (ph === '' || ph === null)) {
      alert('⚠️ Por favor, registra al menos una medición (cloro o pH)');
      return;
    }

    try {
      setSaving(true);

      // Create visita object
      const visita = {
        cliente_id: parseInt(clienteId),
        fecha,
        hora_inicio: new Date().toISOString(),
        hora_fin: new Date().toISOString(),
        tareas_realizadas: tasks,
        cloro_ppm: cloro === '' || cloro === null ? null : parseFloat(cloro),
        ph: ph === '' || ph === null ? null : parseFloat(ph),
        quimicos_usados: {},
        observaciones,
        sincronizada: false,
      };

      // Save visita and get ID
      const visitaId = await storageService.saveVisita(visita);

      // Save all fotos
      for (const foto of fotos) {
        await storageService.saveFoto({
          visita_id: visitaId,
          tipo: foto.type,
          data: foto.data,
          timestamp: foto.timestamp.toISOString(),
        });
      }

      alert('✓ Visita registrada correctamente');
      navigate('/');
    } catch (err) {
      console.error('Error saving visit:', err);
      alert('❌ Error al guardar la visita. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  // Load cliente on mount
  useEffect(() => {
    loadCliente();
  }, [clienteId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-bold">{error || 'Cliente no encontrado'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-gray-300 text-gray-900 rounded"
          >
            ← Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 p-4">
        <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
        <p className="text-sm text-gray-600 mt-1">{cliente.direccion || 'Sin dirección'}</p>
      </div>

      {/* Form Content */}
      <div className="p-4">
        {/* Task Checklist */}
        <TaskChecklist tasks={tasks} onChange={setTasks} />

        {/* Water Measurements */}
        <WaterMeasurement cloro={cloro} ph={ph} onChange={handleMeasurementChange} />

        {/* Photo Upload */}
        <PhotoUpload fotos={fotos} onAddFoto={handleAddFoto} />

        {/* Observaciones */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Observaciones</h2>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Ej: Agua cristalina, mucha hoja por tormenta, etc."
            rows="6"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 space-y-2">
        {/* Submit Button */}
        <button
          onClick={handleSaveVisit}
          disabled={saving}
          className={`w-full px-4 py-4 font-bold text-white rounded text-lg transition-all active:scale-95 ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          ✅ Terminar Visita
        </button>

        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          disabled={saving}
          className="w-full px-4 py-3 bg-gray-300 text-gray-900 font-bold rounded transition-all active:scale-95 disabled:opacity-50"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}
