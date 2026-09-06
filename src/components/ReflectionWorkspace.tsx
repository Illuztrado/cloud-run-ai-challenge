import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  Tag,
  Smile,
  Copy,
  Check,
  Download,
  Lightbulb,
  Compass,
  FileText,
  ListOrdered,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { JournalEntry, JournalMessage, ReflectionMode } from '../types';
import { VoiceSpeechInput } from './VoiceSpeechInput';

interface ReflectionWorkspaceProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: Partial<JournalEntry>) => void;
  isSaving: boolean;
  onAutoSummarize: () => Promise<void>;
  isSummarizing: boolean;
}

const MOOD_OPTIONS = [
  { label: 'Reflective', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  { label: 'Grateful', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  { label: 'Optimistic', color: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  { label: 'Challenged', color: 'bg-orange-500/10 text-orange-300 border-orange-500/30' },
  { label: 'Grounded', color: 'bg-teal-500/10 text-teal-300 border-teal-500/30' },
  { label: 'Determined', color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
  { label: 'Anxious', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
];

const PROMPT_STARTERS = [
  'Today I feel like unpacking...',
  'A major decision I am contemplating right now is...',
  'Something that brought me unexpected joy or learning was...',
  'I am feeling overwhelmed with my priorities because...',
];

export const ReflectionWorkspace: React.FC<ReflectionWorkspaceProps> = ({
  entry,
  onUpdateEntry,
  isSaving,
  onAutoSummarize,
  isSummarizing,
}) => {
  const [inputContent, setInputContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(entry.title);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTempTitle(entry.title);
  }, [entry.title]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entry.messages, isGenerating]);

  // Handle sending message to Gemini API
  const handleSendMessage = async (mode: ReflectionMode = 'chat', customDirective?: string) => {
    const textToSend = inputContent.trim() || customDirective;
    if (!textToSend && mode === 'chat') return;

    // Create user message if content provided
    const newMessages: JournalMessage[] = [...entry.messages];
    if (inputContent.trim()) {
      newMessages.push({
        id: 'msg-' + Date.now() + '-user',
        role: 'user',
        content: inputContent.trim(),
        timestamp: new Date().toISOString(),
      });
    }

    setInputContent('');
    setIsGenerating(true);

    // Save immediate user state
    onUpdateEntry({ messages: newMessages });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          mode,
          customPrompt: customDirective,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Server responded with an error');
      }

      const data = await response.json();
      const modelMessage: JournalMessage = {
        id: 'msg-' + Date.now() + '-model',
        role: 'model',
        content: data.text || 'I have reflected on your thought.',
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...newMessages, modelMessage];
      onUpdateEntry({ messages: updatedMessages });

      // If it was the first turn, auto-suggest title if untitled
      if (entry.title === 'Untitled Reflection' && updatedMessages.length >= 2) {
        onAutoSummarize();
      }
    } catch (err: any) {
      console.error('Error in chat generation:', err);
      const errorMessage: JournalMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'model',
        content: `*Error generating response: ${err.message || 'Please check network connection.'}*`,
        timestamp: new Date().toISOString(),
      };
      onUpdateEntry({ messages: [...newMessages, errorMessage] });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async (failedMsgIndex: number) => {
    // Collect all valid messages before this error
    const contextMessages = entry.messages.slice(0, failedMsgIndex);
    if (contextMessages.length === 0) return;

    onUpdateEntry({ messages: contextMessages });
    setIsGenerating(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: contextMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: 'chat',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Server responded with an error');
      }

      const data = await response.json();
      const modelMessage: JournalMessage = {
        id: 'msg-' + Date.now() + '-model',
        role: 'model',
        content: data.text || 'I have reflected on your thought.',
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...contextMessages, modelMessage];
      onUpdateEntry({ messages: updatedMessages });

      if (entry.title === 'Untitled Reflection' && updatedMessages.length >= 2) {
        onAutoSummarize();
      }
    } catch (err: any) {
      console.error('Error during retry:', err);
      const errorMessage: JournalMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'model',
        content: `*Error generating response: ${err.message || 'Please check network connection.'}*`,
        timestamp: new Date().toISOString(),
      };
      onUpdateEntry({ messages: [...contextMessages, errorMessage] });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage('chat');
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddTag = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    const cleanTag = newTagInput.trim().replace(/^#/, '');
    if (cleanTag && !entry.tags.includes(cleanTag)) {
      onUpdateEntry({ tags: [...entry.tags, cleanTag] });
      setNewTagInput('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateEntry({ tags: entry.tags.filter((t) => t !== tagToRemove) });
  };

  const handleSaveTitle = () => {
    if (tempTitle.trim() && tempTitle !== entry.title) {
      onUpdateEntry({ title: tempTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleExportMarkdown = () => {
    const formattedDate = new Date(entry.createdAt).toLocaleDateString();
    let md = `# ${entry.title}\n*Date: ${formattedDate}* | *Mood: ${entry.mood || 'N/A'}*\n`;
    if (entry.tags && entry.tags.length > 0) {
      md += `*Tags: ${entry.tags.join(', ')}*\n`;
    }
    if (entry.summary) {
      md += `\n## AI Synthesis\n${entry.summary}\n`;
    }
    md += `\n---\n\n## Journal & Reflections\n\n`;
    entry.messages.forEach((m) => {
      const speaker = m.role === 'user' ? '👤 **You**' : '✨ **Gemini Reflection**';
      md += `### ${speaker} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${entry.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'journal-entry'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="reflection-workspace" className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      {/* Top Session Meta Bar */}
      <div className="border-b border-neutral-800/80 bg-neutral-900/40 p-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title Editing */}
          <div className="flex-1 min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  id="entry-title-input"
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className="text-lg font-serif font-semibold text-neutral-100 bg-neutral-900 border border-amber-500/50 rounded-lg px-2.5 py-1 w-full focus:outline-none"
                />
                <button
                  onClick={handleSaveTitle}
                  className="px-3 py-1 text-xs bg-amber-400 text-neutral-950 font-medium rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                <h1 className="text-lg sm:text-xl font-serif font-semibold text-neutral-100 truncate group-hover:text-amber-200 transition">
                  {entry.title || 'Untitled Reflection'}
                </h1>
                <span className="text-xs text-neutral-500 opacity-0 group-hover:opacity-100 transition">
                  (Click to edit)
                </span>
              </div>
            )}
            <div className="text-[11px] text-neutral-500 mt-1 font-mono">
              Created {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* Controls: Mood selector, Auto-summarize, Export */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mood Dropdown */}
            <div className="relative inline-block">
              <select
                id="mood-select"
                value={entry.mood || 'Reflective'}
                onChange={(e) => onUpdateEntry({ mood: e.target.value })}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200 focus:outline-none focus:border-amber-500/50 appearance-none pr-7 cursor-pointer"
              >
                {MOOD_OPTIONS.map((m) => (
                  <option key={m.label} value={m.label}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Smile className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            </div>

            {/* Auto AI Synthesis button */}
            <button
              id="auto-summarize-button"
              onClick={onAutoSummarize}
              disabled={isSummarizing || entry.messages.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              title="Generate summary and smart tags with Gemini"
            >
              {isSummarizing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{isSummarizing ? 'Synthesizing...' : 'AI Synthesis'}</span>
            </button>

            {/* Export Markdown */}
            <button
              id="export-markdown-button"
              onClick={handleExportMarkdown}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition"
              title="Export entry to Markdown"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags bar */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-neutral-800/40 flex-wrap">
          <div className="flex items-center gap-1 text-[11px] text-neutral-400">
            <Tag className="w-3 h-3 text-neutral-500" />
            <span>Tags:</span>
          </div>

          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-neutral-800/90 text-neutral-300 border border-neutral-700"
            >
              <span>#{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-red-400 text-neutral-500 ml-0.5"
              >
                ×
              </button>
            </span>
          ))}

          {showTagInput ? (
            <div className="inline-flex items-center gap-1">
              <input
                id="new-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                onBlur={handleAddTag}
                placeholder="Add tag + Enter"
                autoFocus
                className="text-[11px] px-2 py-0.5 rounded bg-neutral-900 border border-amber-500/40 text-neutral-200 w-24 focus:outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowTagInput(true)}
              className="text-[11px] text-neutral-400 hover:text-neutral-200 px-1.5 py-0.5 rounded border border-dashed border-neutral-700 hover:border-neutral-500 flex items-center gap-0.5"
            >
              <Plus className="w-2.5 h-2.5" /> Tag
            </button>
          )}
        </div>

        {/* AI Summary Banner if exists */}
        {entry.summary && showSummaryPanel && (
          <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-neutral-200 text-xs flex items-start gap-2.5 relative">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold text-amber-300 text-[11px] uppercase tracking-wider mb-0.5">
                Gemini Synthesis
              </div>
              <p className="text-neutral-300 leading-relaxed">{entry.summary}</p>
            </div>
            <button
              onClick={() => setShowSummaryPanel(false)}
              className="text-neutral-500 hover:text-neutral-300 text-xs px-1"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {entry.messages.length === 0 ? (
          <div className="max-w-xl mx-auto py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-lg shadow-amber-500/5">
              <Compass className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-serif text-neutral-100 mb-2">Begin Your Reflection</h2>
            <p className="text-sm text-neutral-400 mb-6 max-w-md mx-auto leading-relaxed">
              Express what is on your mind today. Type freely or speak into your microphone—Gemini is here to help you reflect, synthesize, and gain clarity.
            </p>

            {/* Voice & Prompts Starter */}
            <div className="mb-6 flex flex-col items-center justify-center gap-2">
              <VoiceSpeechInput
                variant="prominent"
                buttonLabel="Speak into Microphone"
                onTranscriptReady={(transcript) => {
                  setInputContent((prev) => (prev.trim() ? prev + ' ' + transcript : transcript));
                  textareaRef.current?.focus();
                }}
              />
              <span className="text-[11px] text-neutral-500">
                or choose a reflection prompt below:
              </span>
            </div>

            {/* Quick Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {PROMPT_STARTERS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInputContent(prompt);
                    textareaRef.current?.focus();
                  }}
                  className="p-3 rounded-xl bg-neutral-900/70 hover:bg-neutral-850 border border-neutral-800 hover:border-amber-500/30 text-xs text-neutral-300 transition text-left leading-relaxed flex items-start gap-2 group"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400/70 group-hover:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          entry.messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const isCopied = copiedId === msg.id;
            const isError = msg.id.endsWith('-err') || msg.content.startsWith('*Error generating response');

            return (
              <div
                key={msg.id}
                id={`message-bubble-${msg.id}`}
                className={`flex gap-3.5 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-semibold shadow-sm ${
                    isUser
                      ? 'bg-neutral-700 text-neutral-200 border border-neutral-600'
                      : isError
                      ? 'bg-rose-900/80 text-rose-300 border border-rose-700'
                      : 'bg-gradient-to-br from-amber-400 to-orange-500 text-neutral-950 font-bold'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Box */}
                <div
                  className={`flex flex-col group relative rounded-2xl p-4 sm:p-5 text-sm transition ${
                    isUser
                      ? 'bg-neutral-800/90 text-neutral-100 border border-neutral-700/80 rounded-tr-sm max-w-xl'
                      : isError
                      ? 'bg-rose-950/40 border border-rose-800/60 rounded-tl-sm w-full text-rose-200'
                      : 'bg-neutral-900/90 text-neutral-200 border border-neutral-800 rounded-tl-sm w-full'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] text-neutral-500">
                    <span className={`font-medium ${isError ? 'text-rose-400' : 'text-neutral-400'}`}>
                      {isUser ? 'You' : isError ? 'Gemini Notice' : 'Gemini Reflection'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {!isError && (
                        <button
                          onClick={() => handleCopyText(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-200 p-0.5 transition"
                          title="Copy text"
                        >
                          {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  {isUser ? (
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  ) : isError ? (
                    <div className="space-y-3">
                      <div className="text-sm text-rose-200/90 leading-relaxed font-light">
                        {msg.content.replace(/^\*|\*$/g, '')}
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-rose-800/40">
                        <button
                          onClick={() => handleRetry(idx)}
                          disabled={isGenerating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-medium text-xs transition active:scale-95 shadow-sm disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                          <span>Retry Reflection (Resilient Fallback)</span>
                        </button>
                        <span className="text-[11px] text-neutral-400">
                          Your prompt is preserved above.
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-body prose prose-invert prose-sm max-w-none text-neutral-200 leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isGenerating && (
          <div className="flex gap-3.5 max-w-3xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-neutral-950 font-bold flex-shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl rounded-tl-sm p-4 text-xs text-neutral-400 flex items-center gap-2.5">
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
              <span>Gemini is reflecting and formulating insights...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Prompt Chips */}
      {entry.messages.length > 0 && (
        <div className="px-4 sm:px-6 py-2 bg-neutral-900/60 border-t border-neutral-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[11px] text-neutral-500 whitespace-nowrap flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Reflection Modes:
          </span>

          <button
            onClick={() => handleSendMessage('summarize', 'Please summarize the core insights, emotional shifts, and recurring patterns from our reflection so far.')}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-amber-500/30 whitespace-nowrap transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText className="w-3 h-3 text-amber-400" />
            <span>Summarize Insights</span>
          </button>

          <button
            onClick={() => handleSendMessage('brainstorm', 'Based on what I have shared, help me brainstorm 3-4 creative ways or constructive approaches to handle this.')}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-orange-500/30 whitespace-nowrap transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Lightbulb className="w-3 h-3 text-orange-400" />
            <span>Brainstorm Ideas</span>
          </button>

          <button
            onClick={() => handleSendMessage('reflect', 'Ask me 2-3 deep, thoughtful questions that will help me explore what I might be avoiding or learning from this experience.')}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-sky-500/30 whitespace-nowrap transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Compass className="w-3 h-3 text-sky-400" />
            <span>Deeper Questions</span>
          </button>

          <button
            onClick={() => handleSendMessage('action_plan', 'Turn our discussion into a concrete, gentle 3-step action plan with clear milestones.')}
            disabled={isGenerating}
            className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 hover:border-emerald-500/30 whitespace-nowrap transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <ListOrdered className="w-3 h-3 text-emerald-400" />
            <span>Action Steps</span>
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 sm:p-5 bg-neutral-900/90 border-t border-neutral-800 relative">
        <div className="max-w-4xl mx-auto flex items-end gap-2.5">
          <div className="flex-1 relative rounded-xl bg-neutral-950 border border-neutral-800 focus-within:border-amber-500/50 shadow-inner">
            <textarea
              ref={textareaRef}
              id="reflection-input"
              rows={2}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write or speak into your microphone to add a journal entry... (Enter to send, Shift+Enter for new line)"
              className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 text-sm p-3 focus:outline-none resize-none leading-relaxed min-h-[50px] max-h-40"
            />
          </div>

          <VoiceSpeechInput
            onTranscriptReady={(transcript) => {
              setInputContent((prev) => (prev.trim() ? prev + ' ' + transcript : transcript));
              textareaRef.current?.focus();
            }}
            disabled={isGenerating}
          />

          <button
            id="send-message-button"
            onClick={() => handleSendMessage('chat')}
            disabled={!inputContent.trim() || isGenerating}
            className="h-[50px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/10 flex-shrink-0"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
