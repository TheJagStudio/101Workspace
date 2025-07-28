import { createContext, useContext, useCallback,useState } from 'react';
import useHistory from '../hooks/useHistory';
import useCanvasElements from '../hooks/useCanvasElements';
import useTransform from '../hooks/useTransform';
import useCanvasOperations from '../hooks/useCanvasOperations';

const CanvasContext = createContext(null);

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};

export const CanvasProvider = ({ children, initialPages = [{
    id: `page-${Date.now()}`,
    elements: [],
    settings: { backgroundColor: '#ffffff' },
    style: {
      backgroundColor: '#ffffff'
    }
  }] }) => {
  // Initialize canvas state with history
  const {
    state: pages,
    setState: setPages,
    undo,
    redo,
    canUndo,
    canRedo
  } = useHistory(initialPages);

  // Current page state
  const [activePage, setActivePage] = useState(0);

  // Element management
  const {
    elements: currentElements,
    selectedElements,
    addElement,
    updateElement,
    deleteElements,
    selectElements,
    groupElements,
    ungroupElements
  } = useCanvasElements(pages[activePage]?.elements || []);

  // Transform handling
  const {
    transform,
    isPanning,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomIn,
    zoomOut,
    resetTransform
  } = useTransform();

  // Canvas operations
  const { alignElements, distributeElements } = useCanvasOperations(
    useCallback((updatedElements) => {
      const newPages = [...pages];
      newPages[activePage].elements = updatedElements;
      setPages(newPages);
    }, [pages, activePage, setPages])
  );

  // Page management
  const addPage = useCallback(() => {
    setPages(prev => [
      ...prev,
      {
        id: `page-${Date.now()}`,
        elements: [],
        settings: { backgroundColor: '#ffffff' },
        style: {
          backgroundColor: '#ffffff'
        }
      }
    ]);
  }, [setPages]);

  const deletePage = useCallback((pageIndex) => {
    if (pages.length <= 1) return;
    setPages(prev => prev.filter((_, i) => i !== pageIndex));
    if (activePage >= pageIndex) {
      setActivePage(prev => Math.max(0, prev - 1));
    }
  }, [pages.length, activePage, setPages]);

  // Clipboard operations
  const copyToClipboard = useCallback(() => {
    if (selectedElements.size === 0) return;
    const elementsToCopy = currentElements.filter(el => 
      selectedElements.has(el.id)
    );
    localStorage.setItem('canvas-clipboard', JSON.stringify(elementsToCopy));
  }, [selectedElements, currentElements]);

  const pasteFromClipboard = useCallback(() => {
    const clipboardData = localStorage.getItem('canvas-clipboard');
    if (!clipboardData) return;

    try {
      const elementsToPaste = JSON.parse(clipboardData);
      const newElements = elementsToPaste.map(el => ({
        ...el,
        id: `${el.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: el.position.x + 10,
          y: el.position.y + 10
        }
      }));

      setPages(prev => {
        const newPages = [...prev];
        newPages[activePage].elements = [
          ...newPages[activePage].elements,
          ...newElements
        ];
        return newPages;
      });

      selectElements(newElements.map(el => el.id));
    } catch (error) {
      console.error('Failed to paste elements:', error);
    }
  }, [activePage, setPages, selectElements]);

  // Export the canvas state and operations
  const value = {
    // Page state
    pages,
    activePage,
    setActivePage,
    addPage,
    deletePage,

    // Element operations
    selectedElements,
    addElement,
    updateElement,
    deleteElements,
    selectElements,
    groupElements,
    ungroupElements,

    // Transform operations
    transform,
    isPanning,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomIn,
    zoomOut,
    resetTransform,

    // Canvas operations
    alignElements,
    distributeElements,

    // History operations
    undo,
    redo,
    canUndo,
    canRedo,

    // Clipboard operations
    copy: copyToClipboard,
    paste: pasteFromClipboard
  };

  return (
    <CanvasContext.Provider value={value}>
      {children}
    </CanvasContext.Provider>
  );
};

export default CanvasContext;
