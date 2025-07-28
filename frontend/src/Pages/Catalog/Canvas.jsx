import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { CANVAS_SETTINGS, CURSOR_TYPES } from '../../constants/canvasConstants';
import { useCanvas } from '../../context/CanvasContext';
import useDragAndDrop from '../../hooks/useDragAndDrop';
import useSelection from '../../hooks/useSelection';

const Canvas = forwardRef(({
  transform,
  isPanning,
  activePage,
  selectedElements,
  onElementUpdate
}, ref) => {
  const { handleDragStart, handleDragMove, handleDragEnd } = useDragAndDrop({
    transformCoordinates: true,
    canvasRef: ref,
    transform
  });

  const { startSelection, updateSelection, endSelection } = useSelection({
    onSelect: (bounds, addToSelection) => {
      // Find elements within the selection bounds
      const selectedIds = activePage.elements
        .filter(element => {
          const elementBounds = {
            left: element.position.x,
            top: element.position.y,
            right: element.position.x + element.size.width,
            bottom: element.position.y + element.size.height
          };
          
          return (
            elementBounds.left < bounds.right &&
            elementBounds.right > bounds.left &&
            elementBounds.top < bounds.bottom &&
            elementBounds.bottom > bounds.top
          );
        })
        .map(element => element.id);

      // Update selection
      if (selectedIds.length > 0) {
        const newSelection = new Set(addToSelection ? [...selectedElements, ...selectedIds] : selectedIds);
        setSelectedElements(newSelection);
      }
    },
    canvasRef: ref,
    transform
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const handleMouseDown = (e) => {
      if (e.button !== 0) return; // Only handle left click
      if (isPanning) return;

      const isCanvasClick = e.target === canvas;
      if (isCanvasClick) {
        startSelection(e);
      }
    };

    const handleMouseMove = (e) => {
      updateSelection(e);
      handleDragMove(e);
    };

    const handleMouseUp = (e) => {
      endSelection(e);
      handleDragEnd(e);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [ref, isPanning, startSelection, updateSelection, endSelection, handleDragMove, handleDragEnd]);

  const renderElement = (element) => {
    const isSelected = selectedElements.has(element.id);
    const style = {
      position: 'absolute',
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.size.width}%`,
      height: `${element.size.height}%`,
      cursor: element.locked ? CURSOR_TYPES.DEFAULT : CURSOR_TYPES.MOVE,
      userSelect: 'none',
      ...element.style,
      transform: element.style.transform || 'none'
    };

    if (element.style?.display === 'none') return null;

    return (
      <div
        key={element.id}
        style={style}
        className={`
          absolute transition-shadow duration-150
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
          ${element.locked ? 'ring-1 ring-gray-300' : 'hover:ring-2 hover:ring-gray-400'}
        `}
        onMouseDown={(e) => {
          if (!element.locked) {
            handleDragStart(e, element);
          }
        }}
      >
        {renderElementContent(element)}
        {isSelected && !element.locked && renderElementHandles(element)}
      </div>
    );
  };

  const renderElementContent = (element) => {
    switch (element.type) {
      case 'text':
        return (
          <div
            contentEditable={!element.locked}
            suppressContentEditableWarning={true}
            onBlur={(e) => onElementUpdate(element.id, { content: e.target.innerHTML })}
            dangerouslySetInnerHTML={{ __html: element.content }}
            className="w-full h-full outline-none"
          />
        );
      case 'image':
        return (
          <img
            src={element.content}
            alt=""
            className="w-full h-full object-contain"
            draggable={false}
          />
        );
      case 'shape':
        return (
          <ShapeElement
            shape={element.shapeType}
            style={element.style}
            isSelected={selectedElements.has(element.id)}
          />
        );
      default:
        return null;
    }
  };

  const renderElementHandles = (element) => {
    const handlePositions = [
      { position: 'nw', cursor: CURSOR_TYPES.RESIZE_NW },
      { position: 'n', cursor: CURSOR_TYPES.RESIZE_N },
      { position: 'ne', cursor: CURSOR_TYPES.RESIZE_NE },
      { position: 'e', cursor: CURSOR_TYPES.RESIZE_E },
      { position: 'se', cursor: CURSOR_TYPES.RESIZE_SE },
      { position: 's', cursor: CURSOR_TYPES.RESIZE_S },
      { position: 'sw', cursor: CURSOR_TYPES.RESIZE_SW },
      { position: 'w', cursor: CURSOR_TYPES.RESIZE_W }
    ];

    return (
      <>
        {handlePositions.map(({ position, cursor }) => (
          <div
            key={position}
            className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm"
            style={{
              cursor,
              ...getHandlePosition(position)
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleDragStart(e, element, position);
            }}
          />
        ))}
        {/* Rotation handle */}
        <div
          className="absolute w-6 h-6 flex items-center justify-center cursor-pointer"
          style={{
            top: '-2rem',
            left: '50%',
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            handleDragStart(e, element, 'rotate');
          }}
        >
          <RotateCw
            size={14}
            className="text-blue-500 hover:text-blue-600 transition-colors"
          />
        </div>
      </>
    );
  };

  const getHandlePosition = (position) => {
    const offset = '-0.375rem'; // -6px
    switch (position) {
      case 'nw': return { top: offset, left: offset };
      case 'n': return { top: offset, left: '50%', transform: 'translateX(-50%)' };
      case 'ne': return { top: offset, right: offset };
      case 'e': return { top: '50%', right: offset, transform: 'translateY(-50%)' };
      case 'se': return { bottom: offset, right: offset };
      case 's': return { bottom: offset, left: '50%', transform: 'translateX(-50%)' };
      case 'sw': return { bottom: offset, left: offset };
      case 'w': return { top: '50%', left: offset, transform: 'translateY(-50%)' };
      default: return {};
    }
  };

  return (
    <div 
      ref={ref}
      className="w-[8.5in] h-[11in] bg-white mx-auto shadow-lg transform origin-center relative"
      style={{
        ...(activePage?.style || {}),
        transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`,
        cursor: isPanning ? CURSOR_TYPES.PANNING : CURSOR_TYPES.DEFAULT
      }}
    >
      {/* Grid background */}
      <div 
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)',
          backgroundSize: `${CANVAS_SETTINGS.GRID_SIZE}px ${CANVAS_SETTINGS.GRID_SIZE}px`
        }}
      />
      
      {/* Elements */}
      {activePage.elements.map(renderElement)}
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
