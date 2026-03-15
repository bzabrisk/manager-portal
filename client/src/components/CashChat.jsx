import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { api } from '../api/client';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'cash',
  text: "Hey! I'm Cash, your SMASH assistant. I can help you look up fundraiser info, check on tasks, and answer questions about your data. What can I help you with?",
};

const QUICK_ACTIONS = ['Show overdue tasks', 'Fundraiser summary', "Today's payouts"];

const MAX_HISTORY = 20;
const PROACTIVE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// --- Pacific time helpers ---

function getPacificNow() {
  const now = new Date();
  const pacificStr = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  return new Date(pacificStr);
}

function getPacificDay() {
  return new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long' });
}

function getPacificDate() {
  const d = getPacificNow();
  return { month: d.getMonth() + 1, day: d.getDate() };
}

function getPacificHour() {
  return getPacificNow().getHours();
}

// --- Markdown formatting ---

function FormatMessage({ text }) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  function flushList() {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      const className = listType === 'ol' ? 'list-decimal ml-4 space-y-0.5' : 'list-disc ml-4 space-y-0.5';
      elements.push(
        <Tag key={`list-${elements.length}`} className={className}>
          {listItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^[-*•]\s+/.test(line)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(line.replace(/^[-*•]\s+/, ''));
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(line.replace(/^\d+[.)]\s+/, ''));
      continue;
    }

    flushList();

    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    elements.push(<p key={`p-${i}`} className="mb-1 last:mb-0">{formatInline(line)}</p>);
  }

  flushList();
  return <>{elements}</>;
}

function formatInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

// --- Main Component ---

export default function CashChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proactiveBadge, setProactiveBadge] = useState(false);
  const [pendingProactive, setPendingProactive] = useState(null);
  const messagesEndRef = useRef(null);
  const proactiveShownRef = useRef(new Set());


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // --- Proactive message logic ---

  const queueProactive = useCallback((type, text) => {
    if (proactiveShownRef.current.has(type)) return;
    proactiveShownRef.current.add(type);
    setPendingProactive({ type, text });
    setProactiveBadge(true);
  }, []);

  const checkProactiveMessages = useCallback(async () => {
    const day = getPacificDay();
    const hour = getPacificHour();
    const { month, day: dateDay } = getPacificDate();

    // Birthday — November 18
    if (month === 11 && dateDay === 18 && !proactiveShownRef.current.has('birthday')) {
      queueProactive(
        'birthday',
        "🎂 HAPPY BIRTHDAY KRISTA!! 🎉🦍 The fundraisers can wait 5 minutes while I say this: you are the absolute BEST office manager a gorilla could ever ask for. Tahni wanted me to tell you that, but honestly I was already going to say it myself. Have the most amazing day! 🎂❤️"
      );
      return;
    }

    // SMASH Anniversary / Cash's Birthday — October 10
    if (month === 10 && dateDay === 10 && !proactiveShownRef.current.has('anniversary')) {
      queueProactive(
        'anniversary',
        "🎉 IT'S MY BIRTHDAY!! 🦍🎂 Well, technically it's SMASH's anniversary — October 10, 2024 is when it all started. But I consider it MY birthday too since I wouldn't exist without SMASH. Anyway, Krista, I am hereby giving you full authority to take the SMASH credit card and take the whole company out to celebrate. Would you like me to help draft the invite? 🍽️🎉"
      );
      return;
    }

    // Monday morning — 7am-12pm PT
    if (day === 'Monday' && hour >= 7 && hour < 12 && !proactiveShownRef.current.has('monday')) {
      try {
        const stats = await api.chat.weeklySummary();
        queueProactive(
          'monday',
          `Good morning, Krista! Happy Monday 🦍 Here's your week at a glance:\n• ${stats.dashboard_task_count} tasks on your dashboard\n• ${stats.active_fundraiser_count} fundraisers currently active\n• ${stats.ending_this_week} fundraisers ending this week\n• ${stats.ended_needs_action} ended fundraisers waiting on closeout\n\nLet's have a great week! What would you like to tackle first?`
        );
      } catch (err) {
        console.error('Failed to fetch Monday summary:', err);
      }
      return;
    }

    // Friday afternoon — 2pm-6pm PT
    if (day === 'Friday' && hour >= 14 && hour < 18 && !proactiveShownRef.current.has('friday')) {
      try {
        const stats = await api.chat.weeklySummary();
        queueProactive(
          'friday',
          `Hey Krista — it's Friday! 🎉 Here's your week in review:\n• ${stats.tasks_completed_this_week} tasks completed this week\n• ${stats.ending_this_week} fundraisers ending this week\n• ${stats.active_fundraiser_count} fundraisers still active\n\nYou earned this weekend. Now go enjoy it! 🍌`
        );
      } catch (err) {
        console.error('Failed to fetch Friday summary:', err);
      }
      return;
    }

  }, [queueProactive]);

  // Run proactive check on mount + interval
  useEffect(() => {
    checkProactiveMessages();
    const interval = setInterval(checkProactiveMessages, PROACTIVE_CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkProactiveMessages]);

  // When chat opens, deliver pending proactive message
  useEffect(() => {
    if (open && pendingProactive) {
      setMessages(prev => [
        ...prev,
        { id: Date.now(), role: 'cash', text: pendingProactive.text },
      ]);
      setPendingProactive(null);
      setProactiveBadge(false);
    }
  }, [open, pendingProactive]);

  // --- Chat logic ---

  function buildHistory(msgs) {
    const history = msgs
      .filter(m => m.id !== 'welcome')
      .map(m => ({
        role: m.role === 'cash' ? 'assistant' : 'user',
        content: m.text,
      }));

    if (history.length > MAX_HISTORY) {
      return history.slice(-MAX_HISTORY);
    }
    return history;
  }

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg = { id: Date.now(), role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const allMsgs = [...messages, userMsg];
      const history = buildHistory(allMsgs);

      const data = await api.chat.send(history);

      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'cash', text: data.response },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'cash', text: "Oops, I hit a snag. Try asking again! 🍌" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 w-[380px] h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col z-50 transition-all duration-200 origin-bottom-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl shrink-0">
          <div className="relative">
            <img
              src="/cash-avatar.png"
              alt="Cash"
              className="w-9 h-9 rounded-full object-cover border-2 border-[#ff5000]"
            />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-50" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-800">Cash</div>
            <div className="text-xs text-slate-400">SMASH Assistant</div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'cash' && (
                <img
                  src="/cash-avatar.png"
                  alt="Cash"
                  className="w-7 h-7 rounded-full object-cover shrink-0 mt-1"
                />
              )}
              <div
                className={`max-w-[75%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#ff5000] text-white rounded-br-sm'
                    : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                }`}
              >
                {msg.role === 'cash' && msg.id !== 'welcome' ? (
                  <FormatMessage text={msg.text} />
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-2 justify-start">
              <img
                src="/cash-avatar.png"
                alt="Cash"
                className="w-7 h-7 rounded-full object-cover shrink-0 mt-1"
              />
              <div className="bg-slate-100 rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Quick action chips — show only when just the welcome message exists */}
          {messages.length === 1 && messages[0].id === 'welcome' && !isLoading && (
            <div className="flex flex-wrap gap-2 pl-9">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#ff5000] text-[#ff5000] hover:bg-[#ff5000] hover:text-white transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? 'Cash is thinking...' : 'Ask Cash anything...'}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              disabled={isLoading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="p-1.5 rounded-md bg-[#ff5000] text-white disabled:opacity-40 hover:bg-[#e64800] transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Floating action button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={`fixed bottom-6 right-6 z-50 w-[60px] h-[60px] rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-200 flex items-center justify-center ${
          open
            ? 'bg-slate-700 border-3 border-[#ff5000]'
            : 'border-[3px] border-[#ff5000] bg-white'
        }`}
      >
        {open ? (
          <X size={26} className="text-white" />
        ) : (
          <>
            <img
              src="/cash-avatar.png"
              alt="Cash"
              className="w-full h-full rounded-full object-cover"
            />
            {proactiveBadge && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                1
              </span>
            )}
          </>
        )}
      </button>
    </>
  );
}
