import { useCallback, useRef } from 'react';

const useSelection = ({ onSelect, canvasRef, transform }) => {
  const selectionBox = useRef({
    isSelecting: false,
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
  });

  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    if (!canvasRef?.current) return { x: clientX, y: clientY };

    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / (rect.width * (transform?.scale || 1))) * 100,
      y: ((clientY - rect.top) / (rect.height * (transform?.scale || 1))) * 100,
    };
  }, [canvasRef, transform]);

  const startSelection = useCallback((e) => {
    // Only start selection if it's a left click on the canvas itself
    if (e.button !== 0 || e.target !== canvasRef.current) return;
    
    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    
    selectionBox.current = {
      isSelecting: true,
      start: coords,
      current: coords,
    };

    // Create and add the selection overlay
    const overlay = document.createElement('div');
    overlay.id = 'selection-overlay';
    overlay.style.position = 'fixed';
    overlay.style.border = '1px solid #4f46e5';
    overlay.style.backgroundColor = 'rgba(79, 70, 229, 0.1)';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
  }, [getCanvasCoordinates]);

  const updateSelection = useCallback((e) => {
    if (!selectionBox.current.isSelecting) return;

    const coords = getCanvasCoordinates(e.clientX, e.clientY);
    selectionBox.current.current = coords;

    // Update the selection overlay
    const overlay = document.getElementById('selection-overlay');
    if (overlay) {
      const rect = canvasRef.current.getBoundingClientRect();
      const left = Math.min(
        selectionBox.current.start.x,
        selectionBox.current.current.x
      ) * rect.width / 100 + rect.left;
      const top = Math.min(
        selectionBox.current.start.y,
        selectionBox.current.current.y
      ) * rect.height / 100 + rect.top;
      const width = Math.abs(
        selectionBox.current.current.x - selectionBox.current.start.x
      ) * rect.width / 100;
      const height = Math.abs(
        selectionBox.current.current.y - selectionBox.current.start.y
      ) * rect.height / 100;

      overlay.style.left = `${left}px`;
      overlay.style.top = `${top}px`;
      overlay.style.width = `${width}px`;
      overlay.style.height = `${height}px`;
    }
  }, [getCanvasCoordinates]);

  const endSelection = useCallback((e) => {
    if (!selectionBox.current.isSelecting) return;

    // Remove the selection overlay
    const overlay = document.getElementById('selection-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }

    // Calculate the selection bounds
    const bounds = {
      left: Math.min(selectionBox.current.start.x, selectionBox.current.current.x),
      top: Math.min(selectionBox.current.start.y, selectionBox.current.current.y),
      right: Math.max(selectionBox.current.start.x, selectionBox.current.current.x),
      bottom: Math.max(selectionBox.current.start.y, selectionBox.current.current.y),
    };

    // Call the selection callback
    onSelect?.(bounds, e.shiftKey);

    selectionBox.current = {
      isSelecting: false,
      start: { x: 0, y: 0 },
      current: { x: 0, y: 0 },
    };
  }, [onSelect]);

  return {
    startSelection,
    updateSelection,
    endSelection,
  };
};

export default useSelection;
