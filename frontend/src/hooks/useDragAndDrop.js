import { useCallback, useRef } from 'react';

const useDragAndDrop = ({
  onDragStart,
  onDragMove,
  onDragEnd,
  transformCoordinates = true,
  canvasRef,
  transform
}) => {
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    elementId: null,
    handle: null,
    canvasRect: null,
  });

  const getCanvasCoordinates = useCallback((clientX, clientY) => {
    if (!transformCoordinates || !canvasRef?.current) return { x: clientX, y: clientY };

    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / (rect.width * (transform?.scale || 1))) * 100,
      y: ((clientY - rect.top) / (rect.height * (transform?.scale || 1))) * 100,
    };
  }, [transformCoordinates, canvasRef, transform]);

  const handleDragStart = useCallback((e, elementId, handle = null) => {
    // Prevent default only for mouse events, not touch
    if (e.type.startsWith('mouse')) {
      e.preventDefault();
    }

    const coords = getCanvasCoordinates(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );

    dragState.current = {
      isDragging: true,
      startX: coords.x,
      startY: coords.y,
      lastX: coords.x,
      lastY: coords.y,
      elementId,
      handle,
      canvasRect: canvasRef?.current?.getBoundingClientRect()
    };

    onDragStart?.(elementId, coords, handle);
  }, [getCanvasCoordinates, onDragStart]);

  const handleDragMove = useCallback((e) => {
    if (!dragState.current.isDragging) return;

    // Prevent default only for mouse events, not touch
    if (e.type.startsWith('mouse')) {
      e.preventDefault();
    }

    const coords = getCanvasCoordinates(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );

    const delta = {
      x: coords.x - dragState.current.lastX,
      y: coords.y - dragState.current.lastY
    };

    onDragMove?.(
      dragState.current.elementId,
      coords,
      delta,
      {
        start: { x: dragState.current.startX, y: dragState.current.startY },
        handle: dragState.current.handle
      }
    );

    dragState.current.lastX = coords.x;
    dragState.current.lastY = coords.y;
  }, [getCanvasCoordinates, onDragMove]);

  const handleDragEnd = useCallback((e) => {
    if (!dragState.current.isDragging) return;

    // Prevent default only for mouse events, not touch
    if (e.type.startsWith('mouse')) {
      e.preventDefault();
    }

    const coords = getCanvasCoordinates(
      e.touches ? e.touches[0].clientX : e.clientX,
      e.touches ? e.touches[0].clientY : e.clientY
    );

    onDragEnd?.(
      dragState.current.elementId,
      coords,
      {
        start: { x: dragState.current.startX, y: dragState.current.startY },
        handle: dragState.current.handle
      }
    );

    dragState.current = {
      isDragging: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      elementId: null,
      handle: null,
      canvasRect: null
    };
  }, [getCanvasCoordinates, onDragEnd]);

  const attachDragListeners = useCallback((element, elementId) => {
    if (!element) return;

    const handleMouseDown = (e) => handleDragStart(e, elementId);
    const handleTouchStart = (e) => handleDragStart(e, elementId);

    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('touchstart', handleTouchStart);

    return () => {
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('touchstart', handleTouchStart);
    };
  }, [handleDragStart]);

  return {
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    attachDragListeners
  };
};

export default useDragAndDrop;
