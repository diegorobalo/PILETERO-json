/**
 * PhotoUpload - Component for capturing photos (before/after)
 * Provides two large buttons to capture images with camera
 */

export default function PhotoUpload({ fotos, onAddFoto }) {
  const handleFileSelect = (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (data) {
          onAddFoto({
            type,
            data,
            timestamp: new Date(),
          });
        }
      };
      reader.readAsDataURL(file);
    };

    input.click();
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Fotos</h2>

      {/* Photo Buttons Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => handleFileSelect('antes')}
          className="px-4 py-4 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 active:scale-95 transition-all min-h-20 flex items-center justify-center"
        >
          📷 Foto Antes
        </button>

        <button
          onClick={() => handleFileSelect('despues')}
          className="px-4 py-4 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 active:scale-95 transition-all min-h-20 flex items-center justify-center"
        >
          📷 Foto Después
        </button>
      </div>

      {/* Photo Count */}
      {fotos && fotos.length > 0 && (
        <div className="text-center text-green-600 font-medium">
          ✓ {fotos.length} foto(s) capturada(s)
        </div>
      )}
    </div>
  );
}
