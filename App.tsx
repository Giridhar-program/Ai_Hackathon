
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessageToGemini } from './services/geminiService';
import { KnowledgeLevel, Message, PaneTab, LogicDiagram, VisualItem } from './types';
import { TEMPLATES, INITIAL_KNOWLEDGE_LEVEL } from './constants';
import { LogicVisualizer } from './components/LogicVisualizer';
import { Toast } from './components/Toast';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const UserIcon = () => (
  <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center shrink-0">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  </div>
);

const AiIcon = () => (
  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-100">
    <span className="text-white font-bold text-[10px]">E</span>
  </div>
);

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Greetings. I am **Encrypt**. \n\nI architect logic streams to help you understand systems deeply. \n\nKeywords in [[Blue]] are interactive, providing instant context. What shall we explore today?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel>(INITIAL_KNOWLEDGE_LEVEL);
  const [activeTab, setActiveTab] = useState<PaneTab>(PaneTab.VISUALIZER);
  const [visualization, setVisualization] = useState<LogicDiagram>({ items: [] });
  const [mentorMode, setMentorMode] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [activeTerm, setActiveTerm] = useState<{ term: string, definition: string | null, isLoading: boolean } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchTermDefinition = async (term: string) => {
    setActiveTerm({ term, definition: null, isLoading: true });
    try {
      // Re-initialize to ensure environment variable access
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Briefly explain the concept of "${term}" in a Socratic, educational tone. Max 25 words. No code.`,
      });
      setActiveTerm({ term, definition: response.text || "Definition unreachable.", isLoading: false });
    } catch (e) {
      console.error("Glossary Error:", e);
      setActiveTerm(null);
      setToastMsg("Connection error. Please check your settings.");
      setShowToast(true);
    }
  };

  const MarkdownRender: Components = {
    p: ({children}) => {
      if (typeof children === 'string') {
        const parts = children.split(/(\[\[.*?\]\])/g);
        return (
          <p className="mb-4 leading-relaxed last:mb-0">
            {parts.map((part, i) => {
              if (part.startsWith('[[') && part.endsWith(']]')) {
                const term = part.slice(2, -2);
                return (
                  <button
                    key={i}
                    onClick={() => fetchTermDefinition(term)}
                    className="text-blue-600 hover:text-blue-800 underline decoration-blue-200 hover:decoration-blue-600 transition-all font-medium cursor-help"
                  >
                    {term}
                  </button>
                );
              }
              return part;
            })}
          </p>
        );
      }
      return <p className="mb-4 leading-relaxed last:mb-0">{children}</p>;
    },
    code: ({node, inline, children, ...props}: any) => (
      inline 
        ? <code className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded text-[0.9em] border border-stone-200" {...props}>{children}</code>
        : <div className="bg-stone-900 text-stone-300 p-4 rounded-xl my-4 overflow-x-auto text-xs font-mono shadow-inner border border-stone-800">{children}</div>
    )
  };

  const handleSendMessage = useCallback(async (customPrompt?: string) => {
    const text = customPrompt || input;
    if (!text.trim() || isLoading) return;

    if (!customPrompt && /(code|write|solution|answer|full code)/i.test(text.toLowerCase())) {
      setToastMsg("Encrypt focuses on logic architecture. Direct solutions are restricted.");
      setShowToast(true);
      return;
    }

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await sendMessageToGemini(history, text, knowledgeLevel);
      
      const newAiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text, timestamp: Date.now() };
      setMessages(prev => [...prev, newAiMsg]);

      // Extract Mermaid strictly
      const mermaidRegex = /```mermaid\s*([\s\S]*?)```/gi;
      let match;
      const newItems: VisualItem[] = [];
      while ((match = mermaidRegex.exec(response.text)) !== null) {
        newItems.push({
          id: `mermaid-${Date.now()}-${Math.random()}`,
          type: 'mermaid',
          content: match[1].trim(),
          timestamp: Date.now()
        });
      }

      if (newItems.length > 0) {
        setVisualization(prev => ({ ...prev, items: [...prev.items, ...newItems] }));
        setActiveTab(PaneTab.VISUALIZER);
      }

      if (response.mentorStatus) setMentorMode(response.mentorStatus === 'satisfied');
    } catch (error) {
      console.error("Chat Error:", error);
      setToastMsg("Logical connection lost. Please rephrase or refresh.");
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, knowledgeLevel, isLoading]);

  return (
    <div className="flex h-screen w-screen bg-white text-stone-900 font-sans overflow-hidden">
      <Toast message={toastMsg} isVisible={showToast} onClose={() => setShowToast(false)} />
      
      {/* INSIGHT OVERLAY */}
      {activeTerm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setActiveTerm(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 border border-stone-100 animate-in zoom-in duration-200">
             <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-stone-900 text-lg uppercase tracking-tight">{activeTerm.term}</h4>
                <button onClick={() => setActiveTerm(null)} className="text-stone-300 hover:text-stone-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
             </div>
             <div className="text-sm text-stone-600 leading-relaxed min-h-[40px]">
                {activeTerm.isLoading ? (
                  <div className="flex gap-1.5 py-2">
                    <div className="w-1 h-1 bg-stone-300 rounded-full animate-ping"></div>
                    <div className="w-1 h-1 bg-stone-300 rounded-full animate-ping delay-75"></div>
                    <div className="w-1 h-1 bg-stone-300 rounded-full animate-ping delay-150"></div>
                  </div>
                ) : activeTerm.definition}
             </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-100 flex items-center justify-between px-8 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-violet-100">E</div>
          <h1 className="font-bold text-lg tracking-tight">Encrypt</h1>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${mentorMode ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-stone-50 border-stone-200 text-stone-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${mentorMode ? 'bg-emerald-500' : 'bg-stone-300 animate-pulse'}`}></div>
          {mentorMode ? 'Logic Validated' : 'Socratic Search'}
        </div>
      </div>

      <main className="flex w-full pt-16 h-full">
        {/* CHAT PANE */}
        <div className="w-1/2 flex flex-col border-r border-stone-100 h-full bg-white">
          <div className="h-14 border-b border-stone-100 flex items-center justify-between px-6 shrink-0">
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Thought Stream</span>
            <div className="flex bg-stone-50 rounded-xl p-1">
              {Object.values(KnowledgeLevel).map((level) => (
                <button key={level} onClick={() => setKnowledgeLevel(level)} className={`px-3 py-1 text-[10px] uppercase font-bold rounded-lg transition-all ${knowledgeLevel === level ? 'bg-white shadow-sm text-violet-600' : 'text-stone-400 hover:text-stone-600'}`}>{level}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-stone-50/10">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'user' ? <UserIcon /> : <AiIcon />}
                <div className={`max-w-[85%] p-5 rounded-[1.5rem] text-sm shadow-sm border ${msg.role === 'user' ? 'bg-stone-900 text-white border-stone-800 rounded-tr-none' : 'bg-white text-stone-800 border-stone-100 rounded-tl-none'}`}>
                  <ReactMarkdown components={MarkdownRender} remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && <div className="flex gap-2 p-4"><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div></div>}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-6 border-t border-stone-100 shrink-0">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                placeholder="Type to architect logic..."
                className="w-full bg-stone-50 border border-stone-100 rounded-3xl px-5 py-4 pr-16 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all resize-none h-16 shadow-inner"
              />
              <button onClick={() => handleSendMessage()} disabled={isLoading || !input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-stone-900 text-white rounded-full hover:bg-violet-600 disabled:bg-stone-200 transition-all shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* BLUEPRINT PANE */}
        <div className="w-1/2 bg-stone-50/50 flex flex-col h-full">
          <div className="h-14 flex border-b border-stone-100 bg-white px-8 pt-4 gap-6 shrink-0">
            {[PaneTab.VISUALIZER, PaneTab.TEMPLATES].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`pb-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab ? 'text-violet-600 border-violet-600' : 'text-stone-300 border-transparent hover:text-stone-500'}`}>
                {tab === PaneTab.VISUALIZER ? 'Logic Blueprint' : 'Library'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            {activeTab === PaneTab.VISUALIZER && <LogicVisualizer items={visualization.items} />}
            {activeTab === PaneTab.TEMPLATES && (
              <div className="grid gap-6">
                {TEMPLATES.map(tpl => (
                  <div key={tpl.id} className="p-8 bg-white border border-stone-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-[9px] font-bold text-violet-500 bg-violet-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{tpl.category}</span>
                      <h4 className="font-bold text-stone-800 text-lg leading-tight">{tpl.title}</h4>
                    </div>
                    <p className="text-xs text-stone-500 mb-6 leading-relaxed">{tpl.description}</p>
                    <div className="bg-stone-50 p-6 rounded-2xl font-mono text-[10px] text-stone-600 whitespace-pre-wrap border border-stone-100">{tpl.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
