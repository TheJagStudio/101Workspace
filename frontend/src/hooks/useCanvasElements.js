import { useState, useCallback } from 'react';

const useCanvasElements = (initialElements) => {
  const [elements, setElements] = useState(initialElements);
  const [selectedElements, setSelectedElements] = useState(new Set());
  
  const addElement = useCallback((type, options = {}) => {
    const newElement = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 10, y: 10 },
      size: { width: 20, height: 20 },
      style: {},
      locked: false,
      visible: true,
      ...options
    };

    setElements(prev => [...prev, newElement]);
    return newElement.id;
  }, []);

  const updateElement = useCallback((id, updates) => {
    setElements(prev => 
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  }, []);

  const deleteElements = useCallback((ids) => {
    setElements(prev => prev.filter(el => !ids.includes(el.id)));
    setSelectedElements(prev => {
      const newSelection = new Set(prev);
      ids.forEach(id => newSelection.delete(id));
      return newSelection;
    });
  }, []);

  const selectElements = useCallback((ids, addToSelection = false) => {
    setSelectedElements(prev => {
      const newSelection = addToSelection ? new Set(prev) : new Set();
      ids.forEach(id => newSelection.add(id));
      return newSelection;
    });
  }, []);

  const groupElements = useCallback((elementIds) => {
    const elementsToGroup = elements.filter(el => elementIds.includes(el.id));
    
    if (elementsToGroup.length < 2) return null;

    // Calculate group bounds
    const bounds = elementsToGroup.reduce((acc, el) => ({
      left: Math.min(acc.left, el.position.x),
      top: Math.min(acc.top, el.position.y),
      right: Math.max(acc.right, el.position.x + el.size.width),
      bottom: Math.max(acc.bottom, el.position.y + el.size.height)
    }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

    const groupElement = {
      id: `group-${Date.now()}`,
      type: 'group',
      children: elementIds,
      position: { x: bounds.left, y: bounds.top },
      size: {
        width: bounds.right - bounds.left,
        height: bounds.bottom - bounds.top
      },
      style: {}
    };

    setElements(prev => [
      ...prev.filter(el => !elementIds.includes(el.id)),
      groupElement
    ]);
    setSelectedElements(new Set([groupElement.id]));
    
    return groupElement.id;
  }, [elements]);

  const ungroupElements = useCallback((groupId) => {
    const group = elements.find(el => el.id === groupId);
    if (!group || group.type !== 'group') return;

    const childElements = elements.filter(el => group.children.includes(el.id));
    setElements(prev => [
      ...prev.filter(el => el.id !== groupId),
      ...childElements
    ]);
    setSelectedElements(new Set(childElements.map(el => el.id)));
  }, [elements]);

  return {
    elements,
    selectedElements,
    addElement,
    updateElement,
    deleteElements,
    selectElements,
    groupElements,
    ungroupElements
  };
};

export default useCanvasElements;
