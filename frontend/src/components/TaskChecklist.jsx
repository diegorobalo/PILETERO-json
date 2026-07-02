/**
 * TaskChecklist - Component for selecting completed pool maintenance tasks
 * Displays 5 tasks with toggle buttons (selected/unselected visual states)
 */

export default function TaskChecklist({ tasks, onChange }) {
  const taskOptions = [
    { id: 'limpiafondo', label: 'Pasado de limpiafondo' },
    { id: 'cepillado', label: 'Cepillado de paredes y fondo' },
    { id: 'superficie', label: 'Limpieza de superficie (sacar hojas)' },
    { id: 'canastos', label: 'Limpieza del canasto y skimmer' },
    { id: 'retrolavado', label: 'Retrolavado y enjuague del filtro' },
  ];

  const handleToggleTask = (taskId) => {
    const isSelected = tasks.includes(taskId);
    let updatedTasks;

    if (isSelected) {
      // Remove task
      updatedTasks = tasks.filter((t) => t !== taskId);
    } else {
      // Add task
      updatedTasks = [...tasks, taskId];
    }

    onChange(updatedTasks);
  };

  return (
    <div className="mb-6">
      <h2 className="section-heading text-lg font-bold text-gray-900">Tareas Realizadas</h2>
      <div className="space-y-2">
        {taskOptions.map((option) => {
          const isSelected = tasks.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => handleToggleTask(option.id)}
              className={`w-full px-4 py-3 rounded border-2 text-left transition-all active:scale-95 ${
                isSelected
                  ? 'bg-green-100 border-green-300'
                  : 'bg-gray-100 border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900 font-medium">{option.label}</span>
                <span className="text-lg font-bold">
                  {isSelected ? '✓' : '○'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
