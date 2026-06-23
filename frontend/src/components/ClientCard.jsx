const STATUS = {
  completado:    { border: 'border-l-green-500', badge: 'bg-green-100 text-green-700', label: '✓ Listo' },
  'en progreso': { border: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700', label: '· En curso' },
  pendiente:     { border: 'border-l-sky-400',   badge: 'bg-sky-100 text-sky-700',    label: 'Pendiente' },
};

export default function ClientCard({ cliente, hora, estado, onStart }) {
  const s = STATUS[estado] || STATUS.pendiente;
  return (
    <button
      onClick={() => onStart(cliente.id)}
      className={`w-full text-left bg-white rounded-xl shadow-sm border-l-4 ${s.border} px-4 py-4 active:scale-[0.98] transition-transform`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 truncate">{cliente.nombre}</h3>
          {cliente.direccion && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{cliente.direccion}</p>
          )}
          {hora && <p className="text-xs text-gray-400 mt-1">{hora}</p>}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 mt-0.5 ${s.badge}`}>
          {s.label}
        </span>
      </div>
    </button>
  );
}
