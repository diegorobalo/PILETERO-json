/**
 * WaterMeasurement - Component for inputting water quality measurements
 * Displays inputs for cloro (ppm) and pH levels with large, centered text
 */

export default function WaterMeasurement({ cloro, ph, onChange }) {
  const handleInputChange = (field, value) => {
    // Parse value to float or leave empty
    const numValue = value === '' ? '' : parseFloat(value);
    onChange(field, numValue);
  };

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Mediciones del Agua</h2>

      <div className="space-y-4">
        {/* Cloro Input */}
        <div>
          <label className="block text-sm text-gray-700 mb-2">Cloro (ppm)</label>
          <input
            type="number"
            step="0.1"
            placeholder="0.0"
            value={cloro === '' || cloro === null ? '' : cloro}
            onChange={(e) => handleInputChange('cloro', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded text-center text-2xl font-bold text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* pH Input */}
        <div>
          <label className="block text-sm text-gray-700 mb-2">pH</label>
          <input
            type="number"
            step="0.1"
            placeholder="0.0"
            value={ph === '' || ph === null ? '' : ph}
            onChange={(e) => handleInputChange('ph', e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded text-center text-2xl font-bold text-gray-900 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
