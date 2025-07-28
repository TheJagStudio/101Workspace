import React, { memo } from 'react';
import { SHAPE_TYPES } from '../../constants/canvasConstants';

const DEFAULT_PROPS = {
  stroke: '#000000',
  strokeWidth: 1,
  fill: 'none',
  opacity: 1,
};

const getShapeProps = (shape, style) => {
  const props = {
    ...DEFAULT_PROPS,
    stroke: style.borderColor || DEFAULT_PROPS.stroke,
    strokeWidth: style.borderWidth || DEFAULT_PROPS.strokeWidth,
    fill: style.backgroundColor || DEFAULT_PROPS.fill,
    opacity: style.opacity || DEFAULT_PROPS.opacity,
  };

  switch (shape) {
    case SHAPE_TYPES.RECTANGLE:
      return {
        ...props,
        rx: style.borderRadius || 0,
        ry: style.borderRadius || 0,
      };
    case SHAPE_TYPES.CIRCLE:
      return props;
    case SHAPE_TYPES.TRIANGLE:
      return {
        ...props,
        strokeLinejoin: 'round',
      };
    case SHAPE_TYPES.LINE:
      return {
        ...props,
        strokeLinecap: 'round',
        fill: 'none', // Lines should never have fill
      };
    default:
      return props;
  }
};

const shapes = {
  [SHAPE_TYPES.RECTANGLE]: (props) => (
    <rect
      width="100"
      height="100"
      {...props}
    />
  ),
  [SHAPE_TYPES.CIRCLE]: (props) => (
    <circle
      cx="50"
      cy="50"
      r="45"
      {...props}
    />
  ),
  [SHAPE_TYPES.TRIANGLE]: (props) => (
    <polygon
      points="50,10 90,90 10,90"
      {...props}
    />
  ),
  [SHAPE_TYPES.LINE]: (props) => (
    <line
      x1="10"
      y1="50"
      x2="90"
      y2="50"
      {...props}
    />
  ),
};

const ShapeElement = memo(({ shape, style, isSelected }) => {
  const Shape = shapes[shape];
  if (!Shape) return null;

  const shapeProps = getShapeProps(shape, style);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Grid pattern for transparent background */}
      <defs>
        <pattern
          id="transparencyGrid"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <rect width="5" height="5" fill="#fff" />
          <rect x="5" y="5" width="5" height="5" fill="#fff" />
          <rect x="5" y="0" width="5" height="5" fill="#f0f0f0" />
          <rect x="0" y="5" width="5" height="5" fill="#f0f0f0" />
        </pattern>
      </defs>

      {/* Background grid for transparency visualization */}
      <rect
        width="100"
        height="100"
        fill="url(#transparencyGrid)"
      />

      {/* The actual shape */}
      <Shape {...shapeProps} />

      {/* Selection outline */}
      {isSelected && (
        <Shape
          {...shapeProps}
          stroke="#4f46e5"
          strokeWidth={2}
          fill="none"
          opacity={1}
          strokeDasharray="4 2"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
});

ShapeElement.displayName = 'ShapeElement';

export default ShapeElement;
