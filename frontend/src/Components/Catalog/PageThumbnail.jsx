import React, { useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';

const PageThumbnail = ({ page, isActive, onClick }) => {
  const thumbnailRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const generateThumbnail = async () => {
      if (!thumbnailRef.current) return;

      const canvas = await html2canvas(thumbnailRef.current, {
        scale: 0.2,
        logging: false,
        useCORS: true,
      });

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.drawImage(canvas, 0, 0, 85, 110);
      }
    };

    generateThumbnail();
  }, [page]);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`w-[85px] h-[110px] border-2 rounded overflow-hidden ${
          isActive ? 'border-indigo-600' : 'border-gray-200'
        } hover:border-indigo-400 transition-colors`}
      >
        <canvas
          ref={canvasRef}
          width={85}
          height={110}
          className="w-full h-full"
        />
      </button>

      {/* Hidden div for rendering thumbnail */}
      <div
        ref={thumbnailRef}
        className="fixed left-[-9999px] top-[-9999px] w-[8.5in] h-[11in]"
        style={{ ...page.style }}
      >
        {page.elements.map((element) => (
          <div
            key={element.id}
            className="absolute"
            style={{
              left: `${element.position.x}%`,
              top: `${element.position.y}%`,
              width: `${element.size.width}%`,
              height: `${element.size.height}%`,
              ...element.style,
            }}
          >
            {element.type === 'text' && element.content}
            {element.type === 'image' && (
              <img
                src={element.content}
                alt=""
                className="w-full h-full object-contain"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageThumbnail;
