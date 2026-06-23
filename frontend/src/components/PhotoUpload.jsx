import { useRef } from 'react'

function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX = 1024
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result)
      reader.readAsDataURL(file)
    }
    img.src = url
  })
}

const TIPO_LABEL = { antes: '📸 Antes', despues: '📸 Después', extra: '📸 Extra' }

export default function PhotoUpload({ fotos, onAddFoto, onRemoveFoto }) {
  const antesRef = useRef(null)
  const despuesRef = useRef(null)
  const extraRef = useRef(null)

  function handleChange(type) {
    return async (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      event.target.value = ''
      const data = await compressImage(file)
      if (data) onAddFoto({ type, data, timestamp: new Date() })
    }
  }

  const fotosAntes = (fotos || []).filter(f => f.type === 'antes')
  const fotosDespues = (fotos || []).filter(f => f.type === 'despues')

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">📷 Fotos</h2>

      <input ref={antesRef}   type="file" accept="image/*" onChange={handleChange('antes')}   className="hidden" />
      <input ref={despuesRef} type="file" accept="image/*" onChange={handleChange('despues')} className="hidden" />
      <input ref={extraRef}   type="file" accept="image/*" onChange={handleChange('extra')}   className="hidden" />

      <div className="grid grid-cols-3 gap-2 mb-4">
        <button onClick={() => antesRef.current?.click()}
          className="py-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <span className="text-xl">📷</span>
          <span className="text-xs">Antes</span>
          {fotosAntes.length > 0 && <span className="text-xs bg-white text-blue-600 rounded-full px-2">✓ {fotosAntes.length}</span>}
        </button>

        <button onClick={() => despuesRef.current?.click()}
          className="py-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <span className="text-xl">📷</span>
          <span className="text-xs">Después</span>
          {fotosDespues.length > 0 && <span className="text-xs bg-white text-blue-600 rounded-full px-2">✓ {fotosDespues.length}</span>}
        </button>

        <button onClick={() => extraRef.current?.click()}
          className="py-4 bg-gray-500 text-white font-bold rounded-xl hover:bg-gray-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
          <span className="text-xl">📷</span>
          <span className="text-xs">Extra</span>
        </button>
      </div>

      {fotos && fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {fotos.map((f, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden border-2 border-blue-200">
              <img src={f.data} alt={f.type} className="w-full h-32 object-cover" />
              <span className="absolute bottom-0 left-0 right-0 text-center text-xs bg-black bg-opacity-50 text-white py-1">
                {TIPO_LABEL[f.type] || f.type}
              </span>
              {onRemoveFoto && (
                <button onClick={() => onRemoveFoto(i)}
                  className="absolute top-1 right-1 bg-black bg-opacity-60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold leading-none">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
