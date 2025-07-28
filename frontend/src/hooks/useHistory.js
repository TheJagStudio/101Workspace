import { useCallback, useRef } from 'react';
import debounce from 'lodash/debounce';

const useHistory = (initialState) => {
  const history = useRef({
    past: [],
    present: initialState,
    future: []
  });

  const setState = useCallback((action) => {
    const newPresent = typeof action === 'function' 
      ? action(history.current.present)
      : action;

    history.current = {
      past: [...history.current.past, history.current.present],
      present: newPresent,
      future: []
    };

    return newPresent;
  }, []);

  const undo = useCallback(() => {
    const { past, present, future } = history.current;
    if (past.length === 0) return present;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    history.current = {
      past: newPast,
      present: previous,
      future: [present, ...future]
    };

    return previous;
  }, []);

  const redo = useCallback(() => {
    const { past, present, future } = history.current;
    if (future.length === 0) return present;

    const next = future[0];
    const newFuture = future.slice(1);

    history.current = {
      past: [...past, present],
      present: next,
      future: newFuture
    };

    return next;
  }, []);

  // Debounce the setState to prevent too many history entries
  const debouncedSetState = useCallback(
    debounce((action) => setState(action), 100),
    [setState]
  );

  return {
    state: history.current.present,
    setState: debouncedSetState,
    undo,
    redo,
    canUndo: history.current.past.length > 0,
    canRedo: history.current.future.length > 0
  };
};

export default useHistory;
