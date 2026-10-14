import React from 'react';
import { Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const OnlineUsers = ({ onCloseMobile }) => {
  const { user: currentUser } = useAuth();
  const { onlineUsers } = useSocket();

  return (
    <aside className="w-64 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Header */}
      <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
            Online Users ({onlineUsers.length})
          </h3>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Online Users List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {onlineUsers.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No users online
          </div>
        ) : (
          onlineUsers.map((u) => {
            const userId = u.id || u._id;
            const isMe = currentUser && (currentUser.id === userId || currentUser._id === userId);

            return (
              <div
                key={userId}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs hover:bg-slate-800/60 transition"
              >
                {/* Avatar with active green dot */}
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
                    {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-slate-900" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200 font-medium truncate">
                      {u.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1 rounded-sm shrink-0">
                        you
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default OnlineUsers;
