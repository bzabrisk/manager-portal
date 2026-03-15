import { useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'cash',
  text: "Hey! I'm Cash, your SMASH assistant. I can help you look up fundraiser info, check on tasks, and answer questions about your data. What can I help you with?",
};

const QUICK_ACTIONS = ['Show overdue tasks', 'Fundraiser summary', "Today's payouts"];

const FIRST_REPLY =
  "I'm still getting set up! My AI brain will be connected soon. For now, Tahni is working on teaching me everything about SMASH. Check back soon! 🦍";
const REPEAT_REPLY =
  "I heard you! But I can't process that just yet. Soon though!";

export default function CashChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [hasReplied, setHasReplied] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg = { id: Date.now(), role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const replyText = !hasReplied ? FIRST_REPLY : REPEAT_REPLY;
      setHasReplied(true);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'cash', text: replyText },
      ]);
    }, 1000);
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
                {msg.text}
              </div>
            </div>
          ))}

          {/* Quick action chips — show only when just the welcome message exists */}
          {messages.length === 1 && messages[0].id === 'welcome' && (
            <div className="flex flex-wrap gap-2 pl-9">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => setInput(action)}
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
              placeholder="Ask Cash anything..."
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
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
          <img
            src="/cash-avatar.png"
            alt="Cash"
            className="w-full h-full rounded-full object-cover"
          />
        )}
      </button>
    </>
  );
}
