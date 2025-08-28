import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, delay = 300 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    setIsVisible(true);
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, delay);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
    setShowTooltip(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {showTooltip && (
        <>
          <div
            className="fixed z-[99999] px-2 py-1 text-xs text-white bg-gray-900/60 translate-x-[-50%] translate-y-[-110%] rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
            style={{
              left: mousePos.x,
              top: mousePos.y,
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 150ms ease-in-out',
            }}
          >
            {content}
          </div>
        </>
      )}
    </div>
  );
};
