import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, User } from '../../types';
import { Send, Users } from 'lucide-react';

interface MessagesTabProps {
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (text: string) => void;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ messages, currentUser, onSendMessage }) => {
  const [inputText, setInputText] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-black">
      {/* Top Title Bar */}
      <div className="px-4 py-2.5 border-b border-zinc-800/80 shrink-0 bg-zinc-950 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white">Team Comms & Dispatch Radio</h2>
            <p className="text-[10px] text-zinc-400">Internal technician channel</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full border border-lime-500/20">
          Encrypted
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.isCurrentUser;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && msg.avatar && (
                  <img src={msg.avatar} alt={msg.senderName} className="w-7 h-7 rounded-full object-cover shrink-0 mt-auto border border-zinc-700" />
                )}
                {!isMe && !msg.avatar && (
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 mt-auto border border-zinc-700">
                    <span className="text-[10px] text-white font-bold">{msg.senderName?.charAt(0) || 'U'}</span>
                  </div>
                )}
                <div className={`space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isMe && <span className="text-[10px] text-zinc-400 px-1 font-semibold">{msg.senderName}</span>}
                  <div className={`px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isMe 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md' 
                      : 'bg-zinc-900 text-zinc-200 border border-zinc-800 rounded-bl-none'
                  }`}>
                    {msg.text || msg.content}
                  </div>
                  <span className="text-[9px] text-zinc-500 px-1 font-mono">{msg.timestamp}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endOfMessagesRef} />
      </div>

      {/* Chat Composer Input */}
      <div className="p-2 sm:p-3 border-t border-zinc-900 bg-black/90 backdrop-blur-md shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Radio message to the operations team..."
            className="flex-1 px-3.5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-500 transition-colors shrink-0 cursor-pointer"
            aria-label="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
