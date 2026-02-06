import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import { sendMessageToGemini, generateImage } from './services/geminiService';
import { KnowledgeLevel, Message, PaneTab, LogicDiagram } from './types';
import { TEMPLATES, INITIAL_KNOWLEDGE_LEVEL } from './constants';
import { LogicVisualizer } from './components/LogicVisualizer';
import { Toast } from './components/Toast';

// Fix: Augment the existing AIStudio interface instead of redeclaring window.aistudio
// to avoid "All declarations must have identical modifiers" and "Subsequent property declarations" errors.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Greetings. I am Unnamed. Before we begin, please select your knowledge level and tell me: What specific concept or logic are we exploring today?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeLevel, setKnowledgeLevel] = useState<KnowledgeLevel>(INITIAL_KNOWLEDGE_LEVEL);
  const [activeTab, setActiveTab] = useState<PaneTab>(PaneTab.VISUALIZER);
  const [currentDiagram, setCurrentDiagram] = useState<string>('');
  const [mentorMode, setMentorMode] = useState(false);
  const [showToast, setShowToast] = useState(false);
  
  // Image Gen State
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageSize, setImageSize] = useState('1K');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Diagram Extraction Logic
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'model') {
      // Look for code blocks that might be diagrams (mermaid or flowchart or just indented text with arrows)
      // Heuristic: Check for markdown code blocks containing "graph", "flowchart", "mermaid"
      const mermaidMatch = lastMsg.text.match(/```(?:mermaid|flowchart|text)?\s*([\s\S]*?)```/i);
      if (mermaidMatch && mermaidMatch[1]) {
        // If it looks like a diagram (has arrows or mermaid keywords), update visualization
        if (mermaidMatch[1].includes('-->') || mermaidMatch[1].includes('graph') || mermaidMatch[1].includes('subgraph')) {
            setCurrentDiagram(mermaidMatch[1].trim());
            setActiveTab(PaneTab.VISUALIZER); // Auto-switch to visualizer
        }
      }
    }
  }, [messages]);

  const handleSendMessage = useCallback(async () => {
    if (!input.trim()) return;

    // "Think First" Heuristic Check
    const cheatRegex = /(give|write|show).*(code|answer|solution|full)/i;
    if (cheatRegex.test(input) && !input.toLowerCase().includes('logic') && !input.toLowerCase().includes('explain')) {
      setShowToast(true);
      return;
    }

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare history for API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const response = await sendMessageToGemini(history, newUserMsg.text, knowledgeLevel);
      
      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text || "I see. Let's break this down further.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newAiMsg]);

      if (response.mentorStatus === 'satisfied') {
        setMentorMode(true);
      } else if (response.mentorStatus === 'searching') {
        setMentorMode(false);
      }

    } catch (error) {
      console.error("API Error", error);
      setMessages((prev) => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I apologize, but I encountered a momentary lapse in my connection. Let us try that again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, knowledgeLevel]);

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;

    // API Key Check for Veo/Image-Pro models
    if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await window.aistudio.openSelectKey();
            // Race condition handling: assume success or check again. 
            // For UI simplicity, we proceed. If it fails, error block catches it.
        }
    }

    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);

    try {
        const base64Image = await generateImage(imagePrompt, imageSize);
        if (base64Image) {
            setGeneratedImageUrl(base64Image);
        } else {
             // Fallback error toast or log
             console.error("No image returned");
        }
    } catch (error) {
        console.error("Image Generation Failed", error);
        // Could set an error state here to show in UI
    } finally {
        setIsGeneratingImage(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const uploadMsg = `[SYSTEM: User uploaded file "${file.name}" for review]\n\nContent:\n${content}`;
      
      // Simulate user sending the file
      const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          text: `I have uploaded my assignment "${file.name}" for your review.`,
          timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
        // We append the actual content strictly to the API call, not necessarily cluttering the UI with the full file content
        // Or we can just include it in the prompt context
        const response = await sendMessageToGemini(history, uploadMsg, knowledgeLevel);
        
        const aiMsg: Message = {
            id: (Date.now()+1).toString(),
            role: 'model',
            text: response.text,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, aiMsg]);
        if (response.mentorStatus === 'satisfied') setMentorMode(true);

      } catch (err) {
          console.error(err);
      } finally {
          setIsLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen w-screen bg-stone-50 text-stone-900 font-sans selection:bg-violet-200">
      <Toast 
        message="Think First! I cannot provide code directly. Let's discuss the logic." 
        isVisible={showToast} 
        onClose={() => setShowToast(false)} 
      />

      {/* HEADER BAR */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-stone-200 flex items-center justify-between px-8 z-10 shadow-sm shadow-stone-100/50">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center border border-violet-100">
                <span className="text-violet-600 font-bold text-xl">U</span>
            </div>
            <h1 className="font-bold text-xl tracking-tight text-stone-800">Unnamed <span className="text-violet-500 font-medium">AI</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors ${mentorMode ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${mentorMode ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                <span className={`text-xs font-bold uppercase tracking-wider ${mentorMode ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {mentorMode ? 'Mentor Satisfied' : 'Mentor Guide Mode'}
                </span>
            </div>
        </div>
      </div>

      <main className="flex w-full pt-16 h-full">
        
        {/* LEFT PANE: CHAT */}
        <div className="w-1/2 flex flex-col border-r border-stone-200 bg-stone-50/50">
            
            {/* Toolbar */}
            <div className="h-14 border-b border-stone-200 flex items-center justify-between px-6 bg-white/50">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Discussion</span>
                
                {/* Knowledge Toggle */}
                <div className="flex bg-white rounded-lg p-1 border border-stone-200 shadow-sm">
                    {Object.values(KnowledgeLevel).map((level) => (
                        <button
                            key={level}
                            onClick={() => setKnowledgeLevel(level)}
                            className={`px-3 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${
                                knowledgeLevel === level 
                                ? 'bg-violet-50 text-violet-700 shadow-sm border border-violet-100' 
                                : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
                            }`}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-6 py-5 text-sm leading-relaxed shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-violet-600 text-white rounded-tr-none shadow-md shadow-violet-200' 
                            : 'bg-white text-stone-700 border border-stone-200 rounded-tl-none shadow-stone-100'
                        }`}>
                            {msg.role === 'model' && (
                                <div className="flex items-center gap-2 mb-3 border-b border-stone-100 pb-2">
                                    <div className="w-6 h-6 rounded bg-violet-50 border border-violet-100 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-violet-500" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Unnamed AI</span>
                                </div>
                            )}
                            <div className="markdown-body">
                                <ReactMarkdown 
                                  components={{
                                    a: ({node, ...props}) => <a {...props} className={`${msg.role === 'user' ? 'text-violet-100 hover:text-white' : 'text-violet-600 hover:text-violet-800'} underline decoration-2 underline-offset-2 cursor-pointer font-medium`} target="_blank" rel="noopener noreferrer" />,
                                    code: ({node, className, children, ...props}) => {
                                        return <code className={`${className} ${msg.role === 'user' ? 'bg-violet-700 text-violet-50' : 'bg-stone-100 text-stone-800 border border-stone-200'} px-1.5 py-0.5 rounded font-mono text-[0.9em]`} {...props}>{children}</code>
                                    },
                                    strong: ({node, ...props}) => <strong className="font-bold" {...props} />
                                  }}
                                >
                                    {msg.text}
                                </ReactMarkdown>
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start animate-pulse">
                        <div className="flex items-center space-x-2 pl-2">
                           <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce"></div>
                           <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce delay-75"></div>
                           <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce delay-150"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-stone-200 bg-white">
                <div className="relative group">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Explain your logic here..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-5 py-4 pr-14 text-sm text-stone-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none h-16 overflow-hidden placeholder-stone-400"
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={isLoading || !input.trim()}
                        className="absolute right-2 top-2 bottom-2 aspect-square bg-violet-600 hover:bg-violet-700 text-white rounded-xl disabled:opacity-50 disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
                <div className="mt-3 text-center">
                    <span className="text-[10px] text-stone-400 font-medium tracking-wide">STRICTLY LOGICAL &bull; NO CODE HANDOUTS</span>
                </div>
            </div>
        </div>

        {/* RIGHT PANE: WORKSPACE */}
        <div className="w-1/2 bg-white flex flex-col">
            
            {/* Tabs */}
            <div className="h-14 flex border-b border-stone-200 bg-stone-50 px-4 pt-4 gap-2">
                {[
                  { id: PaneTab.VISUALIZER, label: 'Visualizer', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
                  { id: PaneTab.TEMPLATES, label: 'Templates', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2' },
                  { id: PaneTab.UPLOAD, label: 'Submit', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
                  { id: PaneTab.IMAGE_GEN, label: 'Image Studio', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as PaneTab)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all whitespace-nowrap ${
                            activeTab === tab.id
                            ? 'bg-white text-violet-600 border-t border-x border-stone-200 shadow-[0_-2px_5px_rgba(0,0,0,0.02)] relative top-[1px]'
                            : 'text-stone-500 hover:text-stone-700 hover:bg-stone-100'
                        }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                        </svg>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Pane Content */}
            <div className="flex-1 p-8 bg-white overflow-y-auto">
                
                {activeTab === PaneTab.VISUALIZER && (
                    <div className="h-full">
                        <LogicVisualizer diagramCode={currentDiagram} />
                        <div className="mt-6 p-5 bg-violet-50 rounded-xl border border-violet-100 flex gap-4 items-start">
                             <div className="bg-white p-2 rounded-lg border border-violet-100 text-violet-500 shadow-sm shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                             </div>
                             <div>
                                <h4 className="text-sm font-bold text-violet-700 uppercase mb-1">How to use</h4>
                                <p className="text-sm text-violet-800/80 leading-relaxed">Ask the AI to explain the structure of a problem. The generated logic diagram will appear here automatically.</p>
                             </div>
                        </div>
                    </div>
                )}

                {activeTab === PaneTab.TEMPLATES && (
                    <div className="grid grid-cols-1 gap-6">
                        {TEMPLATES.map((tpl) => (
                            <div key={tpl.id} className="bg-white border border-stone-200 rounded-2xl p-6 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-100/50 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-stone-800 font-bold text-lg">{tpl.title}</h3>
                                    <button 
                                      className="text-stone-400 hover:text-violet-600 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                                      onClick={() => {
                                          navigator.clipboard.writeText(tpl.content);
                                          // Could show a mini toast here
                                      }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-sm text-stone-500 mb-5 leading-relaxed">{tpl.description}</p>
                                <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                    <pre className="text-xs text-stone-600 whitespace-pre-wrap font-mono leading-relaxed">{tpl.content}</pre>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === PaneTab.UPLOAD && (
                    <div className="h-full flex flex-col justify-center items-center p-4">
                        <div className="w-full max-w-lg p-10 bg-white border-2 border-dashed border-stone-200 rounded-2xl hover:border-violet-400 hover:bg-violet-50/10 transition-all text-center group cursor-pointer relative">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <div className="flex flex-col items-center">
                                <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors text-stone-300 shadow-inner">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-bold text-stone-800 mb-2">Upload Assignment</h3>
                                <p className="text-sm text-stone-500 mb-8 max-w-xs mx-auto">Drop your text file or code draft here for AI analysis.</p>
                                <span className="px-6 py-2.5 bg-stone-100 rounded-lg text-sm font-medium text-stone-600 group-hover:bg-violet-600 group-hover:text-white transition-all shadow-sm">Select File</span>
                            </div>
                        </div>
                        <div className="mt-8 max-w-md text-center bg-amber-50 p-4 rounded-lg border border-amber-100">
                             <p className="text-xs text-amber-800 leading-relaxed">
                                 <strong className="block mb-1 text-amber-900">Review Mode Active</strong>
                                 When you upload, Unnamed will enter Review Mode. It will highlight logical fallacies without correcting the code directly.
                             </p>
                        </div>
                    </div>
                )}

                {activeTab === PaneTab.IMAGE_GEN && (
                    <div className="flex flex-col h-full">
                        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm mb-6 flex-shrink-0">
                            <h3 className="text-lg font-bold text-stone-800 mb-4 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Image Studio
                            </h3>
                            <textarea
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 transition-all resize-none h-24 mb-4 placeholder-stone-400"
                                placeholder="Describe the image you want to generate..."
                                value={imagePrompt}
                                onChange={e => setImagePrompt(e.target.value)}
                            />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-stone-600">Size:</label>
                                    <div className="relative">
                                        <select 
                                            value={imageSize} 
                                            onChange={e => setImageSize(e.target.value)}
                                            className="appearance-none bg-stone-50 border border-stone-200 text-stone-700 py-2 px-4 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:border-violet-500 cursor-pointer"
                                        >
                                            <option value="1K">1K (1024x1024)</option>
                                            <option value="2K">2K (2048x2048)</option>
                                            <option value="4K">4K (4096x4096)</option>
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-stone-500">
                                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleGenerateImage}
                                    disabled={isGeneratingImage || !imagePrompt.trim()}
                                    className="bg-violet-600 hover:bg-violet-700 disabled:bg-stone-300 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-sm hover:shadow flex items-center gap-2"
                                >
                                    {isGeneratingImage ? 'Creating...' : 'Generate Art'}
                                    {!isGeneratingImage && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex-1 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-center overflow-hidden relative shadow-inner">
                            {isGeneratingImage ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin mb-4"></div>
                                    <p className="text-sm text-stone-500 animate-pulse">Designing your request...</p>
                                </div>
                            ) : generatedImageUrl ? (
                                <img src={generatedImageUrl} className="max-h-full max-w-full object-contain p-4 shadow-2xl" alt="AI Generated" />
                            ) : (
                                <div className="text-center p-8 opacity-50">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-stone-400 font-medium">Your canvas is empty</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;