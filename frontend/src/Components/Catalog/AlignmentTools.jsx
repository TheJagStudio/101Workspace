import React, { memo } from 'react';
import {
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  ArrowLeftRight,
  ArrowUpDown,
} from 'lucide-react';
import { ALIGNMENT_TYPES } from '../../constants/canvasConstants';

const AlignmentButton = memo(({ onClick, disabled, icon: Icon, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      p-1.5 rounded transition-all duration-150
      ${disabled 
        ? 'opacity-50 cursor-not-allowed' 
        : 'hover:bg-indigo-50 hover:text-indigo-600 active:bg-indigo-100'
      }
    `}
    title={title}
  >
    <Icon size={16} />
  </button>
));

const Divider = memo(() => (
  <div className="w-px h-6 bg-gray-200 mx-1" />
));

const AlignmentTools = memo(({ onAlign, selectedElements, disabled }) => {
  const alignmentButtons = [
    {
      group: 'horizontal',
      buttons: [
        { type: ALIGNMENT_TYPES.LEFT, icon: AlignStartHorizontal, title: 'Align Left' },
        { type: ALIGNMENT_TYPES.CENTER_X, icon: AlignCenterHorizontal, title: 'Center Horizontally' },
        { type: ALIGNMENT_TYPES.RIGHT, icon: AlignEndHorizontal, title: 'Align Right' },
      ]
    },
    {
      group: 'vertical',
      buttons: [
        { type: ALIGNMENT_TYPES.TOP, icon: AlignStartVertical, title: 'Align Top' },
        { type: ALIGNMENT_TYPES.CENTER_Y, icon: AlignCenterVertical, title: 'Center Vertically' },
        { type: ALIGNMENT_TYPES.BOTTOM, icon: AlignEndVertical, title: 'Align Bottom' },
      ]
    },
    {
      group: 'distribute',
      buttons: [
        { type: ALIGNMENT_TYPES.DISTRIBUTE_X, icon: ArrowLeftRight, title: 'Distribute Horizontally' },
        { type: ALIGNMENT_TYPES.DISTRIBUTE_Y, icon: ArrowUpDown, title: 'Distribute Vertically' },
      ]
    }
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-md shadow-sm">
      {alignmentButtons.map(({ group, buttons }, groupIndex) => (
        <React.Fragment key={group}>
          {groupIndex > 0 && <Divider />}
          {buttons.map(({ type, icon, title }) => (
            <AlignmentButton
              key={type}
              onClick={() => onAlign(type)}
              disabled={disabled}
              icon={icon}
              title={title}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
});

AlignmentTools.displayName = 'AlignmentTools';

export default AlignmentTools;
