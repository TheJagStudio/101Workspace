import React, { memo, useCallback, useEffect, useRef } from 'react';
import { RotateCw } from 'lucide-react';
import ShapeElement from './ShapeElement';

const ResizeHandle = memo(({ position, onMouseDown, disabled }) => {
  if (disabled) return null;
  
  return (
    <div
      className="absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm transition-opacity"
      style={{
        cursor: `${position}-resize`,
        opacity: disabled ? 0 : 1,
        top: position.includes('n') ? '-1.5px' : 'auto',
        bottom: position.includes('s') ? '-1.5px' : 'auto',
        left: position.includes('w') ? '-1.5px' : 'auto',
        right: position.includes('e') ? '-1.5px' : 'auto'
      }}
      onMouseDown={(e) => onMouseDown(e, position)}
    />
  );
});

const RotateHandle = memo(({ onMouseDown, disabled }) => {
  if (disabled) return null;
  
  return (
    <div
      className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer group/rotate transition-opacity"
      style={{ opacity: disabled ? 0 : 1 }}
      onMouseDown={(e) => onMouseDown(e, 'rotate')}
    >
      <RotateCw size={14} className="text-blue-500 group-hover/rotate:text-blue-600" />
    </div>
  );
});

const CanvasElement = memo(({ 
  element, 
  isSelected, 
  onMouseDown,
  onUpdate,
  isPanning,
  transform,
  dragData
}) => {
  const elementRef = useRef(null);
  const prevPositionRef = useRef(element.position);
  
  useEffect(() => {
    prevPositionRef.current = element.position;
  }, [element.position]);

  const handleMouseDown = useCallback((e, handle = null) => {
    e.stopPropagation();
    if (!element.locked) {
      onMouseDown(e, element, handle);
    }
  }, [element, onMouseDown]);

  const handleContentUpdate = useCallback((e) => {
    onUpdate(element.id, {
      content: e.target.innerHTML
    });
  }, [element.id, onUpdate]);

  if (element.style?.display === 'none') return null;

  const style = {
    position: 'absolute',
    left: `${element.position.x}%`,
    top: `${element.position.y}%`,
    width: `${element.size.width}%`,
    height: `${element.size.height}%`,
    cursor: isPanning ? 'grab' : element.locked ? 'not-allowed' : 'move',
    userSelect: 'none',
    backgroundColor: element.style?.backgroundColor || 'transparent',
    transform: element.style?.transform || 'none',
    transition: dragData?.element?.id === element.id ? 'none' : 'all 0.2s ease',
    ...element.style,
    willChange: isSelected ? 'transform' : 'auto'
  };

  const isDisabled = element.locked || isPanning;

  return (
    <div
      ref={elementRef}
      onMouseDown={handleMouseDown}
      style={style}
      className={`absolute ${
        isSelected
          ? 'ring-2 ring-blue-500 ring-offset-1'
          : element.locked
            ? 'ring-1 ring-gray-300 ring-offset-1'
            : 'hover:ring-2 hover:ring-gray-400 hover:ring-offset-1'
      }`}
    >
      {element.type === 'text' && (
        <div
          contentEditable={isSelected && !element.locked}
          suppressContentEditableWarning={true}
          onBlur={handleContentUpdate}
          dangerouslySetInnerHTML={{ __html: element.content }}
          className="w-full h-full outline-none"
          spellCheck={false}
        />
      )}
      
      {element.type === 'image' && (
        <img
          src={element.content}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
        />
      )}
      
      {element.type === 'shape' && (
        <ShapeElement
          shape={element.shapeType}
          style={element.style}
          isSelected={isSelected}
        />
      )}

      {isSelected && !isDisabled && (
        <>
          <ResizeHandle position="nw" onMouseDown={handleMouseDown} disabled={isDisabled} />
          <ResizeHandle position="ne" onMouseDown={handleMouseDown} disabled={isDisabled} />
          <ResizeHandle position="sw" onMouseDown={handleMouseDown} disabled={isDisabled} />
          <ResizeHandle position="se" onMouseDown={handleMouseDown} disabled={isDisabled} />
          <RotateHandle onMouseDown={handleMouseDown} disabled={isDisabled} />
        </>
      )}
    </div>
  );
});

ResizeHandle.displayName = 'ResizeHandle';
RotateHandle.displayName = 'RotateHandle';
CanvasElement.displayName = 'CanvasElement';

export default CanvasElement;
