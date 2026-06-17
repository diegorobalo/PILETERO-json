/**
 * StatCard - Display single KPI card in dashboard
 * Shows label, value, and emoji icon with color-coded background
 */

export default function StatCard({ label, value, icon, color = 'blue' }) {
  // Determine background color based on color prop
  const getColorClasses = () => {
    switch (color) {
      case 'green':
        return 'bg-green-100 border-green-300';
      case 'red':
        return 'bg-red-100 border-red-300';
      case 'yellow':
        return 'bg-yellow-100 border-yellow-300';
      case 'blue':
      default:
        return 'bg-blue-100 border-blue-300';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getColorClasses()}`}>
      {/* Icon */}
      <div className="text-2xl mb-2">
        {icon}
      </div>

      {/* Label */}
      <p className="text-sm text-gray-600 mb-2">
        {label}
      </p>

      {/* Value */}
      <p className="text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}
