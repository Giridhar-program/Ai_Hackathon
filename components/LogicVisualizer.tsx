
import React, { useMemo } from 'react';
import { VisualItem } from '../types';

interface LogicVisualizerProps {
  items: VisualItem[];
  title?: string;
}

const VisualRenderer: React.FC<{ item: VisualItem }> = ({ item }) => {
  const imageUrl = useMemo(() => {
    if (item.type === 'image') return item.content;
    try {
      const cleanCode = item.content.trim();
      const encoded = btoa(unescape(encodeURIComponent(cleanCode)));
      return `https://mermaid.ink/img/${encoded}?bgColor=ffffff`;
    } catch (e) {
      console.error("Failed to encode mermaid diagram", e);
      return null;
    }
  }, [item]);

  if (!imageUrl) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full mb-8 last:mb-0">
      <div className="w-full bg-white p-4 rounded-2xl border border-stone-100 shadow-sm transition-all hover:shadow-md">
        <img 
          src={imageUrl} 
          alt="Logic Visualization" 
          className="w-full max-h-[500px] object-contain rounded-xl"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x300?text=Logic+Rendering...';
          }}
        />
        <div className="mt-3 flex justify-between items-center px-1">
          <span className="text-[9px] font-bold text-stone-300 uppercase tracking-[0.2em]">
            {item.type === 'mermaid' ? 'Structural Blueprint' : 'Conceptual Vision'}
          </span>
          <span className="text-[9px] text-stone-300">
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export const LogicVisualizer: React.FC<LogicVisualizerProps> = ({ items, title }) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-stone-400 p-12 text-center border-2 border-dashed border-stone-200 rounded-3xl bg-white/40">
        <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 text-stone-200 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-xl font-bold text-stone-500">Visualization Stream</p>
        <p className="text-sm mt-3 text-stone-400 max-w-xs">As you interact with Encrypt, diagrams and conceptual illustrations will appear here to clarify complex logic.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-50/50 rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
      <div className="bg-white/80 backdrop-blur-md px-6 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-bold text-stone-600 uppercase tracking-widest">{title || "Active Blueprint Stack"}</span>
        </div>
        <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100">
          {items.length} Component{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto bg-stone-50/30 space-y-4">
        {items.map((item) => (
          <VisualRenderer key={item.id} item={item} />
        ))}
      </div>
      
      <div className="bg-white/80 backdrop-blur-md px-6 py-3 border-t border-stone-200 text-center">
         <p className="text-[9px] text-stone-400 uppercase tracking-[0.15em] font-medium">Auto-rendering synchronized with logic stream</p>
      </div>
    </div>
  );
};
