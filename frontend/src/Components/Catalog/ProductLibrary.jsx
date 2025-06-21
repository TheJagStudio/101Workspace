import React from 'react';
import { Image } from 'lucide-react';

const ProductLibrary = ({ products, onProductDragStart }) => {
  const handleDragStart = (product, e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'product',
      data: product
    }));
    onProductDragStart(product);
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Products</h3>
      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            draggable
            onDragStart={(e) => handleDragStart(product, e)}
            className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 cursor-move hover:shadow-md transition-shadow"
          >
            <div className="aspect-square relative bg-gray-100 rounded-md mb-2 overflow-hidden">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>
            <h4 className="text-sm font-medium text-gray-800 truncate">{product.name}</h4>
            <p className="text-xs text-gray-500 truncate">{product.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductLibrary;
