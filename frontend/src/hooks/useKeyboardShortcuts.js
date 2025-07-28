import { useEffect, useCallback } from 'react';

const useKeyboardShortcuts = (actions) => {
  const handleKeyDown = useCallback((e) => {
    // Don't trigger shortcuts when typing in input fields
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      return;
    }

    const ctrlKey = e.ctrlKey || e.metaKey;
    const shiftKey = e.shiftKey;

    // Undo/Redo
    if (ctrlKey && e.key === 'z') {
      e.preventDefault();
      if (shiftKey && actions.redo) {
        actions.redo();
      } else if (actions.undo) {
        actions.undo();
      }
    }

    // Copy/Cut/Paste
    if (ctrlKey && e.key === 'c' && actions.copy) {
      e.preventDefault();
      actions.copy();
    }
    if (ctrlKey && e.key === 'x' && actions.cut) {
      e.preventDefault();
      actions.cut();
    }
    if (ctrlKey && e.key === 'v' && actions.paste) {
      e.preventDefault();
      actions.paste();
    }

    // Delete
    if ((e.key === 'Delete' || e.key === 'Backspace') && actions.delete) {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        actions.delete();
      }
    }

    // Select All
    if (ctrlKey && e.key === 'a' && actions.selectAll) {
      e.preventDefault();
      actions.selectAll();
    }

    // Group/Ungroup
    if (ctrlKey && e.key === 'g' && actions.group) {
      e.preventDefault();
      if (shiftKey && actions.ungroup) {
        actions.ungroup();
      } else {
        actions.group();
      }
    }

    // Save
    if (ctrlKey && e.key === 's' && actions.save) {
      e.preventDefault();
      actions.save();
    }

    // Space for panning
    if (e.code === 'Space' && actions.startPan) {
      e.preventDefault();
      actions.startPan();
    }

    // Zoom
    if (ctrlKey && (e.key === '=' || e.key === '+') && actions.zoomIn) {
      e.preventDefault();
      actions.zoomIn();
    }
    if (ctrlKey && e.key === '-' && actions.zoomOut) {
      e.preventDefault();
      actions.zoomOut();
    }
    if (ctrlKey && e.key === '0' && actions.resetZoom) {
      e.preventDefault();
      actions.resetZoom();
    }
  }, [actions]);

  const handleKeyUp = useCallback((e) => {
    if (e.code === 'Space' && actions.endPan) {
      actions.endPan();
    }
  }, [actions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
};

export default useKeyboardShortcuts;
