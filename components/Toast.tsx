import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
  type?: 'warning' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose, type = 'warning' }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColors = type === 'warning' 
    ? 'bg-orange-50 border-orange-200 text-orange-800' 
    : 'bg-violet-50 border-violet-200 text-violet-800';

  return (
    <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
      <div className={`backdrop-blur-md border px-6 py-3 rounded-full shadow-xl shadow-stone-200/50 flex items-center gap-3 ${bgColors}`}>
        {type === 'warning' && (
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        )}
        <span className="font-medium tracking-wide text-sm">{message}</span>
      </div>
    </div>
  );
};