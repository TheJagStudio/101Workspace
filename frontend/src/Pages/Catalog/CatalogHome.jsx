import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Move,
    Grid,
    Image,
    Type,
    Plus,
    Trash2,
    RotateCw,
    Save,
    Upload,
    Settings,
    Copy,
    Eye,
    Download,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Bold,
    Italic,
    Underline,
    AlignCenter,
    AlignLeft,
    AlignRight,
    Layers,
    EyeOff,
    Lock,
    Unlock,
    GripHorizontal,
    Square,
    Circle,
    Triangle,
    Minus,
    Group,
    Ungroup,
    ZoomIn,
    ZoomOut,
    MoveHorizontal,
    AlignStartHorizontal,
    AlignCenterHorizontal,
    AlignEndHorizontal,
    AlignStartVertical,
    AlignCenterVertical,
    AlignEndVertical,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ProductLibrary from '../../components/ProductLibrary';
import PropertiesPanel from '../../components/PropertiesPanel';
import ShapeElement from '../../components/ShapeElement';
import PageThumbnail from '../../components/PageThumbnail';
import AlignmentTools from '../../components/AlignmentTools';
import {alignElements} from '../../utils/elementAlignment';

// A custom hook to keep state in sync with localStorage
const useLocalStorageState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
        try {
            const storedValue = window.localStorage.getItem(key);
            return storedValue ? JSON.parse(storedValue) : defaultValue;
        } catch (error) {
            console.error("Error reading from localStorage", error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error("Error writing to localStorage", error);
        }
    }, [key, state]);

    return [state, setState];
};


// Default data for initialization
const initialElements = [
    {
        id: 'title-1',
        type: 'text',
        content: 'KRATOM EXTRACT',
        position: { x: 50, y: 5 },
        size: { width: 40, height: 5 },
        style: {
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#4F46E5', // Indigo-600
            textAlign: 'center',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
            transform: 'rotate(0deg)',
        }
    },
    {
        id: 'sidebar-1',
        type: 'text',
        content: 'EXTRACT SHOT',
        position: { x: 92, y: 50 },
        size: { width: 30, height: 4 },
        style: {
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#F9FAFB', // Gray-50
            backgroundColor: '#1F2937', // Gray-800
            padding: '20px 10px',
            textAlign: 'center',
            transform: 'rotate(90deg)',
            borderRadius: '0.375rem',
        }
    }
];

const initialProducts = [
    { id: 1, name: 'GRAVITY ORGANICS', description: '10ML/CT - 12CT/BX', image: 'https://placehold.co/150x150/f0f0f0/333?text=Product' },
    { id: 2, name: 'ICON 200', description: '15ML/CT - 12CT/BX', image: 'https://placehold.co/150x150/f0f0f0/333?text=Product' },
    { id: 3, name: 'ICON 500', description: '15ML/CT - 12CT/BX', image: 'https://placehold.co/150x150/f0f0f0/333?text=Product' },
    { id: 4, name: 'JUK 333', description: '15ML/CT - 12CT/BX', image: 'https://placehold.co/150x150/f0f0f0/333?text=Product' },
    { id: 5, name: 'HUSH KRATOM', description: '10ML/CT - 12CT/BX', image: 'https://placehold.co/150x150/f0f0f0/333?text=Product' },
];

const initialSettings = {
    topBackground: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%234F46E5\'/%3E%3Cpath d=\'M 25 50 C 25 63.807 36.193 75 50 75 C 63.807 75 75 63.807 75 50 C 75 36.193 63.807 25 50 25 C 36.193 25 25 36.193 25 50\' fill=\'%234338CA\' stroke=\'%236366F1\' stroke-width=\'1\'/%3E%3C/svg%3E")',
    bottomBackground: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' fill=\'%23F3F4F6\'/%3E%3C/svg%3E")',
    generalBackground: '#F9FAFB', // Gray-50
    gridColumns: 5,
    gridGap: 16,
    pageWidth: 800,
    pageHeight: 1100,
};


// Initial state for a new page
const createNewPage = (pageNumber) => ({
    id: `page-${Date.now()}`,
    pageNumber,
    elements: [],
    settings: {
        ...initialSettings,
        pageNumber
    }
});

const CollapsibleSection = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="border border-gray-200 rounded-lg mb-4 bg-white shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center px-4 py-3 font-medium text-gray-900 hover:bg-gray-50 transition-colors duration-150"
            >
                {title}
                {isOpen ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
            </button>
            {isOpen && <div className="p-4 border-t border-gray-200 bg-gray-50">{children}</div>}
        </div>
    );
};


export default function CatalogHome() {
    // Multi-page state
    const [pages, setPages] = useLocalStorageState('catalog-pages', [
        {
            id: 'page-1',
            pageNumber: 1,
            elements: initialElements,
            settings: initialSettings
        }
    ]);
    const [activePage, setActivePage] = useState(0);
    const [selectedElement, setSelectedElement] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [action, setAction] = useState({ type: null });
    const [selectedElements, setSelectedElements] = useState(new Set());
    const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [shapes] = useState([
        { type: 'rectangle', icon: Square },
        { type: 'circle', icon: Circle },
        { type: 'triangle', icon: Triangle },
        { type: 'line', icon: Minus }
    ]);
    const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
    const [initialElementState, setInitialElementState] = useState(null);
    const [activeTab, setActiveTab] = useState('elements');

    const canvasRef = useRef(null);
    const elementRefs = useRef({});

    // Add keyboard event handlers for panning
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'Space' && !isPanning) {
                setIsPanning(true);
                document.body.style.cursor = 'grab';
            }
        };

        const handleKeyUp = (e) => {
            if (e.code === 'Space') {
                setIsPanning(false);
                document.body.style.cursor = 'default';
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isPanning]);

    // Add zoom handlers
    const handleZoomIn = () => {
        setTransform(prev => ({
            ...prev,
            scale: Math.min(prev.scale * 1.2, 3)
        }));
    };

    const handleZoomOut = () => {
        setTransform(prev => ({
            ...prev,
            scale: Math.max(prev.scale / 1.2, 0.3)
        }));
    };

    // Updated mouse handlers
    const handleMouseDown = (e, element) => {
        if (isPanning) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / (rect.width * transform.scale)) * 100;
        const y = ((e.clientY - rect.top) / (rect.height * transform.scale)) * 100;

        setIsDragging(true);
        setStartPos({ x, y });
        setInitialMousePos({ x: e.clientX, y: e.clientY });
        setInitialElementState({
            position: { ...element.position },
            size: { ...element.size }
        });
        setSelectedElement(element);

        if (!e.shiftKey) {
            setSelectedElements(new Set([element.id]));
        }
    };

    const handleMouseMove = useCallback((e) => {
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

        if (isDragging && selectedElement) {
            const rect = canvasRef.current.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / (rect.width * transform.scale)) * 100;
            const y = ((e.clientY - rect.top) / (rect.height * transform.scale)) * 100;
            
            const deltaX = x - startPos.x;
            const deltaY = y - startPos.y;

            const newPages = [...pages];
            selectedElements.forEach(id => {
                const element = newPages[activePage].elements.find(el => el.id === id);
                if (element) {
                    element.position = {
                        x: element.position.x + deltaX,
                        y: element.position.y + deltaY
                    };
                }
            });

            setPages(newPages);
            setStartPos({ x, y });
        }
    }, [isDragging, selectedElement, pages, activePage, startPos, isPanning, lastMousePos, transform.scale, selectedElements]);

    const handleMouseUp = () => {
        setIsDragging(false);
        setAction({ type: null });
    };

    // Selection handlers
    const handleElementClick = (e, element) => {
        e.stopPropagation();
        if (e.shiftKey) {
            setSelectedElements(prev => {
                const newSet = new Set(prev);
                if (newSet.has(element.id)) {
                    newSet.delete(element.id);
                } else {
                    newSet.add(element.id);
                }
                return newSet;
            });
        } else {
            setSelectedElements(new Set([element.id]));
        }
        setSelectedElement(element);
    };

    // Group handlers
    const handleGroup = () => {
        if (selectedElements.size < 2) return;

        const selectedElementsArray = Array.from(selectedElements);
        const elementsToGroup = selectedElementsArray.map(id => 
            pages[activePage].elements.find(el => el.id === id)
        ).filter(Boolean);

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
            children: selectedElementsArray,
            position: { x: bounds.left, y: bounds.top },
            size: {
                width: bounds.right - bounds.left,
                height: bounds.bottom - bounds.top
            },
            style: {}
        };

        const newPages = [...pages];
        newPages[activePage].elements = newPages[activePage].elements.filter(
            el => !selectedElementsArray.includes(el.id)
        );
        newPages[activePage].elements.push(groupElement);
        
        setPages(newPages);
        setSelectedElements(new Set([groupElement.id]));
        setSelectedElement(groupElement);
    };

    const handleUngroup = () => {
        if (!selectedElement?.type === 'group') return;

        const groupElement = pages[activePage].elements.find(
            el => el.id === selectedElement.id
        );

        if (!groupElement) return;

        const newPages = [...pages];
        const childElements = groupElement.children
            .map(childId => pages[activePage].elements.find(el => el.id === childId))
            .filter(Boolean);

        // Remove group and add back children
        newPages[activePage].elements = newPages[activePage].elements.filter(
            el => el.id !== groupElement.id
        );
        newPages[activePage].elements.push(...childElements);

        setPages(newPages);
        setSelectedElements(new Set(childElements.map(child => child.id)));
        setSelectedElement(null);
    };

    // Alignment handler
    const handleAlign = (type) => {
        if (selectedElements.size < 2) return;

        const selectedElementsArray = Array.from(selectedElements)
            .map(id => pages[activePage].elements.find(el => el.id === id))
            .filter(Boolean);

        const alignedElements = alignElements(selectedElementsArray, type);
        const newPages = [...pages];
        
        alignedElements.forEach(alignedEl => {
            const index = newPages[activePage].elements.findIndex(el => el.id === alignedEl.id);
            if (index !== -1) {
                newPages[activePage].elements[index] = alignedEl;
            }
        });

        setPages(newPages);
    };

    // -- RENDER --
    return (
        <div 
            className="flex h-screen bg-gray-50"
            tabIndex={-1}
        >
            {/* Left Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-700">Catalog Editor</h2>
                </div>
                
                {/* Sidebar Tabs */}
                <div className="flex border-b border-gray-200">
                    <button
                        className={`flex-1 py-2 text-sm font-medium ${activeTab === 'elements' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('elements')}
                    >
                        Elements
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-medium ${activeTab === 'products' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('products')}
                    >
                        Products
                    </button>
                    <button
                        className={`flex-1 py-2 text-sm font-medium ${activeTab === 'layers' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'}`}
                        onClick={() => setActiveTab('layers')}
                    >
                        Layers
                    </button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'elements' && (
                        <div className="p-4 space-y-4">
                            <button
                                onClick={() => addElement('text')}
                                className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                            >
                                <Type size={16} />
                                <span>Add Text</span>
                            </button>
                            <button
                                onClick={() => addElement('image')}
                                className="w-full flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                            >
                                <Image size={16} />
                                <span>Add Image</span>
                            </button>
                            
                            {/* Shapes Section */}
                            <div className="border-t border-gray-200 pt-4">
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Shapes</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {shapes.map(({ type, icon: Icon }) => (
                                        <button
                                            key={type}
                                            onClick={() => addElement('shape', { shapeType: type })}
                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                                        >
                                            <Icon size={16} />
                                            <span className="capitalize">{type}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'products' && (
                        <ProductLibrary
                            products={products}
                            onProductDragStart={() => {}}
                        />
                    )}
                    {activeTab === 'layers' && (
                        <div className="p-4">
                            <div className="space-y-2">
                                {pages[activePage].elements.map((element) => (
                                    <div
                                        key={element.id}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                                            selectedElements.has(element.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'
                                        }`}
                                        onClick={(e) => handleElementClick(e, element)}
                                    >
                                        <GripHorizontal size={16} className="text-gray-400" />
                                        <span className="text-sm truncate">
                                            {element.type === 'text' ? element.content : 
                                             element.type === 'group' ? `Group (${element.children.length})` :
                                             `${element.type} ${element.id.split('-')[1]}`}
                                        </span>
                                        {element.visible !== false && <Eye size={16} className="ml-auto text-gray-400" />}
                                        {element.visible === false && <EyeOff size={16} className="ml-auto text-gray-400" />}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 overflow-hidden flex flex-col">
                {/* Toolbar */}
                <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-4">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleZoomOut}
                            className="p-1 rounded hover:bg-gray-100"
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-sm">{Math.round(transform.scale * 100)}%</span>
                        <button
                            onClick={handleZoomIn}
                            className="p-1 rounded hover:bg-gray-100"
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>

                    {/* Alignment Tools */}
                    <AlignmentTools
                        onAlign={handleAlign}
                        selectedElements={selectedElements}
                        disabled={selectedElements.size < 2}
                    />

                    {/* Group Controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleGroup}
                            disabled={selectedElements.size < 2}
                            className={`p-1 rounded hover:bg-gray-100 ${
                                selectedElements.size < 2 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Group Elements"
                        >
                            <Group size={16} />
                        </button>
                        <button
                            onClick={handleUngroup}
                            disabled={!selectedElement?.type === 'group'}
                            className={`p-1 rounded hover:bg-gray-100 ${
                                !selectedElement?.type === 'group' ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            title="Ungroup Elements"
                        >
                            <Ungroup size={16} />
                        </button>
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-auto p-8 bg-gray-100">
                    <div
                        ref={canvasRef}
                        className="w-[8.5in] h-[11in] bg-white mx-auto shadow-lg transform origin-center"
                        style={{
                            ...pages[activePage].style,
                            transform: `scale(${transform.scale}) translate(${transform.x}px, ${transform.y}px)`
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        // onDrop={handleDrop}
                        onClick={() => {
                            setSelectedElement(null);
                            setSelectedElements(new Set());
                        }}
                    >
                        {pages[activePage].elements.map((element) => (
                            <div
                                key={element.id}
                                ref={(el) => elementRefs.current[element.id] = el}
                                className={`absolute ${
                                    selectedElements.has(element.id) ? 'outline-2 outline-blue-500' : ''
                                }`}
                                style={{
                                    left: `${element.position.x}%`,
                                    top: `${element.position.y}%`,
                                    width: `${element.size.width}%`,
                                    height: `${element.size.height}%`,
                                    cursor: isPanning ? 'grab' : 'move',
                                    ...element.style
                                }}
                                onClick={(e) => handleElementClick(e, element)}
                                onMouseDown={(e) => handleMouseDown(e, element)}
                            >
                                {element.type === 'text' && (
                                    <div
                                        contentEditable={selectedElements.has(element.id)}
                                        suppressContentEditableWarning={true}
                                        onBlur={(e) => {
                                            handleElementUpdate(element.id, {
                                                content: e.target.innerHTML
                                            });
                                        }}
                                        dangerouslySetInnerHTML={{ __html: element.content }}
                                        className="w-full h-full"
                                    />
                                )}
                                {element.type === 'image' && (
                                    <img
                                        src={element.content}
                                        alt=""
                                        className="w-full h-full object-contain"
                                    />
                                )}
                                {element.type === 'shape' && (
                                    <ShapeElement
                                        shape={element.shapeType}
                                        style={element.style}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Page Navigator */}
                <div className="h-32 border-t border-gray-200 overflow-x-auto whitespace-nowrap">
                    <div className="flex gap-4 p-4">
                        {pages.map((page, index) => (
                            <PageThumbnail
                                key={index}
                                page={page}
                                isActive={index === activePage}
                                onClick={() => setActivePage(index)}
                            />
                        ))}
                        <button
                            // onClick={addPage}
                            className="w-[85px] h-[110px] border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Properties Panel */}
            <PropertiesPanel
                selectedElement={selectedElement}
                // onElementUpdate={handleElementUpdate}
                activePage={pages[activePage]}
            />
        </div>
    );
}

// Canvas Element Component
const CanvasElement = ({ element, isSelected, onMouseDown }) => {
    const style = {
        ...element.style,
        position: 'absolute',
        left: `${element.position.x}%`,
        top: `${element.position.y}%`,
        width: `${element.size.width}%`,
        height: `${element.size.height}%`,
        cursor: element.locked ? 'not-allowed' : 'move',
        userSelect: 'none',
        backgroundColor: element.style.backgroundColor || 'transparent',
        transition: 'box-shadow 150ms ease-in-out',
    };

    if (element.style?.display === 'none') {
        return null;
    }

    const handleMouseDown = (e, id, handle) => {
        if (element.locked) {
            return;
        }
        onMouseDown(e, id, handle);
    };

    return (
        <div
            onMouseDown={(e) => handleMouseDown(e, element.id)}
            style={style}
            className={`group ${isSelected
                ? 'ring-2 ring-blue-500 ring-offset-1'
                : element.locked
                    ? 'ring-1 ring-gray-300 ring-offset-1'
                    : 'hover:ring-2 hover:ring-gray-400 hover:ring-offset-1'
                }`}
        >
            {element.type === 'text' && (
                <div className="w-full h-full flex items-center justify-center">
                    {element.content}
                </div>
            )}
            {element.type === 'image' && (
                <img src={element.content} alt="" className="w-full h-full object-contain" />
            )}

            {isSelected && !element.locked && (
                <>
                    {/* Resize handles */}
                    <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-nw-resize shadow-sm"
                        onMouseDown={(e) => handleMouseDown(e, element.id, 'nw')} />
                    <div className="absolute -right-1.5 -top-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-ne-resize shadow-sm"
                        onMouseDown={(e) => handleMouseDown(e, element.id, 'ne')} />
                    <div className="absolute -left-1.5 -bottom-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-sw-resize shadow-sm"
                        onMouseDown={(e) => handleMouseDown(e, element.id, 'sw')} />
                    <div className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-se-resize shadow-sm"
                        onMouseDown={(e) => handleMouseDown(e, element.id, 'se')} />

                    {/* Rotation handle */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-pointer group/rotate"
                        onMouseDown={(e) => handleMouseDown(e, element.id, 'rotate')}>
                        <RotateCw size={14} className="text-blue-500 group-hover/rotate:text-blue-600" />
                    </div>
                </>
            )}
        </div>
    );
};

// Layer Panel Component
const LayerPanel = ({ elements, selectedElementId, onSelectElement, onUpdateElement, onReorderElements }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedItem(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedItem === null) return;

        const items = [...elements];
        const draggedItemContent = items[draggedItem];
        items.splice(draggedItem, 1);
        items.splice(index, 0, draggedItemContent);

        onReorderElements(items);
        setDraggedItem(index);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const toggleVisibility = (elementId) => {
        const element = elements.find(el => el.id === elementId);
        onUpdateElement(elementId, {
            style: {
                ...element.style,
                display: element.style.display === 'none' ? 'block' : 'none'
            }
        });
    };

    const toggleLock = (elementId) => {
        const element = elements.find(el => el.id === elementId);
        onUpdateElement(elementId, { locked: !element.locked });
    };

    return (
        <div className={`border-l border-gray-200 bg-white transition-all duration-200 ${isCollapsed ? 'w-12' : 'w-64'}`}>
            <div className="h-14 border-b border-gray-200 flex items-center px-4 justify-between">
                <div className="flex items-center gap-2">
                    {!isCollapsed && (<Layers size={18} className="text-gray-600" />)}
                    {!isCollapsed && <span className="font-medium text-sm">Layers</span>}
                </div>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-1 hover:bg-gray-100 rounded"
                >
                    {isCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                </button>
            </div>

            {!isCollapsed && (
                <div className="p-2 space-y-1">
                    {elements.map((element, index) => (
                        <div
                            key={element.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`flex items-center gap-2 p-2 rounded cursor-move
                ${selectedElementId === element.id ? 'bg-blue-50' : 'hover:bg-gray-50'}
                ${draggedItem === index ? 'opacity-50' : 'opacity-100'}
              `}
                            onClick={() => onSelectElement(element.id)}
                        >
                            <GripHorizontal size={14} className="text-gray-400" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleVisibility(element.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                {element.style?.display === 'none' ? (
                                    <EyeOff size={14} className="text-gray-400" />
                                ) : (
                                    <Eye size={14} className="text-gray-600" />
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLock(element.id);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                {element.locked ? (
                                    <Lock size={14} className="text-gray-600" />
                                ) : (
                                    <Unlock size={14} className="text-gray-400" />
                                )}
                            </button>
                            <span className="text-sm truncate flex-1">
                                {element.type === 'text' ? element.content : `Image ${index + 1}`}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Page Navigator Component
const PageNavigator = ({ pages, activePageIndex, onPageSelect, onAddPage, onDeletePage, onReorderPages }) => {
    const [draggedPageIndex, setDraggedPageIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedPageIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedPageIndex === null) return;
        if (draggedPageIndex !== index) {
            onReorderPages(draggedPageIndex, index);
            setDraggedPageIndex(index);
        }
    };

    return (
        <div className=" bg-white w-full border-t border-gray-200 p-2">
            <div className="flex items-center gap-2 overflow-x-auto overflow-visible p-2">
                {pages.map((page, index) => (
                    <div
                        key={page.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={() => setDraggedPageIndex(null)}
                        className={`relative group rounded-lg cursor-move ${index === activePageIndex ? 'ring-4 ring-offset-2 ring-blue-500' : ''}`}
                    >
                        {/* Page Thumbnail */}
                        <div
                            onClick={() => onPageSelect(index)}
                            className="w-20 h-28 bg-white border border-gray-200 hover:border-gray-300 rounded-lg overflow-visible"
                        >
                            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                Page {page.pageNumber}
                            </div>
                        </div>

                        {/* Delete button */}
                        {pages.length > 1 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeletePage(index);
                                }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full 
                           opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                ))}

                {/* Add page button */}
                <button
                    onClick={onAddPage}
                    className="w-20 h-28 border-2 border-dashed border-gray-300 rounded-lg 
                     hover:border-gray-400 flex items-center justify-center text-gray-400 
                     hover:text-gray-500 transition-colors"
                >
                    <Plus size={24} />
                </button>
            </div>
        </div>
    );
};
