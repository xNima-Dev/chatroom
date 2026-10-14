import React, { useState, useEffect } from 'react';
import { roomAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import RoomList from '../components/RoomList';
import ChatArea from '../components/ChatArea';
import OnlineUsers from '../components/OnlineUsers';
import CreateRoomModal from '../components/CreateRoomModal';
import ReconnectBanner from '../components/ReconnectBanner';

const ChatPage = () => {
  const { joinRoom: socketJoinRoom } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Mobile drawer states
  const [showRoomsMobile, setShowRoomsMobile] = useState(false);
  const [showUsersMobile, setShowUsersMobile] = useState(false);

  // Fetch all rooms on initial mount
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await roomAPI.getRooms();
        if (res.data.success) {
          setRooms(res.data.rooms);
          // Auto-select first room user is member of, or first room in list
          if (res.data.rooms.length > 0 && !activeRoom) {
            const defaultRoom =
              res.data.rooms.find((r) => r.isMember) || res.data.rooms[0];
            setActiveRoom(defaultRoom);
            if (defaultRoom.isMember) {
              socketJoinRoom(defaultRoom._id || defaultRoom.id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load rooms:', err);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, []);

  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    if (room.isMember) {
      socketJoinRoom(room._id || room.id);
    }
  };

  const handleJoinRoom = async (roomId) => {
    try {
      const res = await roomAPI.joinRoom(roomId);
      if (res.data.success && res.data.room) {
        const updatedRoom = res.data.room;

        // Update rooms state
        setRooms((prev) =>
          prev.map((r) =>
            (r._id === roomId || r.id === roomId)
              ? { ...r, isMember: true, membersCount: updatedRoom.membersCount }
              : r
          )
        );

        setActiveRoom((prev) =>
          prev && (prev._id === roomId || prev.id === roomId)
            ? { ...prev, isMember: true, membersCount: updatedRoom.membersCount }
            : prev
        );

        // Join socket room
        socketJoinRoom(roomId);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
    }
  };

  const handleRoomCreated = (newRoom) => {
    setRooms((prev) => [newRoom, ...prev]);
    setActiveRoom(newRoom);
    socketJoinRoom(newRoom._id || newRoom.id);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      {/* Reconnection banner at the very top */}
      <ReconnectBanner />

      <div className="flex flex-1 h-full overflow-hidden relative">
        {/* Left Sidebar: Room List */}
        <div
          className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
            showRoomsMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <RoomList
            rooms={rooms}
            activeRoom={activeRoom}
            onSelectRoom={handleSelectRoom}
            onJoinRoom={handleJoinRoom}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onCloseMobile={() => setShowRoomsMobile(false)}
          />
        </div>

        {/* Backdrop for mobile room drawer */}
        {showRoomsMobile && (
          <div
            onClick={() => setShowRoomsMobile(false)}
            className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
          />
        )}

        {/* Center: Main Chat Area */}
        <ChatArea
          room={activeRoom}
          onJoinRoom={handleJoinRoom}
          onToggleRoomsMobile={() => setShowRoomsMobile((prev) => !prev)}
          onToggleUsersMobile={() => setShowUsersMobile((prev) => !prev)}
        />

        {/* Right Sidebar: Online Users */}
        <div
          className={`fixed inset-y-0 right-0 z-40 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
            showUsersMobile ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <OnlineUsers onCloseMobile={() => setShowUsersMobile(false)} />
        </div>

        {/* Backdrop for mobile users drawer */}
        {showUsersMobile && (
          <div
            onClick={() => setShowUsersMobile(false)}
            className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-xs"
          />
        )}
      </div>

      {/* Create Room Modal Dialog */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </div>
  );
};

export default ChatPage;
