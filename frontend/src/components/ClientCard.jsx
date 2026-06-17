/**
 * ClientCard - Display single client in agenda list
 * Shows client name, address, time, and status with color coding
 */

export default function ClientCard({ cliente, hora, estado, onStart }) {
  // Determine background color based on status
  const getBackgroundColor = () => {
    switch (estado) {
      case 'completado':
        return 'bg-green-100 border-green-300';
      case 'en progreso':
        return 'bg-yellow-100 border-yellow-300';
      case 'pendiente':
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  // Determine status icon based on estado
  const getStatusIcon = () => {
    switch (estado) {
      case 'completado':
        return '✓';
      case 'en progreso':
        return '⏳';
      case 'pendiente':
      default:
        return '⌛';
    }
  };

  return (
    <button
      onClick={() => onStart(cliente.id)}
      className={`w-full text-left px-4 py-4 border-l-4 rounded transition-all active:scale-95 ${getBackgroundColor()}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Client Name */}
          <h3 className="text-lg font-bold text-gray-900 truncate">
            {cliente.nombre}
          </h3>

          {/* Address */}
          <p className="text-sm text-gray-600 mt-1 truncate">
            {cliente.direccion || 'Sin dirección'}
          </p>

          {/* Time */}
          <p className="text-xs text-gray-500 mt-1">
            {hora || 'Sin horario'}
          </p>
        </div>

        {/* Status Icon */}
        <div className="ml-2 text-2xl flex-shrink-0">
          {getStatusIcon()}
        </div>
      </div>
    </button>
  );
}
