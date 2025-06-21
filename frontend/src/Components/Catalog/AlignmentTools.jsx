import React from 'react';
import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from 'lucide-react';

const AlignmentTools = ({ onAlign, selectedElements, disabled }) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-md">
      <button
        onClick={() => onAlign('left')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Align Left"
      >
        <AlignStartHorizontal size={16} />
      </button>
      <button
        onClick={() => onAlign('centerX')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Center Horizontally"
      >
        <AlignCenterHorizontal size={16} />
      </button>
      <button
        onClick={() => onAlign('right')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Align Right"
      >
        <AlignEndHorizontal size={16} />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        onClick={() => onAlign('top')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Align Top"
      >
        <AlignStartVertical size={16} />
      </button>
      <button
        onClick={() => onAlign('centerY')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Center Vertically"
      >
        <AlignCenterVertical size={16} />
      </button>
      <button
        onClick={() => onAlign('bottom')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Align Bottom"
      >
        <AlignEndVertical size={16} />
      </button>
      <div className="w-px h-6 bg-gray-200 mx-1" />
      <button
        onClick={() => onAlign('distributeX')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Distribute Horizontally"
      >
        {/* <SpaceHorizontally size={16} /> */}
      </button>
      <button
        onClick={() => onAlign('distributeY')}
        disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 ${disabled ? 'opacity-50' : ''}`}
        title="Distribute Vertically"
      >
        {/* <SpaceVertically size={16} /> */}
      </button>
    </div>
  );
};

export default AlignmentTools;
