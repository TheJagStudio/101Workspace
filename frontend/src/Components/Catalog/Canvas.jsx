import React, { memo, useCallback, useState } from 'react';
import CanvasElement from './CanvasElement';

const Canvas = memo(({ 
  canvasRef,
  transform,
  isPanning,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  activePage,
  selectedElements,
  onElementUpdate,
  onSelectionChange,
  gridSize = 8, // Default grid size in pixels
  showGrid = false,
}) => {
  const [dragData, setDragData] = useState(null);

  const handleElementMouseDown = useCallback((e, element, handle) => {
    e.stopPropagation();
    if (!element.locked) {
      if (!selectedElements.has(element.id)) {
        const newSelection = e.shiftKey 
          ? new Set([...selectedElements, element.id])
          : new Set([element.id]);
        onSelectionChange?.(newSelection);
      }
      
      const rect = canvasRef.current.getBoundingClientRect();
      setDragData({
        element,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        elementStartX: element.position.x,
        elementStartY: element.position.y,
        canvasRect: rect,
      });
    }
  }, [canvasRef, selectedElements, onSelectionChange]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current) {
      onSelectionChange?.(new Set());
      onMouseDown?.(e);
    }
  }, [canvasRef, onSelectionChange, onMouseDown]);

  return (
    <div className="flex-1 overflow-auto p-8 bg-gray-100">
      <div
        ref={canvasRef}
        className={`w-[8.5in] h-[11in] bg-white mx-auto shadow-lg transform origin-center relative ${
          showGrid ? 'bg-grid' : ''
        }`}
        style={{
          ...activePage.style,
          transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
          backgroundSize: showGrid ? `${gridSize * transform.scale}px ${gridSize * transform.scale}px` : 'auto',
          backgroundImage: showGrid 
            ? 'linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)'
            : 'none'
        }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {activePage.elements.map((element) => (
          <CanvasElement
            key={element.id}
            element={element}
            isSelected={selectedElements.has(element.id)}
            onMouseDown={handleElementMouseDown}
            onUpdate={onElementUpdate}
            isPanning={isPanning}
            transform={transform}
            dragData={dragData}
          />
        ))}
      </div>
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
