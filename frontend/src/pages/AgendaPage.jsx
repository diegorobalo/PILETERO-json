/**
 * AgendaPage - Main mobile agenda view showing daily client schedule
 * Displays Fede's clients to visit with status tracking
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientCard from '../components/ClientCard';
import storageService from '../services/storage';
import syncService from '../services/sync';

export default function AgendaPage() {
  const navigate = useNavigate();

  // State
  const [clientes, setClientes] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [fecha, setFecha] = useState(getTodayDate());
  const [syncStatus, setSyncStatus] = useState('offline');
  const [loading, setLoading] = useState(true);

  /**
   * Get today's date in YYYY-MM-DD format
   */
  function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  /**
   * Load all clients and today's visits from storage
   */
  async function loadClientes() {
    try {
      // Initialize storage if not already done
      await storageService.init();

      // Load all clients
      const allClientes = await storageService.getAllClientes();

      // Load all visits and filter for today
      const allVisitas = await storageService.getAllVisitas();
      const todayVisitas = allVisitas.filter((v) => v.fecha === fecha);

      setClientes(allClientes || []);
      setVisitas(todayVisitas || []);
    } catch (error) {
      console.error('Error loading clientes:', error);
      setClientes([]);
      setVisitas([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Setup sync service listeners
   */
  function setupSync() {
    try {
      // Listen for connection status changes
      syncService.on('connected', () => {
        console.log('Sync service: connected');
        setSyncStatus('online');
      });

      syncService.on('disconnected', () => {
        console.log('Sync service: disconnected');
        setSyncStatus('offline');
      });

      syncService.on('offline', () => {
        console.log('Sync service: offline mode');
        setSyncStatus('offline');
      });

      // Initialize the sync service connection
      syncService.connect();
    } catch (error) {
      console.error('Error setting up sync:', error);
    }
  }

  /**
   * Get the status of a client's visit for today
   * @param {number} clienteId - The client ID to check
   * @returns {string} 'pendiente' | 'en progreso' | 'completado'
   */
  function getClienteStatus(clienteId) {
    const visita = visitas.find((v) => v.cliente_id === clienteId);

    if (!visita) {
      return 'pendiente';
    }

    if (visita.hora_fin) {
      return 'completado';
    }

    return 'en progreso';
  }

  /**
   * Get the scheduled time for a client
   * @param {object} cliente - The cliente object
   * @returns {string} Time string or 'Sin horario'
   */
  function getClienteTime(cliente) {
    // Get time from visita if exists, otherwise from client's dias_visita
    const visita = visitas.find((v) => v.cliente_id === cliente.id);

    if (visita && visita.hora_inicio) {
      return visita.hora_inicio;
    }

    if (cliente.dias_visita && Array.isArray(cliente.dias_visita)) {
      // dias_visita might contain scheduling info
      const todayVisita = cliente.dias_visita.find((dv) => dv.fecha === fecha);
      if (todayVisita && todayVisita.hora) {
        return todayVisita.hora;
      }
    }

    return 'Sin horario';
  }

  /**
   * Handle client card click - navigate to visit form
   */
  function handleStartVisita(clienteId) {
    navigate(`/visita/${clienteId}/${fecha}`);
  }

  /**
   * Format date to Spanish format
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {string} Formatted date like "martes, 17 de junio de 2026"
   */
  function formatDateSpanish(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    return date.toLocaleDateString('es-ES', options);
  }

  /**
   * Count completed visitas for today
   */
  function getCompletedCount() {
    return visitas.filter((v) => v.hora_fin).length;
  }

  // Load clients on mount
  useEffect(() => {
    loadClientes();
    setupSync();
  }, []);

  // Reload when date changes
  useEffect(() => {
    setFecha(getTodayDate());
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Cargando agenda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">📅 Agenda del Día</h1>
          <p className="text-sm text-gray-600 mt-1">
            {formatDateSpanish(fecha)}
          </p>
        </div>

        {/* Sync Status Badge */}
        <div className="px-4 pb-4">
          <div
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
              syncStatus === 'online'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {syncStatus === 'online' ? (
              <>
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
                ✓ Sincronizado
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-yellow-600 rounded-full mr-2"></span>
                ⚠️ Modo offline
              </>
            )}
          </div>
        </div>

        {/* Stats Line */}
        {clientes.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-sm text-gray-700 font-medium">
              {clientes.length} piscinas programadas •{' '}
              <span className="text-green-600 font-bold">
                {getCompletedCount()} completadas
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Client List or Empty State */}
      <div className="p-4">
        {clientes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No hay clientes cargados
            </h2>
            <p className="text-gray-600 text-sm">
              Sincroniza con la computadora para cargar la agenda
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((cliente) => (
              <ClientCard
                key={cliente.id}
                cliente={cliente}
                hora={getClienteTime(cliente)}
                estado={getClienteStatus(cliente.id)}
                onStart={handleStartVisita}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
