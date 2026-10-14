import React, { useState, useEffect, useRef } from 'react';
import {
  Hash,
  Users,
  Send,
  Loader2,
  AlertCircle,
  Menu,
  RotateCcw,
  CheckCheck,
  Clock,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { roomAPI } from '../services/api';
import TypingIndicator from './TypingIndicator';

const ChatArea = ({
  room,
  onJoinRoom,
  onToggleRoomsMobile,
  onToggleUsersMobile
}) => {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [rateLimitError, setRateLimitError] = useState('');

  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const previousScrollHeightRef = useRef(0);

  const roomId = room?._id || room?.id;
  const isMember = room?.isMember;

  // 1. Load initial messages when room changes
  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      return;
    }

    if (!isMember) {
      setMessages([]);
      setHasMore(false);
      setNextCursor(null);
      return;
    }

    let isSubscribed = true;

    const fetchMessages = async () => {
      setLoadingMessages(true);
      setRateLimitError('');
      try {
        const res = await roomAPI.getMessages(roomId, 30);
        if (isSubscribed && res.data.success) {
          // Backend returns newest first. Reverse for chronological chat display
          const chronological = [...res.data.messages].reverse();
          setMessages(chronological);
          setHasMore(res.data.hasMore);
          setNextCursor(res.data.nextCursor);
        }
      } catch (err) {
        console.error('Error fetching room messages:', err);
      } finally {
        if (isSubscribed) setLoadingMessages(false);
      }
    };

    fetchMessages();

    return () => {
      isSubscribed = false;
      setTypingUsers([]);
    };
  }, [roomId, isMember]);

  // 2. Socket event listeners for real-time messages & typing
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleReceiveMessage = (newMessage) => {
      const msgRoomId = newMessage.room?._id || newMessage.room;
      if (msgRoomId === roomId) {
        setMessages((prev) => {
          // Check if this message was optimistically added by sender
          const existingIndex = prev.findIndex(
            (m) =>
              m._id === newMessage._id ||
              (m.tempId && m.sender?._id === newMessage.sender?._id && m.text === newMessage.text)
          );

          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = { ...newMessage, status: 'delivered' };
            return updated;
          }
          return [...prev, { ...newMessage, status: 'delivered' }];
        });

        // Clear typing indicator for this user if they sent a message
        const senderId = newMessage.sender?._id || newMessage.sender?.id || newMessage.sender;
        setTypingUsers((prev) => prev.filter((u) => u.id !== senderId));
      }
    };

    const handleUserTyping = (data) => {
      if (data.roomId === roomId && data.user.id !== user?.id && data.user.id !== user?._id) {
        setTypingUsers((prev) => {
          if (prev.some((u) => u.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    };

    const handleUserStopTyping = (data) => {
      if (data.roomId === roomId) {
        setTypingUsers((prev) => prev.filter((u) => u.id !== data.user.id));
      }
    };

    const handleErrorMessage = (data) => {
      if (data.message && data.message.includes('Rate limit')) {
        setRateLimitError(data.message);
        setTimeout(() => setRateLimitError(''), 4000);
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('error_message', handleErrorMessage);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('error_message', handleErrorMessage);
    };
  }, [socket, roomId, user]);

  // 3. Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!previousScrollHeightRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // 4. Load older messages (cursor pagination)
  const handleLoadOlder = async () => {
    if (!hasMore || !nextCursor || loadingOlder) return;

    if (scrollContainerRef.current) {
      previousScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    }

    setLoadingOlder(true);
    try {
      const res = await roomAPI.getMessages(roomId, 30, nextCursor);
      if (res.data.success) {
        const olderChronological = [...res.data.messages].reverse();
        setMessages((prev) => [...olderChronological, ...prev]);
        setHasMore(res.data.hasMore);
        setNextCursor(res.data.nextCursor);

        // Adjust scroll position so reading view doesn't jump
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            scrollContainerRef.current.scrollTop +=
              newScrollHeight - previousScrollHeightRef.current;
            previousScrollHeightRef.current = 0;
          }
        });
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 5. Typing debounce handler
  const handleInputChange = (e) => {
    setInputText(e.target.value);

    if (!socket || !isConnected || !roomId) return;

    socket.emit('typing', { roomId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { roomId });
    }, 1500);
  };

  // 6. Optimistic message sending with retry logic
  const sendMessageAttempt = (textToSend, tempIdToRetry = null) => {
    const trimmed = textToSend.trim();
    if (!trimmed || !roomId) return;

    const tempId = tempIdToRetry || `temp-${Date.now()}-${Math.random()}`;

    // Add optimistic message or update existing
    if (!tempIdToRetry) {
      const optimisticMsg = {
        _id: tempId,
        tempId,
        text: trimmed,
        room: roomId,
        sender: {
          _id: user?.id || user?._id,
          id: user?.id || user?._id,
          name: user?.name,
          email: user?.email
        },
        createdAt: new Date().toISOString(),
        status: 'sending'
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setInputText('');
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: 'sending' } : m))
      );
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket?.emit('stop_typing', { roomId });
    }

    // Safety timeout: if server doesn't respond in 6s, mark failed
    const ackTimeout = setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId && m.status === 'sending' ? { ...m, status: 'failed' } : m))
      );
    }, 6000);

    // Emit through socket with callback acknowledgement
    if (socket && isConnected) {
      socket.emit(
        'send_message',
        { roomId, text: trimmed },
        (response) => {
          clearTimeout(ackTimeout);
          if (response && response.success && response.message) {
            setMessages((prev) =>
              prev.map((m) =>
                m.tempId === tempId
                  ? { ...response.message, status: 'delivered' }
                  : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m))
            );
          }
        }
      );
    } else {
      clearTimeout(ackTimeout);
      setMessages((prev) =>
        prev.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    sendMessageAttempt(inputText);
  };

  // If no room is selected
  if (!room) {
    return (
      <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Welcome to ChatRoom</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">
          Choose a channel from the left sidebar or create a new one to start real-time messaging with your team.
        </p>
        <button
          onClick={onToggleRoomsMobile}
          className="md:hidden px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium flex items-center gap-2"
        >
          <Menu className="w-4 h-4" />
          <span>Browse Channels</span>
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 bg-slate-950 flex flex-col h-full min-w-0 overflow-hidden relative">
      {/* Rate limit warning banner */}
      {rateLimitError && (
        <div className="absolute top-16 left-0 right-0 z-20 bg-red-600/90 text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2 shadow-lg animate-bounce">
          <AlertCircle className="w-4 h-4" />
          <span>{rateLimitError}</span>
        </div>
      )}

      {/* Room Header */}
      <header className="h-16 px-4 md:px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-xs shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleRoomsMobile}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Channels"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-5 h-5 text-indigo-400 shrink-0" />
            <h2 className="text-base font-bold text-white truncate">{room.name}</h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline-block">
            • {room.membersCount || room.members?.length || 1} members
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isMember && (
            <button
              onClick={() => onJoinRoom(roomId)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-sm transition"
            >
              Join Channel
            </button>
          )}

          <button
            onClick={onToggleUsersMobile}
            className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Online Users"
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Message Feed Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
      >
        {/* If user is NOT a member */}
        {!isMember ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
              <Hash className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              You are viewing #{room.name}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mb-4">
              To read messages, load conversation history, and participate in this room, you need to join.
            </p>
            <button
              onClick={() => onJoinRoom(roomId)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-md shadow-indigo-600/30 transition"
            >
              Join #{room.name}
            </button>
          </div>
        ) : loadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-xs">Loading channel history...</span>
          </div>
        ) : (
          <>
            {/* Load older messages button (Cursor Pagination) */}
            {hasMore && (
              <div className="flex justify-center py-2">
                <button
                  onClick={handleLoadOlder}
                  disabled={loadingOlder}
                  className="px-4 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700/60 shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loadingOlder ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  <span>{loadingOlder ? 'Loading...' : 'Load older messages'}</span>
                </button>
              </div>
            )}

            {/* Empty room state */}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-2">
                  <Hash className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">Welcome to #{room.name}!</p>
                <p className="text-xs text-slate-500 mt-1">
                  This is the start of the #{room.name} channel. Be the first to send a message.
                </p>
              </div>
            )}

            {/* Message Bubble List */}
            {messages.map((msg, index) => {
              const senderId = msg.sender?._id || msg.sender?.id || msg.sender;
              const isMe = user && (user.id === senderId || user._id === senderId);
              const senderName = msg.sender?.name || (isMe ? user?.name : 'User');
              const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg._id || msg.tempId || index}
                  className={`flex items-start gap-3 group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                      isMe
                        ? 'bg-indigo-600 shadow-xs'
                        : 'bg-slate-700'
                    }`}
                  >
                    {senderName.charAt(0).toUpperCase()}
                  </div>

                  {/* Message Content */}
                  <div className={`flex flex-col max-w-[75%] md:max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {isMe ? 'You' : senderName}
                      </span>
                      <span className="text-[10px] text-slate-500">{formattedTime}</span>
                    </div>

                    <div
                      className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm break-words shadow-sm leading-relaxed ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-xs'
                          : 'bg-slate-800 text-slate-100 rounded-tl-xs border border-slate-700/40'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Optimistic Status & Retry */}
                    {isMe && (
                      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px]">
                        {msg.status === 'sending' && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            <span>sending...</span>
                          </span>
                        )}
                        {msg.status === 'failed' && (
                          <div className="flex items-center gap-1 text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            <span>Failed</span>
                            <button
                              onClick={() => sendMessageAttempt(msg.text, msg.tempId)}
                              className="underline ml-1 hover:text-white flex items-center gap-0.5 cursor-pointer font-medium"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Retry</span>
                            </button>
                          </div>
                        )}
                        {msg.status === 'delivered' && (
                          <CheckCheck className="w-3.5 h-3.5 text-indigo-400" title="Delivered" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing Indicator */}
      <TypingIndicator typingUsers={typingUsers} />

      {/* Message Input Form */}
      {isMember && (
        <form
          onSubmit={handleSendMessage}
          className="p-3 md:p-4 bg-slate-900/80 border-t border-slate-800 shrink-0"
        >
          <div className="relative flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder={`Message #${room.name}...`}
              maxLength={1000}
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-hidden pr-10"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-indigo-600/30"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex justify-between items-center px-2 mt-1.5 text-[10px] text-slate-500">
            <span>Press Enter to send</span>
            {inputText.length > 800 && (
              <span className={inputText.length >= 1000 ? 'text-red-400' : 'text-amber-400'}>
                {inputText.length}/1000
              </span>
            )}
          </div>
        </form>
      )}
    </main>
  );
};

export default ChatArea;
