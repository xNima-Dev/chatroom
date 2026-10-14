import React from 'react';

const TypingIndicator = ({ typingUsers = [] }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  let label = '';
  if (typingUsers.length === 1) {
    label = `${typingUsers[0].name} is typing`;
  } else if (typingUsers.length === 2) {
    label = `${typingUsers[0].name} and ${typingUsers[1].name} are typing`;
  } else {
    label = `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing`;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-slate-400 bg-slate-800/40 border-t border-slate-800/80">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{label}...</span>
    </div>
  );
};

export default TypingIndicator;
