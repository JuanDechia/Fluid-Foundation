'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, ArrowLeft, ArrowRight, RotateCcw, Plus, MessageSquare, Trash2, AlertTriangle, Wrench, Sparkles, Menu } from 'lucide-react';
import SandboxedRenderer from './SandboxedRenderer';
import { HistoryManager, type FluidState } from '@/lib/fluid/history_manager';
import { callLogicAgent, type ChatMessage } from '@/lib/fluid/agents/agent_logic';
import { callUIAgent } from '@/lib/fluid/agents/agent_ui';
import {
    getConversations,
    createConversation,
    deleteConversation as deleteConvAction,
    getMessages,
    addMessage,
    saveState,
    getLatestState,
    type SerializedConversation
} from '@/app/editor/actions';

const historyManager = new HistoryManager();

const FluidEngine: React.FC = () => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentState, setCurrentState] = useState<FluidState | null>(null);
    const [logs, setLogs] = useState<string[]>([]); // Keep logs for system messages
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [showRefineInput, setShowRefineInput] = useState(false);
    const [refineInput, setRefineInput] = useState('');

    // Persistence State
    // CHANGED: IDs are now strings (CUIDs) not numbers
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<SerializedConversation[]>([]);

    // Chat History for Agent A
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [showDebug, setShowDebug] = useState(false);

    // UI State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [collapsedWidth, setCollapsedWidth] = useState(320); // Width of sidebar

    // Load Conversations List
    const refreshConversations = useCallback(async () => {
        try {
            const list = await getConversations();
            setConversations(list);
        } catch (e) {
            console.error("Failed to load conversations", e);
        }
    }, []);

    useEffect(() => {
        refreshConversations();
    }, [refreshConversations]);

    // Initialize/Load Conversation
    useEffect(() => {
        const loadConversation = async () => {
            if (activeConversationId) {
                // Load Messages
                const messages = await getMessages(activeConversationId);

                const formattedHistory: ChatMessage[] = messages.map(m => ({
                    role: m.role as 'user' | 'model',
                    parts: m.content
                }));
                setChatHistory(formattedHistory);
                setLogs([]); // Clear legacy logs

                // Load Latest State
                const lastStateEntry = await getLatestState(activeConversationId);

                if (lastStateEntry) {
                    const restoredState: FluidState = {
                        id: crypto.randomUUID(), // State ID is transient for history manager unless we want to link exact DB IDs
                        uiConfig: lastStateEntry.uiConfig,
                        dataContext: lastStateEntry.dataContext as any,
                        timestamp: new Date(lastStateEntry.timestamp).getTime()
                    };
                    setCurrentState(restoredState);
                    historyManager.reset(restoredState);
                } else {
                    setCurrentState(null);
                }
            } else {
                // New Chat Mode
                setChatHistory([]);
                setLogs([]);
                setCurrentState(null);
                historyManager.clear();
            }
        };
        loadConversation();
    }, [activeConversationId]);

    // Error Listener
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'SANDBOX_ERROR') {
                const { message, line } = event.data.payload;
                setRuntimeError(`Runtime Error: ${message} (Line ${line})`);
                addLog(`UI Crashed: ${message}`);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const handleRefine = async (feedback: string, isRepair = false) => {
        if (!currentState || isProcessing || isRefining) return;

        setIsRefining(true);
        addLog(isRepair ? 'System: Attempting Auto-Fix...' : `User Refinement: ${feedback}`);

        try {
            // Keep data context, update UI code
            const updatedCode = await callUIAgent(currentState.dataContext, currentState.uiConfig, feedback);

            // Update State & Persist
            const newState: FluidState = {
                id: crypto.randomUUID(),
                uiConfig: updatedCode,
                dataContext: currentState.dataContext,
                timestamp: Date.now()
            };

            await saveState(activeConversationId!, newState.uiConfig, newState.dataContext);

            historyManager.push(newState);
            setCurrentState(newState);
            setRuntimeError(null);
            addLog('System: UI Updated');

        } catch (e) {
            addLog(`Error updating UI: ${e}`);
        } finally {
            setIsRefining(false);
        }
    };


    const handleSend = async () => {
        if (!input.trim()) return;

        const message = input;
        setInput('');
        setIsProcessing(true);

        // Optimistic UI update
        const tempHistory: ChatMessage[] = [
            ...chatHistory,
            { role: 'user', parts: message }
        ];
        setChatHistory(tempHistory);

        try {
            // 0. Ensure Conversation Exists
            let conversationId = activeConversationId;
            if (!conversationId) {
                const title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
                conversationId = await createConversation(title);
                setActiveConversationId(conversationId);
                refreshConversations(); // Update list
            }

            // Save User Message
            await addMessage(conversationId, 'user', message);

            // 1. Logic Agent (Agent A) - INVISIBLE HANDOFF
            // addLog('Agent A: Processing...');
            const startTime = performance.now();
            const { textResponse, hiddenUiData } = await callLogicAgent(message, tempHistory);
            const logicEndTime = performance.now();
            const logicDuration = Math.round(logicEndTime - startTime);

            // Save Agent Message (Text Only)
            await addMessage(conversationId, 'model', textResponse);

            // Update Local History (Initial)
            const newHistory: ChatMessage[] = [
                ...tempHistory,
                { role: 'model', parts: textResponse, metrics: { logicLatency: logicDuration } }
            ];
            setChatHistory(newHistory);

            // 2. Conditional UI Agent Handoff
            if (hiddenUiData) {
                // DATA APPEND LOGIC
                let currentBlocks: any[] = [];
                const previousContext = currentState?.dataContext;

                if (Array.isArray(previousContext)) {
                    currentBlocks = [...previousContext];
                } else if (previousContext) {
                    // Legacy migration: wrap old string/object in a generic block
                    currentBlocks = [{
                        id: 'legacy-root',
                        type: 'legacy_content',
                        content: previousContext
                    }];
                }

                // Create New Block
                const newBlock = {
                    id: crypto.randomUUID(),
                    type: hiddenUiData.type || 'generic_data',
                    content: hiddenUiData,
                    timestamp: Date.now()
                };

                const newContext = [...currentBlocks, newBlock];

                // OPTIMIZATION: SKIP AGENT B?
                // Check if we already have a UI template and the user didn't ask for a visual change
                const visualKeywords = ['layout', 'design', 'color', 'style', 'theme', 'sidebar', 'view', 'grid', 'list', 'chart', 'graph'];
                const userRequestedVisualChange = visualKeywords.some(k => message.toLowerCase().includes(k));
                const hasExistingUI = !!currentState?.uiConfig;

                const shouldSkipAgentB = hasExistingUI && !userRequestedVisualChange;

                let uiResultCode = "";
                const uiStartTime = performance.now();

                if (shouldSkipAgentB) {
                    // FAST PATH: Re-use existing template
                    // addLog('Optimization: Skipping Agent B (Data Push Only)');
                    uiResultCode = currentState.uiConfig;
                } else {
                    // SLOW PATH: Generate/Update Template
                    // addLog('Agent B: Generating Interface...');
                    // Pass the FULL ARRAY to Agent B
                    uiResultCode = await callUIAgent(newContext, currentState?.uiConfig);
                }

                const uiEndTime = performance.now();
                const uiDuration = Math.round(uiEndTime - uiStartTime);
                const totalDuration = Math.round(uiEndTime - startTime);

                // Update Local History with FULL metrics
                const finalHistory: ChatMessage[] = [
                    ...tempHistory,
                    {
                        role: 'model',
                        parts: textResponse,
                        metrics: {
                            logicLatency: logicDuration,
                            uiLatency: uiDuration,
                            totalLatency: totalDuration,
                            cached: shouldSkipAgentB
                        }
                    }
                ];
                setChatHistory(finalHistory);

                // 4. Update State & Persist
                const newState: FluidState = {
                    id: crypto.randomUUID(),
                    uiConfig: uiResultCode,
                    dataContext: newContext, // Save the Array
                    timestamp: Date.now()
                };

                await saveState(conversationId, newState.uiConfig, newState.dataContext);

                historyManager.push(newState);
                setCurrentState(newState);

            } else {
                // No UI, just update metrics for logic only
                const totalDuration = Math.round(logicEndTime - startTime);
                const finalHistory: ChatMessage[] = [
                    ...tempHistory,
                    {
                        role: 'model',
                        parts: textResponse,
                        metrics: {
                            logicLatency: logicDuration,
                            totalLatency: totalDuration
                        }
                    }
                ];
                setChatHistory(finalHistory);
            }

        } catch (e) {
            addLog(`Error: ${e}`);
            console.error(e);

            const errorHistory = [
                ...chatHistory,
                { role: 'user', parts: message },
                { role: 'model', parts: `Error: ${e}` }
            ] as ChatMessage[];
            setChatHistory(errorHistory);
        } finally {
            setIsProcessing(false);
        }
    };

    const deleteConversation = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
            try {
                await deleteConvAction(id);
                if (activeConversationId === id) setActiveConversationId(null);
                refreshConversations();
            } catch (error) {
                alert('Failed to delete conversation');
            }
        }
    };

    const traverse = (direction: 'back' | 'forward') => {
        const state = direction === 'back' ? historyManager.goBack() : historyManager.goForward();
        if (state) setCurrentState({ ...state });
    };

    // System logs still useful for debug/errors, but hidden from main chat flow usually
    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);
    // Auto-scroll chat to bottom
    const chatContainerRef = React.useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory, isProcessing, logs]);


    return (
        <div className="flex h-full bg-black text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-[350px] border-r border-slate-800 flex flex-col bg-slate-950 flex-shrink-0 relative z-20">

                {/* Header Actions */}
                <div className="p-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center z-30 relative">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${isHistoryOpen ? 'text-blue-400' : 'text-slate-400'}`}
                            title="Toggle History"
                        >
                            <Menu size={18} />
                        </button>
                        <span className="font-bold text-sm text-slate-200">Fluid Interface</span>
                    </div>
                    <button
                        onClick={() => {
                            setActiveConversationId(null);
                            setIsHistoryOpen(false);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors font-medium"
                    >
                        <Plus size={14} /> New Chat
                    </button>
                </div>

                {/* Drawer: History Panel */}
                <div
                    className={`absolute top-[57px] left-0 bottom-0 w-full bg-slate-900/95 backdrop-blur-sm z-20 transition-transform duration-300 ease-in-out border-r border-slate-800/50 flex flex-col ${isHistoryOpen ? 'translate-x-0' : '-translate-x-full'
                        }`}
                >
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-2">Recent Sessions</div>
                        {conversations?.map(conv => (
                            <div
                                key={conv.id}
                                onClick={() => {
                                    setActiveConversationId(conv.id);
                                    setIsHistoryOpen(false); // Close drawer on selection
                                }}
                                className={`px-4 py-3 mb-1 text-sm cursor-pointer hover:bg-slate-800 rounded-lg flex justify-between items-center group transition-all ${activeConversationId === conv.id ? 'bg-slate-800 text-blue-400' : 'text-slate-400'}`}
                            >
                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                    <span className="truncate font-medium">{conv.title}</span>
                                    <span className="text-[10px] opacity-60">{new Date(conv.updatedAt).toLocaleDateString()}</span>
                                </div>
                                <button
                                    onClick={(e) => deleteConversation(e, conv.id)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1.5 rounded hover:bg-slate-700 transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        {conversations?.length === 0 && (
                            <div className="p-8 text-center text-slate-600 text-xs italic">
                                No history yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Overlay Background for Drawer */}
                {isHistoryOpen && (
                    <div
                        className="absolute inset-0 bg-black/50 z-10 backdrop-blur-[1px]"
                        onClick={() => setIsHistoryOpen(false)}
                    />
                )}

                {/* Current Chat Area */}
                <div className="flex-1 flex flex-col min-h-0 relative bg-slate-950">
                    <div className="absolute inset-0 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={chatContainerRef}>
                        {chatHistory.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-2 opacity-50">
                                <Sparkles size={32} />
                                <p className="text-sm">Start a new journey</p>
                            </div>
                        )}

                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-sm'
                                        : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'
                                        }`}
                                >
                                    <div className="whitespace-pre-wrap">{msg.parts}</div>
                                </div>
                                <span className="text-[10px] text-slate-600 mt-1 px-1 flex items-center gap-2">
                                    <span>{msg.role === 'user' ? 'You' : 'Fluid Agent'}</span>
                                    {msg.metrics && (
                                        <span className="text-slate-700 font-mono opacity-70">
                                            {`L: ${(msg.metrics.logicLatency || 0) / 1000}s`}
                                            {msg.metrics.uiLatency ? ` | UI: ${(msg.metrics.uiLatency / 1000).toFixed(1)}s` : ''}
                                            {` | T: ${(msg.metrics.totalLatency || 0) / 1000}s`}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}

                        {/* Processing Indicators / System Logs displayed inline when relevant */}
                        {isProcessing && (
                            <div className="flex items-start">
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                    <span>Thinking...</span>
                                </div>
                            </div>
                        )}

                        {/* System Logs (Optional, can be hidden or shown in a debug mode, implementing simple version here for errors) */}
                        {logs.length > 0 && showDebug && (
                            <div className="mt-4 pt-4 border-t border-slate-900 space-y-1">
                                {logs.map((log, i) => (
                                    <div key={`log-${i}`} className="text-[10px] font-mono text-slate-600">{log}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-900 border-t border-slate-800 z-10">
                    <div className="flex items-end gap-2 bg-slate-800/50 rounded-xl p-2 border border-slate-700/50 focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:border-blue-500 transition-all shadow-lg">
                        <textarea
                            className="bg-transparent border-none outline-none flex-1 text-white placeholder-slate-500 resize-none py-2 px-1 text-sm custom-scrollbar"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto';
                                target.style.height = `${Math.min(target.scrollHeight, 240)}px`;
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type a message..."
                            disabled={isProcessing}
                            style={{
                                minHeight: '44px',
                                maxHeight: '240px',
                                height: input ? 'auto' : '44px'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isProcessing || !input.trim()}
                            className="p-2.5 mb-0.5 bg-blue-600 rounded-lg hover:bg-blue-500 text-white transition-all disabled:opacity-30 disabled:hover:bg-blue-600 shadow-md transform active:scale-95 flex-shrink-0"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex-1 flex flex-col bg-slate-900 relative">
                {/* Navigation Toolbar */}
                <div className="h-12 border-b border-slate-800 flex items-center px-4 gap-4 bg-slate-950 justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => traverse('back')}
                            disabled={!historyManager.canGoBack()}
                            className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <button
                            onClick={() => traverse('forward')}
                            disabled={!historyManager.canGoForward()}
                            className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30 transition-colors"
                        >
                            <ArrowRight size={20} />
                        </button>
                        <div className="text-slate-500 text-sm border-l border-slate-800 pl-4">
                            {currentState ? `State: ${currentState.id.slice(0, 8)}` : 'Ready'}
                        </div>
                    </div>

                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className={`text-xs px-3 py-1.5 rounded transition-colors ${showDebug ? 'bg-blue-900/50 text-blue-200' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    >
                        {showDebug ? 'Hide Debug' : 'Show Debug'}
                    </button>

                    <div className="h-6 w-px bg-slate-800 mx-2"></div>

                    <button
                        onClick={() => setShowRefineInput(!showRefineInput)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${showRefineInput ? 'bg-purple-900/50 text-purple-300' : 'hover:bg-slate-800 text-slate-400'}`}
                    >
                        <Sparkles size={14} />
                        <span className="text-xs font-medium">Refine UI</span>
                    </button>
                </div>

                {/* Refine Input Panel */}
                {showRefineInput && (
                    <div className="bg-slate-900 border-b border-purple-500/30 p-3 flex gap-2 animate-in slide-in-from-top-2">
                        <input
                            type="text"
                            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                            placeholder="Describe how to change the UI (e.g., 'Make charts green', 'Fix the layout')..."
                            value={refineInput}
                            onChange={(e) => setRefineInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && refineInput.trim()) {
                                    handleRefine(refineInput);
                                    setRefineInput('');
                                }
                            }}
                        />
                        <button
                            onClick={() => {
                                if (refineInput.trim()) {
                                    handleRefine(refineInput);
                                    setRefineInput('');
                                }
                            }}
                            disabled={isRefining || !refineInput.trim()}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                            {isRefining ? 'Updating...' : 'Apply'}
                        </button>
                    </div>
                )}

                {/* Error Banner */}
                {runtimeError && (
                    <div className="bg-red-900/50 border-b border-red-500/30 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-200 text-sm">
                            <AlertTriangle size={16} />
                            <span className="font-mono">{runtimeError}</span>
                        </div>
                        <button
                            onClick={() => handleRefine(`Fix this error: ${runtimeError}`, true)}
                            disabled={isRefining}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                            <Wrench size={12} />
                            {isRefining ? 'Fixing...' : 'Auto-Fix'}
                        </button>
                    </div>
                )}

                {/* Canvas */}
                <div className="flex-1 overflow-hidden relative flex">
                    {currentState ? (
                        <>
                            <div className={`transition-all duration-300 ${showDebug ? 'w-1/2' : 'w-full'} h-full`}>
                                <SandboxedRenderer
                                    key={currentState.id}
                                    code={currentState.uiConfig}
                                    data={currentState.dataContext}
                                />
                            </div>
                            {showDebug && (
                                <div className="w-1/2 h-full bg-slate-950 border-l border-slate-800 p-4 overflow-auto font-mono text-xs">
                                    <h3 className="text-yellow-400 font-bold mb-4 border-b border-slate-800 pb-2">Debug View</h3>
                                    <div className="mb-6">
                                        <h4 className="text-blue-400 mb-2 font-bold">1. Logic Agent (Data Context)</h4>
                                        <div className="bg-slate-900 p-3 rounded-md overflow-x-auto border border-slate-800">
                                            {typeof currentState.dataContext === 'string' ? (
                                                <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">{currentState.dataContext}</pre>
                                            ) : (
                                                <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300">
                                                    {(() => {
                                                        try {
                                                            return JSON.stringify(currentState.dataContext, null, 2);
                                                        } catch (e) {
                                                            return 'Error stringifying data context';
                                                        }
                                                    })()}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-green-400 mb-2 font-bold">2. UI Agent (React Code)</h4>
                                        <pre className="bg-slate-900 p-3 rounded-md whitespace-pre-wrap text-xs text-slate-300 border border-slate-800 h-96 overflow-auto custom-scrollbar">
                                            {currentState.uiConfig}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 flex-col gap-4">
                            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-2">
                                <RotateCcw className="animate-spin-slow opacity-20" size={40} />
                            </div>
                            <p className="font-light text-lg">Fluid Interface Ready</p>
                            <p className="text-sm opacity-50">Select a conversation or start a new one.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FluidEngine;
