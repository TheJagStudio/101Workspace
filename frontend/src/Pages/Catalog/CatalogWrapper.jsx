import React from 'react';
import CatalogHome from './CatalogHome';
import { CanvasProvider } from '../../context/CanvasContext';

const CatalogWrapper = () => {
  return (
    <CanvasProvider>
      <CatalogHome />
    </CanvasProvider>
  );
};

export default CatalogWrapper;
