import React from 'react';

const ShapeElement = ({ shape, style }) => {
  const renderShape = () => {
    switch (shape) {
      case 'rectangle':
        return (
          <rect
            width="100%"
            height="100%"
            rx={style.borderRadius || "0"}
            ry={style.borderRadius || "0"}
          />
        );
      case 'circle':
        return (
          <circle
            cx="50%"
            cy="50%"
            r="45%"
          />
        );
      case 'triangle':
        return (
          <polygon
            points="50,10 90,90 10,90"
          />
        );
      case 'line':
        return (
          <line
            x1="10%"
            y1="50%"
            x2="90%"
            y2="50%"
            strokeLinecap="round"
          />
        );
      default:
        return null;
    }
  };

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        fill: style.backgroundColor || 'none',
        stroke: style.borderColor || 'none',
        strokeWidth: style.borderWidth || '0',
      }}
    >
      {renderShape()}
    </svg>
  );
};

export default ShapeElement;
