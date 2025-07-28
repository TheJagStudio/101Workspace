import { useCallback } from 'react';

const useCanvasOperations = (updateElements) => {
  const alignElements = useCallback((elements, type) => {
    if (elements.length < 2) return;

    const bounds = elements.reduce((acc, el) => ({
      left: Math.min(acc.left, el.position.x),
      right: Math.max(acc.right, el.position.x + el.size.width),
      top: Math.min(acc.top, el.position.y),
      bottom: Math.max(acc.bottom, el.position.y + el.size.height),
      centerX: (acc.left + acc.right) / 2,
      centerY: (acc.top + acc.bottom) / 2
    }), {
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity
    });

    const updatedElements = elements.map(el => {
      const newEl = { ...el };
      switch (type) {
        case 'left':
          newEl.position.x = bounds.left;
          break;
        case 'centerX':
          newEl.position.x = bounds.centerX - (el.size.width / 2);
          break;
        case 'right':
          newEl.position.x = bounds.right - el.size.width;
          break;
        case 'top':
          newEl.position.y = bounds.top;
          break;
        case 'centerY':
          newEl.position.y = bounds.centerY - (el.size.height / 2);
          break;
        case 'bottom':
          newEl.position.y = bounds.bottom - el.size.height;
          break;
        case 'distributeX':
          // Implement horizontal distribution
          break;
        case 'distributeY':
          // Implement vertical distribution
          break;
        default:
          break;
      }
      return newEl;
    });

    updateElements(updatedElements);
  }, [updateElements]);

  const distributeElements = useCallback((elements, type) => {
    if (elements.length < 3) return;

    // Sort elements by position
    const sorted = [...elements].sort((a, b) => {
      return type === 'horizontal' 
        ? a.position.x - b.position.x 
        : a.position.y - b.position.y;
    });

    // Calculate total space and gap
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace = type === 'horizontal'
      ? last.position.x + last.size.width - first.position.x
      : last.position.y + last.size.height - first.position.y;
    
    const gap = totalSpace / (elements.length - 1);

    // Update positions
    const updatedElements = sorted.map((el, i) => {
      if (i === 0 || i === sorted.length - 1) return el;

      const newEl = { ...el };
      if (type === 'horizontal') {
        newEl.position.x = first.position.x + (gap * i);
      } else {
        newEl.position.y = first.position.y + (gap * i);
      }
      return newEl;
    });

    updateElements(updatedElements);
  }, [updateElements]);

  return {
    alignElements,
    distributeElements
  };
};

export default useCanvasOperations;
