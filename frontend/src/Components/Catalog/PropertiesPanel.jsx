import React from 'react';
import { ChromePicker } from 'react-color';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Square,
  Type
} from 'lucide-react';

const PropertiesPanel = ({ selectedElement, onElementUpdate, activePage }) => {
  if (!selectedElement) {
    return (
      <div className="w-64 bg-white border-l border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Page Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Background Color</label>
            <ChromePicker
              color={activePage?.style?.backgroundColor || '#ffffff'}
              onChange={(color) => {
                onElementUpdate('page', {
                  style: { ...activePage.style, backgroundColor: color.hex }
                });
              }}
              className="mt-1"
            />
          </div>
        </div>
      </div>
    );
  }

  const renderControls = () => {
    switch (selectedElement.type) {
      case 'text':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Text Content</label>
              <textarea
                value={selectedElement.content}
                onChange={(e) => onElementUpdate(selectedElement.id, { content: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                rows="3"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Font Size</label>
              <input
                type="number"
                value={parseInt(selectedElement.style.fontSize)}
                onChange={(e) => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, fontSize: `${e.target.value}px` }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Text Color</label>
              <ChromePicker
                color={selectedElement.style.color}
                onChange={(color) => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, color: color.hex }
                })}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, fontWeight: selectedElement.style.fontWeight === 'bold' ? 'normal' : 'bold' }
                })}
                className={`p-2 rounded ${selectedElement.style.fontWeight === 'bold' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <Bold size={16} />
              </button>
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, fontStyle: selectedElement.style.fontStyle === 'italic' ? 'normal' : 'italic' }
                })}
                className={`p-2 rounded ${selectedElement.style.fontStyle === 'italic' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <Italic size={16} />
              </button>
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, textDecoration: selectedElement.style.textDecoration === 'underline' ? 'none' : 'underline' }
                })}
                className={`p-2 rounded ${selectedElement.style.textDecoration === 'underline' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <Underline size={16} />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, textAlign: 'left' }
                })}
                className={`p-2 rounded ${selectedElement.style.textAlign === 'left' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, textAlign: 'center' }
                })}
                className={`p-2 rounded ${selectedElement.style.textAlign === 'center' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <AlignCenter size={16} />
              </button>
              <button
                onClick={() => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, textAlign: 'right' }
                })}
                className={`p-2 rounded ${selectedElement.style.textAlign === 'right' ? 'bg-indigo-100' : 'bg-gray-100'}`}
              >
                <AlignRight size={16} />
              </button>
            </div>
          </>
        );
      case 'image':
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Opacity</label>
              <input
                type="range"
                min="0"
                max="100"
                value={selectedElement.style.opacity * 100}
                onChange={(e) => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, opacity: e.target.value / 100 }
                })}
                className="mt-1 block w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Border Width</label>
              <input
                type="number"
                value={parseInt(selectedElement.style.borderWidth) || 0}
                onChange={(e) => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, borderWidth: `${e.target.value}px` }
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Border Color</label>
              <ChromePicker
                color={selectedElement.style.borderColor || '#000000'}
                onChange={(color) => onElementUpdate(selectedElement.id, {
                  style: { ...selectedElement.style, borderColor: color.hex }
                })}
                className="mt-1"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-64 bg-white border-l border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Properties</h3>
      <div className="space-y-4">
        {renderControls()}
      </div>
    </div>
  );
};

export default PropertiesPanel;
