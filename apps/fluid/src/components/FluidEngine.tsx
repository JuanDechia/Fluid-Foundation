import React, { useState, useEffect } from 'react';
import { Send, ArrowLeft, ArrowRight, RotateCcw, Plus, MessageSquare, Trash2, AlertTriangle, Wrench, Sparkles } from 'lucide-react';
import SandboxedRenderer from './SandboxedRenderer';
import { HistoryManager, type FluidState } from '../lib/history_manager';
import { callLogicAgent, type ChatMessage } from '../agents/agent_logic';
import { callUIAgent } from '../agents/agent_ui';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

const historyManager = new HistoryManager();

const FluidEngine: React.FC = () => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentState, setCurrentState] = useState<FluidState | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [showRefineInput, setShowRefineInput] = useState(false);
    const [refineInput, setRefineInput] = useState('');

    // Persistence State
    const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
    const conversations = useLiveQuery(() => db.conversations.orderBy('updatedAt').reverse().toArray());

    // Chat History for Agent A
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

    const [showDebug, setShowDebug] = useState(false);

    // Initialize/Load Conversation
    useEffect(() => {
        const loadConversation = async () => {
            if (activeConversationId) {
                // Load Messages
                const messages = await db.messages.where('conversationId').equals(activeConversationId).sortBy('timestamp');
                const formattedHistory: ChatMessage[] = messages.map(m => ({
                    role: m.role as 'user' | 'model',
                    parts: m.content
                }));
                setChatHistory(formattedHistory);
                setLogs(messages.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content.slice(0, 50)}...`));

                // Load Latest State
                // We only store states when UI is generated. 
                // Getting the last state for this conversation.
                const lastStateEntry = await db.fluidStates
                    .where('conversationId')
                    .equals(activeConversationId)
                    .reverse()
                    .first();

                if (lastStateEntry) {
                    const restoredState: FluidState = {
                        id: lastStateEntry.id,
                        uiConfig: lastStateEntry.uiConfig,
                        dataContext: lastStateEntry.dataContext,
                        timestamp: lastStateEntry.timestamp
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

            await db.fluidStates.add({
                id: newState.id,
                conversationId: activeConversationId!,
                uiConfig: newState.uiConfig,
                dataContext: newState.dataContext,
                timestamp: newState.timestamp
            });

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
        addLog(`User: ${message}`);

        try {
            // 0. Ensure Conversation Exists
            let conversationId = activeConversationId;
            if (!conversationId) {
                conversationId = await db.conversations.add({
                    title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }) as number;
                setActiveConversationId(conversationId);
            } else {
                // Update timestamp
                await db.conversations.update(conversationId, { updatedAt: new Date() });
            }

            // Save User Message
            await db.messages.add({
                conversationId,
                role: 'user',
                content: message,
                timestamp: new Date()
            });

            // 1. Logic Agent (Agent A)
            addLog('Agent A: Processing...');
            const logicResponseText = await callLogicAgent(message, chatHistory);

            // Save Agent Message
            await db.messages.add({
                conversationId,
                role: 'model',
                content: logicResponseText,
                timestamp: new Date()
            });

            // Update Local History
            const newHistory: ChatMessage[] = [
                ...chatHistory,
                { role: 'user', parts: message },
                { role: 'model', parts: logicResponseText }
            ];
            setChatHistory(newHistory);

            // 2. Accumulate Data Context
            const previousContext = currentState?.dataContext || "";
            const combinedContext = previousContext
                ? `${previousContext}\n\n---\n\n${logicResponseText}`
                : logicResponseText;

            // 3. UI Agent (Agent B)
            addLog('Agent B: Generating Interface...');
            const previousCode = currentState?.uiConfig;
            const uiResultCode = await callUIAgent(combinedContext, previousCode);

            // 4. Update State & Persist
            const newState: FluidState = {
                id: crypto.randomUUID(),
                uiConfig: uiResultCode,
                dataContext: combinedContext,
                timestamp: Date.now()
            };

            await db.fluidStates.add({
                id: newState.id,
                conversationId,
                uiConfig: newState.uiConfig,
                dataContext: newState.dataContext,
                timestamp: newState.timestamp
            });

            historyManager.push(newState);
            setCurrentState(newState);
            addLog('System: Render Complete');

        } catch (e) {
            addLog(`Error: ${e}`);
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    const deleteConversation = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
            await db.conversations.delete(id);
            await db.messages.where('conversationId').equals(id).delete();
            await db.fluidStates.where('conversationId').equals(id).delete();
            if (activeConversationId === id) setActiveConversationId(null);
        }
    };

    const traverse = (direction: 'back' | 'forward') => {
        const state = direction === 'back' ? historyManager.goBack() : historyManager.goForward();
        if (state) setCurrentState({ ...state });
    };

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">
                <div className="p-4 border-b border-slate-800 font-bold text-lg bg-slate-900 flex justify-between items-center">
                    <span>Fluid Interface</span>
                    <button onClick={() => setActiveConversationId(null)} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded flex items-center gap-1">
                        <Plus size={14} /> New
                    </button>
                </div>

                {/* Conversations List */}
                <div className="h-1/3 border-b border-slate-800 overflow-y-auto">
                    <div className="p-2 text-xs font-bold text-slate-500 uppercase tracking-wider">History</div>
                    {conversations?.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setActiveConversationId(conv.id)}
                            className={`p-3 text-sm cursor-pointer hover:bg-slate-900 flex justify-between items-center group ${activeConversationId === conv.id ? 'bg-slate-900 border-l-2 border-blue-500' : 'text-slate-400'}`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <MessageSquare size={14} className="opacity-50" />
                                <span className="truncate max-w-[180px]">{conv.title}</span>
                            </div>
                            <button
                                onClick={(e) => deleteConversation(e, conv.id!)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                    {conversations?.length === 0 && (
                        <div className="p-4 text-center text-slate-600 text-xs italic">No history yet</div>
                    )}
                </div>

                {/* Current Chat Logs */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm font-mono text-slate-400 bg-slate-950/50">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Logs</div>
                    {logs.length === 0 && <div className="text-slate-700 italic">Start a conversation...</div>}
                    {logs.map((log, i) => (
                        <div key={i} className="break-words border-b border-slate-900 pb-1">{log}</div>
                    ))}
                    {isProcessing && <div className="text-blue-400 animate-pulse">Thinking...</div>}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-slate-900 border-t border-slate-800">
                    <div className="flex items-end gap-2 bg-slate-800 rounded-lg p-2 border border-slate-700 focus-within:ring-2 ring-blue-500">
                        <textarea
                            className="bg-transparent border-none outline-none flex-1 text-white placeholder-slate-500 resize-none min-h-[44px] max-h-32 py-2"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask fluidly..."
                            disabled={isProcessing}
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isProcessing}
                            className="p-2 mb-0.5 bg-blue-600 rounded-md hover:bg-blue-500 transition-colors disabled:opacity-50"
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
