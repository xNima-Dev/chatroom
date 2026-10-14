import React, { useState } from 'react';
import { Plus, Hash, Users, LogOut, Search, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const RoomList = ({
  rooms,
  activeRoom,
  onSelectRoom,
  onJoinRoom,
  onOpenCreateModal,
  onCloseMobile
}) => {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');

  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
            CR
          </div>
          <span className="font-bold text-base text-white tracking-tight">ChatRoom</span>
        </div>
        <button
          onClick={onOpenCreateModal}
          className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
          title="Create New Room"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Room Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Rooms Section */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Rooms ({rooms.length})</span>
        </div>

        {filteredRooms.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-500 text-xs">
            {search ? 'No rooms match your search' : 'No rooms created yet. Click "+" to create one!'}
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = activeRoom && (activeRoom._id === room._id || activeRoom.id === room.id);
            const isMember = room.isMember;

            return (
              <div
                key={room._id || room.id}
                onClick={() => {
                  onSelectRoom(room);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Hash
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'
                    }`}
                  />
                  <span className="truncate">{room.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <div className="flex items-center gap-1 text-[11px] opacity-70">
                    <Users className="w-3 h-3" />
                    <span>{room.membersCount || room.members?.length || 1}</span>
                  </div>

                  {!isMember && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onJoinRoom(room._id || room.id);
                      }}
                      className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500 hover:text-white transition text-[10px] flex items-center gap-0.5"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {isMember && (
                    <span
                      title="Member"
                      className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-300' : 'bg-emerald-500'}`}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User profile & Logout footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
          title="Log out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

export default RoomList;
