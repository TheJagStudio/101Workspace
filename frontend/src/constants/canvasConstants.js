export const CANVAS_SETTINGS = {
  // Canvas dimensions (US Letter size in inches)
  WIDTH: 8.5,
  HEIGHT: 11,
  DPI: 96, // Standard screen DPI
  
  // Zoom constraints
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5,
  ZOOM_STEP: 1.2,

  // Grid settings
  GRID_SIZE: 10, // pixels
  SNAP_THRESHOLD: 5, // pixels

  // Selection settings
  RESIZE_HANDLE_SIZE: 8, // pixels
  ROTATION_HANDLE_OFFSET: 20, // pixels
  MIN_ELEMENT_SIZE: 10, // pixels

  // Default element styles
  DEFAULT_TEXT_STYLE: {
    fontSize: '16px',
    fontFamily: 'Arial, sans-serif',
    color: '#000000',
    textAlign: 'left',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    lineHeight: '1.2'
  },

  DEFAULT_SHAPE_STYLE: {
    fill: 'none',
    stroke: '#000000',
    strokeWidth: '1px',
    opacity: 1
  },

  DEFAULT_IMAGE_STYLE: {
    objectFit: 'contain',
    opacity: 1,
    borderWidth: '0px',
    borderStyle: 'solid',
    borderColor: 'transparent'
  }
};

export const KEYBOARD_SHORTCUTS = {
  UNDO: { key: 'z', ctrl: true },
  REDO: { key: 'z', ctrl: true, shift: true },
  COPY: { key: 'c', ctrl: true },
  PASTE: { key: 'v', ctrl: true },
  CUT: { key: 'x', ctrl: true },
  DELETE: { key: 'Delete' },
  SELECT_ALL: { key: 'a', ctrl: true },
  GROUP: { key: 'g', ctrl: true },
  UNGROUP: { key: 'g', ctrl: true, shift: true },
  SAVE: { key: 's', ctrl: true },
  ZOOM_IN: { key: '=', ctrl: true },
  ZOOM_OUT: { key: '-', ctrl: true },
  ZOOM_RESET: { key: '0', ctrl: true },
  PAN: { key: ' ' } // Space
};

export const ELEMENT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  SHAPE: 'shape',
  GROUP: 'group'
};

export const SHAPE_TYPES = {
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  TRIANGLE: 'triangle',
  LINE: 'line'
};

export const CURSOR_TYPES = {
  DEFAULT: 'default',
  MOVE: 'move',
  RESIZE_N: 'n-resize',
  RESIZE_NE: 'ne-resize',
  RESIZE_E: 'e-resize',
  RESIZE_SE: 'se-resize',
  RESIZE_S: 's-resize',
  RESIZE_SW: 'sw-resize',
  RESIZE_W: 'w-resize',
  RESIZE_NW: 'nw-resize',
  ROTATE: 'grab',
  PANNING: 'grab',
  PANNING_ACTIVE: 'grabbing'
};

export const ALIGNMENT_TYPES = {
  LEFT: 'left',
  CENTER_X: 'centerX',
  RIGHT: 'right',
  TOP: 'top',
  CENTER_Y: 'centerY',
  BOTTOM: 'bottom',
  DISTRIBUTE_X: 'distributeX',
  DISTRIBUTE_Y: 'distributeY'
};
