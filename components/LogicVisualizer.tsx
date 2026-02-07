
import React, { useMemo } from 'react';
import { VisualItem } from '../types';

interface LogicVisualizerProps {
  items: VisualItem[];
  title?: string;
}

const MermaidRenderer: React.FC<{ item: VisualItem }> = ({ item }) => {
  const imageUrl = useMemo(() => {
    if (item.type !== 'mermaid') return null;
    try {
      const cleanCode = item.content.trim();
      // Ensure the code starts with a valid mermaid keyword
      const encoded = btoa(unescape(encodeURIComponent(cleanCode)));
      return `https://mermaid.ink/img/${encoded}?bgColor=ffffff`;
    } catch (e) {
      return null;
    }
  }, [item]);

  if (!imageUrl) return null;

  return (
    <div className="w-full mb-10 last:mb-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm overflow-hidden flex flex-col items-center">
        <img 
          src={imageUrl} 
          alt="Logic Diagram" 
          className="max-w-full h-auto object-contain rounded-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="w-full mt-4 flex justify-between items-center border-t border-stone-50 pt-3">
          <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">Logic Architecture</span>
          <span className="text-[10px] text-stone-300">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LogicVisualizer: React.FC<LogicVisualizerProps> = ({ items, title }) => {
  const mermaidItems = useMemo(() => items.filter(i => i.type === 'mermaid'), [items]);

  if (mermaidItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-stone-300 p-12 text-center">
        <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <p className="text-lg font-bold text-stone-400">Diagram Studio</p>
        <p className="text-sm mt-2 max-w-xs">Structural logic maps will appear here as we discuss complex architectures.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-50/50 rounded-[2.5rem] border border-stone-200 shadow-sm overflow-hidden">
      <div className="bg-white/80 backdrop-blur-md px-8 py-5 border-b border-stone-200 flex items-center justify-between sticky top-0 z-10">
        <span className="text-xs font-bold text-stone-800 uppercase tracking-widest">{title || "Active Blueprint Stack"}</span>
        <span className="px-3 py-1 bg-violet-600 text-white text-[10px] font-bold rounded-full">
          {mermaidItems.length} Map{mermaidItems.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="flex-1 p-8 overflow-y-auto space-y-4">
        {mermaidItems.map((item) => (
          <MermaidRenderer key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
};
