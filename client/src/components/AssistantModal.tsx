import React, { useState } from 'react';
import { Bot, Send, X, CornerDownLeft } from 'lucide-react';

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTo: (tab: string, query?: string) => void;
}

export const AssistantModal: React.FC<AssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigateTo,
}) => {
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; data?: any; suggestions?: string[] }>>([
    {
      sender: 'assistant',
      text: "Shop-5 Natural Language Operational Assistant online. Ready to answer analytical queries on work orders, machine queues, bottlenecks, and dispatch priorities.",
      suggestions: [
        'Which jobs for Boeing are at risk this week?',
        'What should machine VMC-42 run next?',
        'Where is WO-100458?',
        'Show active bottlenecks on the floor',
      ],
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (queryToSend: string) => {
    const text = queryToSend.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { sender: 'user', text }]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: data.reply,
          data: data.data,
          suggestions: data.suggestedFollowUps,
        },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Error communicating with assistant API. Ensure server is online.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div 
        className="w-full max-w-2xl h-[560px] bg-[#1B1E23] border border-[#2A2E35] rounded-sm flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border-color)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2A2E35] bg-[#14161A]">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-[#F2A900]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#E7E9EC] uppercase tracking-wider">
                  Shop-5 Natural Language Operational Assistant
                </span>
                <span className="font-mono text-[10px] text-[#3FA37A]">SAFE SQL GATEWAY</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9AA0A8] hover:text-[#E7E9EC]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-sm leading-relaxed border ${
                  msg.sender === 'user'
                    ? 'bg-[#22262C] text-[#E7E9EC] border-[#2A2E35]'
                    : 'bg-[#14161A] text-[#E7E9EC] border-[#2A2E35]'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Structured Data Table */}
                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#2A2E35] overflow-x-auto">
                    <table className="scada-table compact">
                      <thead>
                        <tr>
                          {Object.keys(msg.data[0]).slice(0, 4).map(k => (
                            <th key={k}>{k.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.data.slice(0, 5).map((row: any, rIdx: number) => (
                          <tr key={rIdx}>
                            {Object.values(row).slice(0, 4).map((val: any, cIdx: number) => (
                              <td key={cIdx} className="font-mono">{String(val)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Suggestions */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {msg.suggestions.map((s, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="text-[11px] px-2 py-1 bg-[#14161A] border border-[#2A2E35] rounded-sm text-[#9AA0A8] hover:text-[#F2A900] hover:border-[#F2A900]/40 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="text-[11px] text-[#9AA0A8] font-mono italic">
              Querying Shop-5 digital twin database...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend(inputText);
          }}
          className="p-3 border-t border-[#2A2E35] bg-[#14161A] flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Ask a floor question (e.g. 'Where is WO-100458?')..."
            className="flex-1 bg-[#1B1E23] border border-[#2A2E35] rounded-sm px-3 py-1.5 text-xs text-[#E7E9EC] font-sans focus:outline-none focus:border-[#F2A900]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <span>Ask</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
