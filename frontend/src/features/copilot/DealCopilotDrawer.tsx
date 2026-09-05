import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { copilotApi, CopilotMessage, ReferencedQuote } from '../../api/copilot';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  Bot,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Zap,
  ArrowUpRight,
  Flame,
  AlertCircle,
  HelpCircle,
  Clock,
  RefreshCw,
  MessageSquare,
  FileText,
  Lock,
  BarChart3,
  Receipt,
  Layers,
  Package,
  CheckCircle2,
  Cpu,
  MoreVertical,
  Paperclip,
  Smile,
} from 'lucide-react';

interface DealCopilotDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function DealCopilotDrawer({ isOpen: externalIsOpen, onClose: externalOnClose }: DealCopilotDrawerProps = {}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  
  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;
  
  const handleClose = () => {
    if (isControlled && externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [referencedQuotes, setReferencedQuotes] = useState<ReferencedQuote[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const role = user?.role || 'sales_rep';

  // Role-specific quick prompt suggestions
  const promptPills: Record<string, { label: string; query: string; icon: any; isPrimary?: boolean }[]> = {
    sales_rep: [
      { label: 'Workspace Tabs & Guide', query: 'Explain all the workspace tabs, features, and buttons available in DealFlow360 and how I can use them.', icon: Layers, isPrimary: true },
      { label: 'My Deals in Indian Currency', query: 'What is the status of my deals today in Indian currency (Lakhs and Crores) and what are my today priorities?', icon: Flame },
      { label: 'Drafts Ready to Submit', query: 'Which draft quotes need to be finalized and submitted today?', icon: ArrowUpRight },
      { label: 'Customer Messages & Counters', query: 'Are there any urgent customer messages or counter-offers needing reply?', icon: MessageSquare },
    ],
    sales_manager: [
      { label: 'Manager Approval Queue', query: 'What is my today work and which quotations are waiting for manager approval?', icon: ShieldCheck, isPrimary: true },
      { label: 'Workspace Tabs & Features', query: 'Explain all the tabs, routes, and features available in DealFlow360.', icon: Layers },
      { label: 'Team Pipeline in INR', query: 'Give me the team pipeline status, revenue, and stalled deals in Indian currency terms (Lakhs/Crores).', icon: BarChart3 },
      { label: 'Margin & Risk Alerts', query: 'Are there any high-risk discount deals or margin erosions today?', icon: AlertCircle },
    ],
    finance: [
      { label: 'Finance Sign-offs & Overages', query: 'What is my today work and which high-tier quotes need finance sign-off?', icon: FileText, isPrimary: true },
      { label: 'Workspace Tabs & Invoicing Guide', query: 'Explain all tabs and features in DealFlow360 including Invoicing, Subscriptions, and Proration.', icon: Layers },
      { label: 'Overdue Receivables in INR', query: 'What are the overdue invoices and unpaid collections today in Indian currency terms (Lakhs/Crores)?', icon: Receipt },
      { label: 'Settlement & Cash Flow', query: 'Give me a summary of outstanding receivables, active subscriptions, and pending approvals.', icon: Zap },
    ],
    admin: [
      { label: 'System Bottlenecks & Priorities', query: 'What is today work, system bottlenecks, and priority items across the company?', icon: Layers, isPrimary: true },
      { label: 'Workspace Tabs & Features Guide', query: 'Explain all tabs, navigation routes, and capabilities in DealFlow360.', icon: Layers },
      { label: 'Company Revenue in INR', query: 'Give me the overall pipeline value, won deals, and collections in Indian currency (Crores and Lakhs).', icon: BarChart3 },
      { label: 'Low Stock Inventory Alerts', query: 'Are there any inventory stock alerts below threshold across warehouses?', icon: Package },
    ],
  };

  const currentPills = promptPills[role] || promptPills['sales_rep'];

  // Keyboard shortcut (Alt + C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (isControlled && externalOnClose) {
          if (isOpen) externalOnClose();
        } else {
          setInternalIsOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isControlled, isOpen, externalOnClose]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText || input).trim();
    if (!text || isLoading) return;

    const newMessages: CopilotMessage[] = [...messages, { role: 'user', content: text, timestamp: new Date().toISOString() }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await copilotApi.chat(text, messages);
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: response.reply,
          timestamp: response.timestamp,
        },
      ]);
      if (response.referenced_quotes && response.referenced_quotes.length > 0) {
        setReferencedQuotes(response.referenced_quotes);
      }
    } catch (err: any) {
      const errorMessage = err?.detail || err?.message || 'Request failed. Please check your connection and try again.';
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `⚠️ ${errorMessage}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setReferencedQuotes([]);
    setShowOptionsMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const navigateToQuote = (quoteNumber: string) => {
    handleClose();
    navigate(`/quotations?search=${encodeURIComponent(quoteNumber)}`);
  };

  // Helper to format basic markdown (bold, tables, lists, headers) into pleasant HTML
  const formatMarkdown = (text: string) => {
    if (text.startsWith('⚠️')) {
      return (
        <div className="flex flex-col gap-2 p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-amber-900 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{text.replace('⚠️', '').trim()}</span>
          </div>
          <button
            onClick={() => {
              const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
              if (lastUserMsg) handleSend(lastUserMsg.content);
            }}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-full text-xs font-medium hover:bg-amber-700 transition-colors shadow-xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Query</span>
          </button>
        </div>
      );
    }

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let tableKey = 0;

    const flushTable = () => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const body = tableRows.slice(1).filter((r) => !r.every((c) => c.trim().match(/^[-:| ]+$/)));
        elements.push(
          <div key={`table-${tableKey++}`} className="my-3 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="min-w-full divide-y divide-slate-100 text-xs">
              <thead className="bg-slate-50/90 text-slate-700">
                <tr>
                  {header.map((col, idx) => (
                    <th key={idx} className="px-3.5 py-2.5 text-left font-bold text-slate-900 border-b border-slate-200/80">
                      {col.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {body.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/30">
                    {row.map((col, cIdx) => {
                      const trimmed = col.trim();
                      const isQuote = /(IN-\d{4}-\d{4}|Q-[A-Za-z0-9-]+)/.test(trimmed);
                      return (
                        <td key={cIdx} className="px-3.5 py-2.5 text-slate-800 font-normal">
                          {isQuote ? (
                            <button
                              onClick={() => {
                                const match = trimmed.match(/(IN-\d{4}-\d{4}|Q-[A-Za-z0-9-]+)/);
                                if (match) navigateToQuote(match[0]);
                              }}
                              className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-300 cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              {trimmed}
                            </button>
                          ) : (
                            renderInlineMarkdown(trimmed)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      // Table line
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        const cols = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(cols);
        return;
      } else if (inTable) {
        flushTable();
      }

      // Headings
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={idx} className="text-xs font-bold text-slate-900 mt-3 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
            {renderInlineMarkdown(trimmed.replace('### ', ''))}
          </h4>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={idx} className="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 pb-1 border-b border-slate-100">
            {renderInlineMarkdown(trimmed.replace('## ', ''))}
          </h3>
        );
      } else if (trimmed.startsWith('# ')) {
        elements.push(
          <h2 key={idx} className="text-base font-bold text-slate-900 mt-3.5 mb-2">
            {renderInlineMarkdown(trimmed.replace('# ', ''))}
          </h2>
        );
      }
      // List items
      else if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.replace(/^[•\-*]\s+/, '');
        elements.push(
          <li key={idx} className="ml-4 list-disc text-xs text-slate-700 my-1 leading-relaxed">
            {renderInlineMarkdown(content)}
          </li>
        );
      } else if (trimmed.match(/^\d+\.\s+/)) {
        const num = trimmed.match(/^\d+\./)?.[0] || '';
        const content = trimmed.replace(/^\d+\.\s+/, '');
        elements.push(
          <div key={idx} className="flex gap-2 text-xs text-slate-700 my-1.5 leading-relaxed">
            <span className="font-bold text-blue-600 shrink-0">{num}</span>
            <span>{renderInlineMarkdown(content)}</span>
          </div>
        );
      }
      // Empty lines
      else if (!trimmed) {
        elements.push(<div key={idx} className="h-1.5" />);
      }
      // Normal paragraph
      else {
        elements.push(
          <p key={idx} className="text-xs text-slate-800 my-1.5 leading-relaxed">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      }
    });

    if (inTable) flushTable();

    return elements;
  };

  const renderInlineMarkdown = (text: string) => {
    // Check for Priority Badges with Lucide icons
    if (text.includes('P0') && (text.includes('Critical') || text.includes('Immediate') || text.includes('Urgent'))) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full text-[11px]">
          <Flame className="w-3 h-3 text-rose-600 shrink-0" />
          <span>{text.replace(/^[🔥⚡📋\s]+/, '')}</span>
        </span>
      );
    }
    if (text.includes('P1') && (text.includes('High') || text.includes('Priority') || text.includes('Alert') || text.includes('Draft'))) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[11px]">
          <Zap className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{text.replace(/^[🔥⚡📋\s]+/, '')}</span>
        </span>
      );
    }
    if (text.includes('P2') && (text.includes('Routine') || text.includes('Tracking') || text.includes('Follow'))) {
      return (
        <span className="inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full text-[11px]">
          <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{text.replace(/^[🔥⚡📋\s]+/, '')}</span>
        </span>
      );
    }

    const cleanText = text.replace(/^[🔥⚡📋\s]+/, '');
    const parts = cleanText.split(/(\*\*.*?\*\*|\`.*?\`|IN-\d{4}-\d{4}|Q-[A-Za-z0-9-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-slate-100 font-mono text-[11px] text-blue-700 border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (/^(IN-\d{4}-\d{4}|Q-[A-Za-z0-9-]+)$/.test(part)) {
        return (
          <button
            key={i}
            onClick={() => navigateToQuote(part)}
            className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-300 cursor-pointer bg-blue-50/70 hover:bg-blue-100/80 px-1.5 py-0.5 rounded transition-colors"
          >
            <FileText className="w-2.5 h-2.5" />
            <span>{part}</span>
          </button>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* SLIDE-OVER COPILOT DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity">
          <div
            className="w-full sm:w-[480px] md:w-[520px] bg-[#F8FAFC] h-full shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden animate-in slide-in-from-right duration-300"
            role="dialog"
            aria-label="AI Deal Copilot"
          >
            {/* ── VIBRANT ROYAL BLUE HEADER (#2563EB) WITH ORGANIC WAVE ── */}
            <div className="relative bg-[#2563EB] text-white pt-5 pb-9 px-6 shrink-0 shadow-sm">
              <div className="flex items-start justify-between relative z-20">
                {/* Avatar & Title Details */}
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-white/20 p-0.5 shadow-md ring-2 ring-white/30">
                      <div className="w-full h-full rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center overflow-hidden">
                        <Bot className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    {/* Live Online Badge Indicator */}
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-[#2563EB]"></span>
                  </div>

                  <div>
                    <span className="text-xs font-normal text-blue-100/90 block leading-tight">
                      Chat with
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight leading-tight">
                      DealFlow360 Copilot
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-blue-100 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                      <span>We're online</span>
                      <span className="text-blue-200/60">•</span>
                      <span className="capitalize text-white font-semibold">{role.replace('_', ' ')} Scope</span>
                    </div>
                  </div>
                </div>

                {/* Header Controls (Options & Close) */}
                <div className="flex items-center gap-1 relative">
                  <div className="relative">
                    <button
                      onClick={() => setShowOptionsMenu((prev) => !prev)}
                      className="p-2 text-white/90 hover:text-white rounded-full hover:bg-white/15 transition-colors cursor-pointer"
                      title="Options"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                    {showOptionsMenu && (
                      <div className="absolute right-0 top-10 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-slate-800 text-xs">
                        <button
                          onClick={handleReset}
                          className="w-full px-3.5 py-2 text-left hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors cursor-pointer font-medium"
                        >
                          <RotateCcw className="w-4 h-4 text-slate-500" />
                          <span>Clear conversation</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleClose}
                    className="p-2 text-white/90 hover:text-white rounded-full hover:bg-white/15 transition-colors cursor-pointer"
                    title="Close Chat"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Smooth Curved Wave Divider */}
              <div className="absolute -bottom-0.5 left-0 right-0 overflow-hidden leading-none z-10 pointer-events-none">
                <svg
                  viewBox="0 0 500 35"
                  preserveAspectRatio="none"
                  className="w-full h-7 text-[#F8FAFC] fill-current"
                >
                  <path d="M0,0 C150,30 350,5 500,22 L500,35 L0,35 Z" />
                </svg>
              </div>
            </div>

            {/* ── CHAT MESSAGES BODY ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-[#F8FAFC]">
              {messages.length === 0 ? (
                <div className="space-y-4 pt-1">
                  {/* WELCOME ASSISTANT MESSAGE BUBBLE */}
                  <div className="flex justify-start">
                    <div className="max-w-[92%] bg-white rounded-3xl rounded-tl-sm p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100 text-slate-800 text-xs leading-relaxed space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        <Sparkles className="w-4 h-4 text-[#2563EB]" />
                        <span>Hi {user?.first_name || user?.username || 'there'}! Nice to see you.</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-xs">
                        I am your real-time <strong>Deal Copilot</strong>. I analyze live quotations, pending approvals, and customer discussions to give you actionable insights for today.
                      </p>
                      <div className="flex items-center gap-1.5 pt-1.5 text-[11px] text-slate-500 border-t border-slate-100">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Database privacy: Only authorized {role.replace('_', ' ')} data is shown.</span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK SUGGESTION BUTTONS (MATCHING ROYAL BLUE THEME) */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                      Quick Inquiries
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {currentPills.map((pill, idx) => {
                        const Icon = pill.icon;
                        if (pill.isPrimary) {
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSend(pill.query)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs hover:shadow-md transition-all cursor-pointer group"
                            >
                              <Icon className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                              <span>{pill.label}</span>
                            </button>
                          );
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSend(pill.query)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-blue-50/70 border-2 border-[#2563EB] text-[#2563EB] text-xs font-semibold shadow-xs hover:border-[#1D4ED8] transition-all cursor-pointer group"
                          >
                            <Icon className="w-3.5 h-3.5 text-[#2563EB] group-hover:scale-110 transition-transform" />
                            <span>{pill.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[88%] text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#2563EB] text-white rounded-3xl rounded-tr-xs px-5 py-3.5 shadow-xs font-medium'
                          : 'bg-white text-slate-800 rounded-3xl rounded-tl-xs p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div>{formatMarkdown(msg.content)}</div>
                      )}
                    </div>
                    <div
                      className={`text-[9px] mt-1.5 px-2 flex items-center gap-1 ${
                        msg.role === 'user' ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>{new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}

              {/* LOADING ANIMATION */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-3xl rounded-tl-xs px-5 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                      <span className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-[#2563EB] animate-bounce [animation-delay:0.4s]"></span>
                      </span>
                      <span className="font-medium text-slate-700">Analyzing live deals...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* REFERENCED QUOTES */}
              {referencedQuotes.length > 0 && !isLoading && (
                <div className="pt-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 px-1">
                    Referenced Deals:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {referencedQuotes.map((rq, rIdx) => (
                      <button
                        key={rIdx}
                        onClick={() => navigateToQuote(rq.quote_number)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-mono font-semibold transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span>{rq.quote_number}</span>
                        {rq.customer && <span className="text-[10px] text-blue-600 font-sans">({rq.customer})</span>}
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── MINIMALIST INPUT FOOTER (ROYAL BLUE THEME) ── */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 shrink-0">
              {messages.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-none">
                  {currentPills.slice(0, 3).map((pill, idx) => (
                    <button
                      key={idx}
                      disabled={isLoading}
                      onClick={() => handleSend(pill.query)}
                      className="whitespace-nowrap px-3.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 font-medium transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3">
                {/* Action Attachment Icons */}
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    className="p-1.5 hover:text-[#2563EB] rounded-full hover:bg-blue-50 transition-colors"
                    title="Quick insights"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 hover:text-[#2563EB] rounded-full hover:bg-blue-50 transition-colors"
                    title="Attach reference"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>

                {/* Seamless Input Field */}
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your message..."
                    rows={1}
                    disabled={isLoading}
                    className="w-full bg-transparent border-0 border-b border-slate-200 px-1 py-1.5 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] resize-none disabled:opacity-50 transition-colors"
                  />
                </div>

                {/* Circular Floating Send Button */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-11 h-11 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-[#2563EB] shadow-md shrink-0 cursor-pointer"
                  title="Send message (Enter)"
                >
                  <Send className="w-4 h-4 translate-x-0.5 -translate-y-0.5" />
                </button>
              </div>

              <div className="flex items-center justify-between mt-2.5 px-1 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Workspace RAG AI Copilot
                </span>
                <span>Press <strong>Enter</strong> to send</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
