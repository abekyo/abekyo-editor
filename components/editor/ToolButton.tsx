'use client';

// Small icon-with-label button used in the editor's left toolbar
// (Subtitle / Properties / BGM toggles, etc.). No state of its own,
// purely visual + onClick.

export interface ToolButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  color?: 'indigo' | 'purple' | 'pink' | 'red' | 'blue';
  id?: string;
}

export function ToolButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  color = 'indigo',
  id,
}: ToolButtonProps) {
  const colorClasses = {
    indigo: active ? 'bg-indigo-500/30 border-indigo-400' : 'hover:bg-indigo-500/20 border-indigo-500/30',
    purple: active ? 'bg-purple-500/30 border-purple-400' : 'hover:bg-purple-500/20 border-purple-500/30',
    pink: active ? 'bg-pink-500/30 border-pink-400' : 'hover:bg-pink-500/20 border-pink-500/30',
    red: active ? 'bg-red-500/30 border-red-400' : 'hover:bg-red-500/20 border-red-500/30',
    blue: active ? 'bg-blue-500/30 border-blue-400' : 'hover:bg-blue-500/20 border-blue-500/30',
  };

  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      className={`p-4 rounded-xl border transition-all ${colorClasses[color]} group ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={label}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs text-gray-400 group-hover:text-gray-300">{label}</div>
    </button>
  );
}
