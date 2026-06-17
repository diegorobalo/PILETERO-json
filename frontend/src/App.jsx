import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useDeviceType } from './hooks/useDeviceType'
import Navigation from './components/Navigation'

// Mobile Pages (already implemented)
import AgendaPage from './pages/AgendaPage'
import VisitFormPage from './pages/VisitFormPage'

// Desktop Pages (placeholders for now)
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import FinancePage from './pages/FinancePage'

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
              <Route path="/visita/:clienteId/:fecha" element={<VisitFormPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // Desktop Routes
            <>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/finance" element={<FinancePage />} />
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
