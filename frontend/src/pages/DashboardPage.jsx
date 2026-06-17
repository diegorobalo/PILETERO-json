/**
 * DashboardPage - Desktop dashboard view
 * Displays summary statistics and recent visits
 * Data from IndexedDB storage service (no external fetching yet)
 */

import { useEffect, useState } from 'react';
import StatCard from '../components/StatCard.jsx';
import storageService from '../services/storage.js';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalClientes: 0,
    visitasHoy: 0,
    ingresosMes: '$0',
    pendienteCobro: '$0',
  });

  /**
   * Load statistics from IndexedDB storage
   * Calculates totals and formats currency values
   */
  const loadStats = async () => {
    try {
      // Get all data from storage
      const clientes = await storageService.getAllClientes();
      const visitas = await storageService.getAllVisitas();

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Filter visitas for today
      const visitasHoy = visitas.filter(visita => {
        const visitaDate = visita.fecha ? visita.fecha.split('T')[0] : null;
        return visitaDate === today;
      });

      // Calculate totals
      const totalClientes = clientes.length;
      const visitasTodayCount = visitasHoy.length;

      // Mock calculations for MVP
      // ingresosMes: sum of client abono prices or mock value
      // In real implementation, this would sum actual payments
      const ingresosMes = clientes.length * 5000;
      const pendienteCobro = clientes.length * 2000;

      // Format currency using Argentine Spanish locale
      const formatCurrency = (value) => {
        return value.toLocaleString('es-AR', {
          style: 'currency',
          currency: 'ARS',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      };

      setStats({
        totalClientes,
        visitasHoy: visitasTodayCount,
        ingresosMes: formatCurrency(ingresosMes),
        pendienteCobro: formatCurrency(pendienteCobro),
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  // Load stats on component mount
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">
          📊 Dashboard
        </h1>
      </div>

      {/* KPI Cards Grid - 2x2 layout */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Card 1: Clientes Activos */}
        <StatCard
          label="Clientes Activos"
          value={stats.totalClientes}
          icon="👥"
          color="blue"
        />

        {/* Card 2: Visitas Hoy */}
        <StatCard
          label="Visitas Hoy"
          value={stats.visitasHoy}
          icon="✓"
          color="green"
        />

        {/* Card 3: Ingresos Mes */}
        <StatCard
          label="Ingresos Mes"
          value={stats.ingresosMes}
          icon="💰"
          color="green"
        />

        {/* Card 4: Por Cobrar */}
        <StatCard
          label="Por Cobrar"
          value={stats.pendienteCobro}
          icon="⏳"
          color="yellow"
        />
      </div>

      {/* Recent Visits Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Últimas Visitas
        </h2>
        <p className="text-sm text-gray-400">
          Los datos aparecerán cuando sincronices desde el celular
        </p>
      </div>
    </div>
  );
}
