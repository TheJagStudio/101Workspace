// Temporary file to show the merged handleMouseMove function
const handleMouseMove = useCallback((e) => {
    // Handle panning
    if (isPanning) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        setTransform(prev => ({
            ...prev,
            x: prev.x + dx / prev.scale,
            y: prev.y + dy / prev.scale
        }));
        setLastMousePos({ x: e.clientX, y: e.clientY });
        return;
    }

    // Handle element manipulation
    if (!action.type || !initialElementState) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const dx = e.clientX - initialMousePos.x;
    const dy = e.clientY - initialMousePos.y;

    // Apply transform scale to the deltas
    const scaledDx = dx / transform.scale;
    const scaledDy = dy / transform.scale;

    let newPos = { ...initialElementState.posPx };
    let newSize = { ...initialElementState.sizePx };

    if (action.type === 'move') {
        newPos.x += scaledDx;
        newPos.y += scaledDy;
    } else if (action.type === 'resize') {
        if (action.handle.includes('right')) newSize.width += scaledDx;
        if (action.handle.includes('left')) {
            newSize.width -= scaledDx;
            newPos.x += scaledDx;
        }
        if (action.handle.includes('bottom')) newSize.height += scaledDy;
        if (action.handle.includes('top')) {
            newSize.height -= scaledDy;
            newPos.y += scaledDy;
        }
    }

    // Convert back to percentages
    const posPercent = {
        x: (newPos.x / canvasRect.width) * 100,
        y: (newPos.y / canvasRect.height) * 100
    };
    const sizePercent = {
        width: (newSize.width / canvasRect.width) * 100,
        height: (newSize.height / canvasRect.height) * 100
    };

    const newPages = [...pages];
    const element = newPages[activePage].elements.find(
        el => el.id === action.elementId
    );
    if (element) {
        element.position = posPercent;
        element.size = sizePercent;
        updatePages(newPages);
    }
}, [action, initialElementState, initialMousePos, isPanning, lastMousePos, pages, activePage, transform.scale, updatePages]);
