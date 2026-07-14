const STATUS = {
  completado:    { dot: 'bg-green-500', text: 'text-green-600', label: 'Listo' },
  'en progreso': { dot: 'bg-amber-400', text: 'text-amber-600', label: 'En curso' },
  pendiente:     { dot: 'bg-gray-300',  text: 'text-gray-400',  label: 'Pendiente' },
};

export default function ClientCard({ cliente, hora, estado, onStart, onWhatsApp }) {
  const s = STATUS[estado] || STATUS.pendiente;
  const completado = estado === 'completado';

  return (
    <button
      onClick={() => onStart(cliente.id)}
      className="w-full text-left bg-white rounded-2xl shadow-card px-4 pt-4 pb-3 active:scale-[0.97] transition-transform duration-[160ms]"
    >
      <div className="flex items-center justify-between gap-3 mb-0.5">
        <h3 className="text-base font-bold text-gray-900 truncate">{cliente.nombre}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${s.dot}`} />
          <span className={`text-xs font-bold ${s.text}`}>{s.label}</span>
        </div>
      </div>

      {cliente.direccion && (
        <p className="text-sm text-gray-400 truncate mb-3">{cliente.direccion}</p>
      )}

      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${
          completado ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
        }`}>
          {completado && hora ? `✓ ${hora}` : 'Sin visita aún'}
        </span>
        {onWhatsApp && (
          <button
            onClick={e => { e.stopPropagation(); onWhatsApp(); }}
            className={`text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
              completado
                ? 'bg-green-50 text-green-700 active:bg-green-100'
                : 'bg-sky-50 text-sky-700 active:bg-sky-100'
            }`}
          >
            💬 WhatsApp
          </button>
        )}
      </div>
    </button>
  );
}
