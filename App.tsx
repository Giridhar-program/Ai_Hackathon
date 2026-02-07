import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendMessageToGemini, generateImage, synthesizeTemplate } from './services/geminiService';
import { KnowledgeLevel, Message, PaneTab, TemplateCategory, Template, LogicDiagram, VisualItem } from './types';
import { TEMPLATES, INITIAL_KNOWLEDGE_LEVEL } from './constants';
import { LogicVisualizer } from './components/LogicVisualizer';
import { Toast } from './components/Toast';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

// --- UI COMPONENTS ---

const UserIcon = () => (
  <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200 ring-2 ring-white">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  </div>
);

const AiIcon = ({ isMentor }: { isMentor: boolean }) => (
  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md ring-2 ring-white transition-all ${isMentor ? 'bg-emerald-600 shadow-emerald-200' : 'bg-stone-800 shadow-stone-200'}`}>
    {isMentor ? (
       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
         <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
       </svg>
    ) : (
       <span className="text-white font-bold text-xs tracking-wider">E</span>
    )}
  </div>
);

const QuickAction = ({ label, icon, onClick, disabled }: { label: string, icon: React.ReactNode, onClick: () => void, disabled: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-[10px] font-bold uppercase tracking-wider text-stone-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MarkdownRender: Components = {
  p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-stone-700 last:mb-0" {...props} />,
  h1: ({node, ...props}) => <h1 className="text-lg font-bold text-stone-900 mt-6 mb-3 tracking-tight border-b border-stone-100 pb-2" {...props} />,
  h2: ({node, ...props}) => <h2 className="text-base font-bold text-stone-800 mt-5 mb-2" {...props} />,
  h3: ({node, ...props}) => <h3 className="text-sm font-bold text-stone-800 mt-4 mb-2 uppercase tracking-wide text-violet-700" {...props} />,
  ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1 marker:text-violet-400 text-stone-700" {...props} />,
  ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1 marker:text-violet-400 text-stone-700" {...props} />,
  li: ({node, ...props}) => <li className="pl-1" {...props} />,
  blockquote: ({node, ...props}) => (
    <div className="flex gap-3 my-4">
        <div className="w-1 rounded-full bg-violet-300 shrink-0"></div>
        <blockquote className="italic text-stone-600 py-1" {...props} />
    </div>
  ),
  a: ({node, ...props}) => <a className="text-violet-600 hover:text-violet-800 underline decoration-violet-300 hover:decoration-violet-600 transition-all font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
  code: ({node, inline, className, children, ...props}: any) => {
    return inline ? (
      <code className="font-mono text-[0.9em] bg-stone-100 text-violet-700 px-1.5 py-0.5 rounded border border-stone-200" {...props}>{children}</code>
    ) : (
      <div className="relative group my-4 rounded-xl overflow-hidden shadow-lg border border-stone-800/50">
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#1e1e20] border-b border-stone-700/50">
             <div className="w-2.5 h-2.5 rounded-full bg-red-400/20 group-hover:bg-red-500 transition-colors"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-amber-400/20 group-hover:bg-amber-500 transition-colors"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-green-400/20 group-hover:bg-green-500 transition-colors"></div>
             <div className="ml-auto text-[10px] text-stone-500 font-mono uppercase tracking-widest">Logic Snippet</div>
        </div>
        <pre className="font-mono text-xs bg-[#1e1e20] text-stone-300 p-5 overflow-x-auto m-0 leading-relaxed" {...props}>
          <code>{children}</code>
        </pre>
      </div>
    );
  },
  strong: ({node, ...props}) => <strong className="font-bold text-stone-900 bg-violet-50/80 px-0.5 rounded" {...props} />,
  table: ({node, ...props}) => <div className="overflow-x-auto my-4 rounded-lg border border-stone-200"><table className="min-w-full divide-y divide-stone-200" {...props} /></div>,
  thead: ({node, ...props}) => <thead className="bg-stone-50" {...props} />,
  tbody: ({node, ...props}) => <tbody className="divide-y divide-stone-200 bg-white" {...props} />,
  tr: ({node, ...props}) => <tr {...props} />,
  th: ({node, ...props}) => <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase tracking-wider" {...props} />,
  td: ({node, ...props}) => <td className="px-4 py-3 text-sm text-stone-700 whitespace-nowrap md:whitespace-pre-wrap" {...props} />,
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Greetings. I am **Encrypt**. \n\nI am here to help you deconstruct complex logic without handing you the answers.\n\nI am fluent in **English, Hindi (हिन्दी), Telugu (తెలుగు), Tamil (தமிழ்)** and many more Indian languages.\n\nSelect your knowledge level above, and tell me: **What concept shall we architect today?**",
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
  const [toastMessage, setToastMessage] = useState("Think First! No direct code.");
  
  // Mobile View State
  const [mobileView, setMobileView] = useState<'chat' | 'workspace'>('chat');
  
  // Templates State
  const [sessionTemplates, setSessionTemplates] = useState<Template[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>(TemplateCategory.ALL);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  
  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle automatic tab switching when logic is found
  const extractVisualization = useCallback(async (text: string, imagePart?: string) => {
    const mermaidRegex = /```(?:mermaid|flowchart|text|sequenceDiagram)?\s*([\s\S]*?)```/gi;
    const conceptualRegex = /\[CONCEPTUAL_VISUAL:\s*([^\]]+)\]/gi;
    
    let match;
    const newItems: VisualItem[] = [];

    // Extract Mermaid Blocks
    while ((match = mermaidRegex.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|journey|C4Context)/i) || content.includes('-->')) {
        newItems.push({
          id: `mermaid-${Date.now()}-${Math.random()}`,
          type: 'mermaid',
          content: content,
          timestamp: Date.now()
        });
      }
    }

    // Direct Image Part from Gemini
    if (imagePart) {
      newItems.push({
        id: `img-${Date.now()}-${Math.random()}`,
        type: 'image',
        content: imagePart,
        timestamp: Date.now()
      });
    }

    // Extract and Generate Conceptual Images
    const conceptualMatches = [...text.matchAll(conceptualRegex)];
    for (const cMatch of conceptualMatches) {
      const prompt = cMatch[1].trim();
      setIsGeneratingImage(true);
      try {
        const conceptualImg = await generateImage(prompt, "1K");
        if (conceptualImg) {
          newItems.push({
            id: `concept-${Date.now()}-${Math.random()}`,
            type: 'image',
            content: conceptualImg,
            timestamp: Date.now()
          });
        }
      } catch (e: any) {
        console.error("Conceptual image generation failed", e);
        if (window.aistudio && (e.status === 403 || e.message?.includes('403') || e.message?.includes('Permission denied'))) {
             try {
                 await window.aistudio.openSelectKey();
             } catch(err) { console.error(err); }
        }
      } finally {
        setIsGeneratingImage(false);
      }
    }

    if (newItems.length > 0) {
      setVisualization(prev => ({
        ...prev,
        items: [...prev.items, ...newItems]
      }));
      setActiveTab(PaneTab.VISUALIZER);
      setMobileView('workspace');
    }
  }, []);

  const handleSendMessage = useCallback(async (customPrompt?: string) => {
    const messageText = customPrompt || input;
    if (!messageText.trim()) return;
    
    if (!customPrompt) {
        const cheatRegex = /(give|write|show).*(code|answer|solution|full)/i;
        if (cheatRegex.test(messageText) && !messageText.toLowerCase().includes('logic') && !messageText.toLowerCase().includes('explain') && !messageText.toLowerCase().includes('diagram')) {
            setToastMessage("Think First! I cannot provide code directly. Let's discuss the logic.");
            setShowToast(true);
            return;
        }
    }

    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', text: messageText, timestamp: Date.now() };
    setMessages((prev) => [...prev, newUserMsg]);
    if (!customPrompt) setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const response = await sendMessageToGemini(history, newUserMsg.text, knowledgeLevel);
      
      const newAiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: response.text || "I see. Let's explore the structure of this logic.", 
        timestamp: Date.now() 
      };
      setMessages((prev) => [...prev, newAiMsg]);

      await extractVisualization(response.text, response.imagePart);

      if (response.mentorStatus === 'satisfied') setMentorMode(true);
      else if (response.mentorStatus === 'searching') setMentorMode(false);
    } catch (error) {
      console.error("API Error", error);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'model', text: "Logical connection reset. Please rephrase.", timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  }, [input, messages, knowledgeLevel, extractVisualization]);

  const handleRequestVisualization = () => {
    handleSendMessage("Please provide an image or a diagram to explain the current concept. Appreciate it if you include a [CONCEPTUAL_VISUAL: ...] tag for a detailed vision.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const fileName = file.name;
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: `I've uploaded "${fileName}" for your structural review.`, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);
      try {
        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        const prompt = `Review this logic draft from file "${fileName}":\n\n${content}`;
        const response = await sendMessageToGemini(history, prompt, knowledgeLevel);
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', text: response.text || "File processed.", timestamp: Date.now() };
        setMessages((prev) => [...prev, aiMsg]);
        await extractVisualization(response.text, response.imagePart);
      } catch (err) { console.error(err); } finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;

    if (window.aistudio) {
        try {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            if (!hasKey) {
                await window.aistudio.openSelectKey();
            }
        } catch(e) { console.error(e); }
    }

    setIsGeneratingImage(true);
    try {
        const base64Image = await generateImage(imagePrompt, imageSize);
        if (base64Image) {
          const newItem: VisualItem = {
            id: `manual-${Date.now()}`,
            type: 'image',
            content: base64Image,
            timestamp: Date.now()
          };
          setVisualization(prev => ({ ...prev, items: [...prev.items, newItem] }));
          setGeneratedImageUrl(base64Image);
          setActiveTab(PaneTab.VISUALIZER);
          setMobileView('workspace');
        }
    } catch (error: any) { 
        console.error("Image Gen Error", error); 
        if (window.aistudio && (error.status === 403 || error.message?.includes('403') || error.message?.includes('Permission denied'))) {
            try {
                await window.aistudio.openSelectKey();
                setToastMessage("Access Denied. Please select a paid API Key.");
                setShowToast(true);
            } catch(e) { console.error(e); }
        }
    } finally { setIsGeneratingImage(false); }
  };

  const filteredTemplates = useMemo(() => {
    const allTemplates = [...TEMPLATES, ...sessionTemplates];
    let list = allTemplates;
    if (selectedCategory !== TemplateCategory.ALL) {
      list = list.filter(tpl => tpl.category === selectedCategory);
    }
    const query = templateSearch.trim().toLowerCase();
    if (!query) return list;
    const keywords = query.split(/\s+/).filter(k => k.length > 0);
    return list.filter(tpl => {
        const searchableText = `${tpl.title} ${tpl.description} ${tpl.content}`.toLowerCase();
        return keywords.every(kw => searchableText.includes(kw));
    });
  }, [templateSearch, selectedCategory, sessionTemplates]);

  const copyToClipboard = (content: string) => navigator.clipboard.writeText(content);

  const handleSynthesize = async () => {
    if (!templateSearch.trim()) return;
    setIsSynthesizing(true);
    try {
      const newTpl = await synthesizeTemplate(templateSearch);
      setSessionTemplates(prev => [newTpl, ...prev]);
    } catch (err) {
      console.error("Synthesis failed", err);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="flex h-[100dvh] w-screen bg-stone-50 text-stone-900 font-sans overflow-hidden">
      <Toast message={toastMessage} isVisible={showToast} onClose={() => setShowToast(false)} />
      
      {/* HEADER */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-stone-200 flex items-center justify-between px-4 md:px-8 z-30 shadow-sm">
        <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white font-bold text-lg md:text-xl shadow-lg shadow-violet-200">E</div>
            <h1 className="font-bold text-lg md:text-xl tracking-tight truncate max-w-[120px] md:max-w-none">Encrypt <span className="text-violet-500 font-medium hidden md:inline">Infinite</span></h1>
        </div>
        <div className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full border transition-all ${mentorMode ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${mentorMode ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
            <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${mentorMode ? 'text-emerald-700' : 'text-amber-700'}`}>
                {mentorMode ? 'Satisfied' : 'Socratic'}
            </span>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <main className="flex flex-col md:flex-row w-full pt-16 h-full pb-16 md:pb-0">
        
        {/* CHAT PANE */}
        <div className={`w-full md:w-1/2 flex flex-col border-r border-stone-200 bg-white/50 h-full ${mobileView === 'chat' ? 'flex' : 'hidden md:flex'}`}>
            
            {/* Logic Stream Header */}
            <div className="h-14 border-b border-stone-200 flex items-center justify-between px-4 md:px-6 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Logic Stream</span>
                </div>
                <div className="flex bg-stone-50 rounded-lg p-1 border border-stone-200 overflow-x-auto">
                    {Object.values(KnowledgeLevel).map((level) => (
                        <button key={level} onClick={() => setKnowledgeLevel(level)} className={`px-3 md:px-3 py-1.5 md:py-1 text-[10px] uppercase font-bold rounded-md transition-all whitespace-nowrap snap-center ${knowledgeLevel === level ? 'bg-white shadow-sm text-violet-600 border border-stone-100' : 'text-stone-400 hover:text-stone-600'}`}>{level}</button>
                    ))}
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 bg-stone-50/30">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {msg.role === 'user' ? <UserIcon /> : <AiIcon isMentor={mentorMode} />}
                        
                        <div className={`flex flex-col max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1.5 opacity-60">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                                    {msg.role === 'user' ? 'You' : 'Encrypt'}
                                </span>
                                <span className="text-[9px] text-stone-400">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            
                            <div className={`w-full rounded-2xl p-5 shadow-sm border ${
                                msg.role === 'user' 
                                ? 'bg-violet-600 text-white border-violet-500 rounded-tr-sm' 
                                : 'bg-white text-stone-800 border-stone-200 rounded-tl-sm'
                            }`}>
                                <div className={`${msg.role === 'user' ? 'text-white' : ''} text-sm`}>
                                    <ReactMarkdown components={msg.role === 'user' ? undefined : MarkdownRender} remarkPlugins={[remarkGfm]}>
                                        {msg.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {(isLoading || isGeneratingImage) && (
                    <div className="flex gap-4">
                        <AiIcon isMentor={mentorMode} />
                        <div className="flex items-center gap-1.5 h-10 px-4 bg-white rounded-2xl rounded-tl-sm border border-stone-200 shadow-sm">
                             <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"></div>
                             <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                             <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input & Actions Area */}
            <div className="p-4 md:p-6 border-t border-stone-200 bg-white/95 backdrop-blur-md shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                
                {/* Suggestion Chips */}
                <div className="flex gap-2 pb-3 overflow-x-auto no-scrollbar mask-gradient mb-1">
                    <QuickAction 
                        label="Analogy" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>}
                        onClick={() => handleSendMessage("Explain this using a real-world analogy.")} 
                        disabled={isLoading}
                    />
                    <QuickAction 
                        label="Quiz Me" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
                        onClick={() => handleSendMessage("Give me a short quiz to test my understanding.")} 
                        disabled={isLoading}
                    />
                    <QuickAction 
                        label="Real World" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" /></svg>}
                        onClick={() => handleSendMessage("How is this used in a real-world application?")} 
                        disabled={isLoading}
                    />
                     <QuickAction 
                        label="Visualize" 
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 14.414l2.293 2.293a1 1 0 001.414-1.414L12.414 14H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" /></svg>}
                        onClick={handleRequestVisualization} 
                        disabled={isLoading || isGeneratingImage}
                    />
                </div>

                {/* Input Area */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-violet-200 rounded-3xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <textarea
                        value={input}
                        autoFocus
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                        placeholder="Discuss the architecture of your thoughts..."
                        className="w-full relative bg-white border border-stone-200 rounded-3xl px-5 py-4 pr-16 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all resize-none h-14 md:h-16 shadow-inner"
                    />
                    <button 
                        onClick={() => handleSendMessage()}
                        disabled={isLoading || isGeneratingImage || !input.trim()}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-stone-900 text-white rounded-full hover:bg-violet-600 disabled:bg-stone-200 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center z-10"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        {/* WORKSPACE PANE */}
        <div className={`w-full md:w-1/2 bg-stone-50/50 flex-col h-full ${mobileView === 'workspace' ? 'flex' : 'hidden md:flex'}`}>
            <div className="h-14 flex border-b border-stone-200 bg-stone-50 px-2 md:px-4 pt-4 gap-2 overflow-x-auto no-scrollbar shrink-0">
                {[PaneTab.VISUALIZER, PaneTab.TEMPLATES, PaneTab.UPLOAD, PaneTab.IMAGE_GEN].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-3 md:py-2 text-[10px] font-bold uppercase rounded-t-xl transition-all border-t border-x whitespace-nowrap min-w-[90px] md:min-w-0 ${activeTab === tab ? 'bg-white text-violet-600 border-stone-200 shadow-sm' : 'text-stone-400 border-transparent hover:text-stone-600'}`}>
                        {tab === PaneTab.VISUALIZER && 'Blueprint'}
                        {tab === PaneTab.TEMPLATES && 'Knowledge'}
                        {tab === PaneTab.UPLOAD && 'Submissions'}
                        {tab === PaneTab.IMAGE_GEN && 'Canvas'}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {activeTab === PaneTab.VISUALIZER && <LogicVisualizer items={visualization.items} />}
                
                {activeTab === PaneTab.TEMPLATES && (
                    <div className="space-y-6">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {Object.values(TemplateCategory).map(cat => (
                                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-2 md:py-1.5 rounded-full text-[9px] font-bold uppercase border transition-all ${selectedCategory === cat ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-stone-500 border-stone-200 hover:border-violet-300'}`}>{cat}</button>
                            ))}
                        </div>
                        <div className="relative mb-8">
                            <input
                                value={templateSearch}
                                onChange={e => setTemplateSearch(e.target.value)}
                                placeholder="Search logic templates..."
                                className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-violet-500 shadow-sm"
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {filteredTemplates.length === 0 && templateSearch.trim() && (
                            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 shadow-sm">
                                <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-4 text-violet-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.282a2 2 0 01-1.806 0l-.628-.282a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547l-.34.34a2 2 0 000 2.828l1.245 1.245a2 2 0 002.828 0L9 15.586l1.245 1.245a2 2 0 002.828 0l1.245-1.245a2 2 0 002.828 0l1.245 1.245a2 2 0 002.828 0l.34-.34a2 2 0 000-2.828l-.34-.34z" />
                                    </svg>
                                </div>
                                <h3 className="font-bold text-stone-800 text-lg mb-2">Pattern Synthesizer</h3>
                                <p className="text-sm text-stone-500 mb-8 max-w-xs mx-auto">Concept missing. Encrypt can architect a new template for you.</p>
                                <button 
                                    onClick={handleSynthesize}
                                    disabled={isSynthesizing}
                                    className="px-8 py-3 bg-violet-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-violet-700 disabled:bg-stone-300 transition-all shadow-lg shadow-violet-100"
                                >
                                    {isSynthesizing ? 'Architecting...' : 'Synthesize Logic'}
                                </button>
                            </div>
                        )}

                        <div className="grid gap-6 pb-12">
                            {filteredTemplates.map(tpl => (
                                <div key={tpl.id} className={`p-6 bg-white border rounded-3xl group transition-all hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100/30 ${tpl.isSynthesized ? 'border-violet-200' : 'border-stone-200'}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-[9px] font-bold text-violet-500 uppercase tracking-widest bg-violet-50 px-2 py-0.5 rounded-md mb-2 inline-block">{tpl.category}</span>
                                            <h4 className="font-bold text-stone-800 text-lg group-hover:text-violet-700 transition-colors">{tpl.title}</h4>
                                        </div>
                                        <button onClick={() => copyToClipboard(tpl.content)} className="p-2 text-stone-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                                                <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v1h2a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-1H7a2 2 0 01-2-2V5z" />
                                            </svg>
                                        </button>
                                    </div>
                                    <p className="text-xs text-stone-500 mb-6 leading-relaxed">{tpl.description}</p>
                                    <div className="bg-stone-50 p-5 rounded-2xl border border-stone-100 font-mono text-[10px] text-stone-600 leading-relaxed overflow-x-auto">
                                        <pre>{tpl.content}</pre>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === PaneTab.UPLOAD && (
                    <div className="h-full flex flex-col justify-center items-center">
                        <div className="w-full max-w-md p-8 md:p-12 bg-white border-2 border-dashed border-stone-200 rounded-[2.5rem] hover:border-violet-400 hover:bg-violet-50/10 transition-all text-center group cursor-pointer relative shadow-sm">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center">
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-stone-50 rounded-3xl flex items-center justify-center mb-6 group-hover:bg-violet-100 group-hover:text-violet-600 transition-all text-stone-300 shadow-inner">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h3 className="text-lg md:text-xl font-bold text-stone-800 mb-2">Assignment Review</h3>
                                <p className="text-xs md:text-sm text-stone-500 mb-8 max-w-[200px] mx-auto leading-relaxed">Submit your logic drafts for structural evaluation.</p>
                                <span className="px-6 md:px-8 py-3 bg-stone-100 rounded-xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-stone-600 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-sm">Browse Files</span>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === PaneTab.IMAGE_GEN && (
                    <div className="flex flex-col h-full space-y-6">
                        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm shrink-0">
                            <textarea
                                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-violet-500 transition-all resize-none h-28 mb-4 shadow-inner"
                                placeholder="Conceptualize a visualization..."
                                value={imagePrompt}
                                onChange={e => setImagePrompt(e.target.value)}
                            />
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0">
                                <select 
                                    value={imageSize} 
                                    onChange={e => setImageSize(e.target.value)}
                                    className="bg-stone-100 border-none text-stone-600 py-2.5 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest focus:ring-0 cursor-pointer w-full md:w-auto"
                                >
                                    <option value="1K">Standard 1K</option>
                                    <option value="2K">High-Res 2K</option>
                                    <option value="4K">Ultra-Res 4K</option>
                                </select>
                                <button 
                                    onClick={handleGenerateImage}
                                    disabled={isGeneratingImage || !imagePrompt.trim()}
                                    className="bg-violet-600 hover:bg-violet-700 disabled:bg-stone-300 text-white px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-violet-100 active:scale-95 w-full md:w-auto"
                                >
                                    {isGeneratingImage ? 'Conceptualizing...' : 'Render Vision'}
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-white rounded-3xl border border-stone-200 flex items-center justify-center relative overflow-hidden shadow-inner group min-h-[300px]">
                            {isGeneratingImage ? (
                                <div className="text-center">
                                    <div className="w-12 h-12 border-4 border-stone-100 border-t-violet-600 rounded-full animate-spin mb-4 mx-auto"></div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Rendering...</p>
                                </div>
                            ) : generatedImageUrl ? (
                                <>
                                    <img src={generatedImageUrl} className="max-h-full max-w-full object-contain p-6 group-hover:scale-105 transition-transform duration-700" alt="Generated Concept" />
                                    <button 
                                        onClick={() => {
                                          const newItem: VisualItem = {
                                            id: `gen-${Date.now()}`,
                                            type: 'image',
                                            content: generatedImageUrl,
                                            timestamp: Date.now()
                                          };
                                          setVisualization(prev => ({ ...prev, items: [...prev.items, newItem] }));
                                          setActiveTab(PaneTab.VISUALIZER);
                                          setMobileView('workspace');
                                        }}
                                        className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-violet-600 shadow-lg border border-stone-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        Append to Blueprint
                                    </button>
                                </>
                            ) : (
                                <div className="text-center opacity-30">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-[10px] font-bold uppercase tracking-widest">Visual Canvas Empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-stone-200 flex z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button 
            onClick={() => setMobileView('chat')} 
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileView === 'chat' ? 'text-violet-600 bg-violet-50/50' : 'text-stone-400 hover:bg-stone-50'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wide">Logic Stream</span>
        </button>
        <button 
            onClick={() => setMobileView('workspace')} 
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${mobileView === 'workspace' ? 'text-violet-600 bg-violet-50/50' : 'text-stone-400 hover:bg-stone-50'}`}
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wide">Workspace</span>
        </button>
      </div>
    </div>
  );
};

export default App;