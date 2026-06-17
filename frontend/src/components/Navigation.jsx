import { useDeviceType } from '../hooks/useDeviceType';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Navigation - Responsive navigation component that adapts to device type
 *
 * Desktop: Fixed left sidebar (256px wide) with navigation links
 * Mobile: Fixed bottom bar with single "📅 Agenda" button
 *
 * Special behavior:
 * - Mobile: Navigation hidden on visit form page (/visita/:clienteId/:fecha)
 */
function Navigation() {
  const isMobile = useDeviceType();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide navigation on mobile visit form page
  if (isMobile && location.pathname.startsWith('/visita/')) {
    return null;
  }

  // Desktop Navigation - Left Sidebar
  if (!isMobile) {
    return (
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 p-6">
        {/* Logo/Title */}
        <div className="text-2xl font-bold mb-8">🏊 PILETERO</div>

        {/* Navigation Links */}
        <div className="space-y-2">
          {/* Dashboard Link */}
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full text-left p-3 rounded font-medium transition-colors ${
              location.pathname === '/dashboard'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📊 Dashboard
          </button>

          {/* Clients Link */}
          <button
            onClick={() => navigate('/clients')}
            className={`w-full text-left p-3 rounded font-medium transition-colors ${
              location.pathname === '/clients'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            👥 Clientes
          </button>

          {/* Finance Link */}
          <button
            onClick={() => navigate('/finance')}
            className={`w-full text-left p-3 rounded font-medium transition-colors ${
              location.pathname === '/finance'
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            💰 Finanzas
          </button>
        </div>
      </nav>
    );
  }

  // Mobile Navigation - Bottom Bar
  if (isMobile) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex gap-4 p-2">
        {/* Agenda Button */}
        <button
          onClick={() => navigate('/')}
          className={`flex-1 p-3 rounded font-medium transition-colors ${
            location.pathname === '/' || location.pathname === '/agenda'
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          📅 Agenda
        </button>
      </nav>
    );
  }

  return null;
}

export default Navigation;
