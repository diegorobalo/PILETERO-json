import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useDeviceType } from './hooks/useDeviceType'
import Navigation from './components/Navigation'

// Mobile Pages
import AgendaPage from './pages/AgendaPage'
import VisitFormPage from './pages/VisitFormPage'
import MobileClientesPage from './pages/MobileClientesPage'
import MobileInventarioPage from './pages/MobileInventarioPage'

// Desktop Pages
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import FinancePage from './pages/FinancePage'
import InventarioPage from './pages/InventarioPage'
import VisitasPage from './pages/VisitasPage'
import ReporteVisitaPage from './pages/ReporteVisitaPage'
import ReciboPagoPage from './pages/ReciboPagoPage'
import ConfiguracionPage from './pages/ConfiguracionPage'

/**
 * App - Main application component with conditional routing based on device type
 *
 * Routing Strategy:
 * - Mobile (width < 768px): Shows mobile-optimized routes (Agenda, Visit Form)
 * - Desktop (width >= 768px): Shows desktop routes (Dashboard, Clients, Finance)
 * - Device detection updates on window resize
 *
 * Layout:
 * - Desktop: Navigation sidebar (256px) + content area with margin-left
 * - Mobile: Navigation bottom bar + full-width content
 */
function App() {
  const isMobile = useDeviceType()

  return (
    <Router>
      <Navigation />
      <div className={isMobile ? '' : 'ml-64'}>
        <Routes>
          {isMobile ? (
            // Mobile Routes
            <>
              <Route path="/" element={<AgendaPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/clientes" element={<MobileClientesPage />} />
              <Route path="/inventario" element={<MobileInventarioPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/reporte" element={<ReporteVisitaPage />} />
              <Route path="/recibo" element={<ReciboPagoPage />} />
              <Route path="/visita/:clienteId/:fecha" element={<VisitFormPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // Desktop Routes
            <>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/visitas" element={<VisitasPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/inventario" element={<InventarioPage />} />
              <Route path="/reporte" element={<ReporteVisitaPage />} />
              <Route path="/recibo" element={<ReciboPagoPage />} />
              <Route path="/configuracion" element={<ConfiguracionPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  )
}

export default App
