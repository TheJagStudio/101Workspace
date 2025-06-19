const getElementBounds = (element) => ({
    left: element.position.x,
    right: element.position.x + element.size.width,
    top: element.position.y,
    bottom: element.position.y + element.size.height,
    width: element.size.width,
    height: element.size.height,
    centerX: element.position.x + element.size.width / 2,
    centerY: element.position.y + element.size.height / 2
});

const alignElements = (elements, type) => {
    if (elements.length < 2) return elements;

    const bounds = elements.map(getElementBounds);
    const newElements = [...elements];

    switch (type) {
        case 'left': {
            const minX = Math.min(...bounds.map(b => b.left));
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, x: minX }
                };
            });
            break;
        }
        case 'centerX': {
            const avgCenter = bounds.reduce((sum, b) => sum + b.centerX, 0) / bounds.length;
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, x: avgCenter - el.size.width / 2 }
                };
            });
            break;
        }
        case 'right': {
            const maxX = Math.max(...bounds.map(b => b.right));
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, x: maxX - el.size.width }
                };
            });
            break;
        }
        case 'top': {
            const minY = Math.min(...bounds.map(b => b.top));
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, y: minY }
                };
            });
            break;
        }
        case 'centerY': {
            const avgCenter = bounds.reduce((sum, b) => sum + b.centerY, 0) / bounds.length;
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, y: avgCenter - el.size.height / 2 }
                };
            });
            break;
        }
        case 'bottom': {
            const maxY = Math.max(...bounds.map(b => b.bottom));
            elements.forEach((el, i) => {
                newElements[i] = {
                    ...el,
                    position: { ...el.position, y: maxY - el.size.height }
                };
            });
            break;
        }
        case 'distributeX': {
            const sorted = elements.sort((a, b) => a.position.x - b.position.x);
            const first = getElementBounds(sorted[0]);
            const last = getElementBounds(sorted[sorted.length - 1]);
            const totalSpace = last.right - first.left;
            const totalWidth = bounds.reduce((sum, b) => sum + b.width, 0);
            const spacing = (totalSpace - totalWidth) / (elements.length - 1);
            let currentX = first.left;
            sorted.forEach((el, i) => {
                if (i === 0) return;
                if (i === sorted.length - 1) return;
                newElements[elements.indexOf(el)] = {
                    ...el,
                    position: { ...el.position, x: currentX + spacing }
                };
                currentX += el.size.width + spacing;
            });
            break;
        }
        case 'distributeY': {
            const sorted = elements.sort((a, b) => a.position.y - b.position.y);
            const first = getElementBounds(sorted[0]);
            const last = getElementBounds(sorted[sorted.length - 1]);
            const totalSpace = last.bottom - first.top;
            const totalHeight = bounds.reduce((sum, b) => sum + b.height, 0);
            const spacing = (totalSpace - totalHeight) / (elements.length - 1);
            let currentY = first.top;
            sorted.forEach((el, i) => {
                if (i === 0) return;
                if (i === sorted.length - 1) return;
                newElements[elements.indexOf(el)] = {
                    ...el,
                    position: { ...el.position, y: currentY + spacing }
                };
                currentY += el.size.height + spacing;
            });
            break;
        }
    }

    return newElements;
};
