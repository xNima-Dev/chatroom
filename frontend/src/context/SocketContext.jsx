import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const activeRoomRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setIsReconnecting(false);
        setOnlineUsers([]);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Automatically re-join active room after connection/reconnection
      if (activeRoomRef.current) {
        newSocket.emit('join_room', { roomId: activeRoomRef.current });
      }
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated on the server, you need to reconnect manually
        newSocket.connect();
      } else {
        setIsReconnecting(true);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.warn('Socket connection error:', error.message);
      setIsConnected(false);
      setIsReconnecting(true);
    });

    newSocket.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      if (activeRoomRef.current) {
        newSocket.emit('join_room', { roomId: activeRoomRef.current });
      }
    });

    newSocket.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    // Online presence events
    newSocket.on('online_users', (users) => {
      setOnlineUsers(users || []);
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers((prev) => {
        const exists = prev.some((u) => u.id === data.user.id || u._id === data.user.id);
        if (exists) return prev;
        return [...prev, data.user];
      });
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers((prev) =>
        prev.filter((u) => (u.id || u._id) !== data.userId)
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, token]);

  const joinRoom = (roomId) => {
    if (activeRoomRef.current && activeRoomRef.current !== roomId) {
      if (socket && isConnected) {
        socket.emit('leave_room', { roomId: activeRoomRef.current });
      }
    }
    activeRoomRef.current = roomId;
    if (socket && isConnected) {
      socket.emit('join_room', { roomId });
    }
  };

  const leaveRoom = (roomId) => {
    if (socket && isConnected && roomId) {
      socket.emit('leave_room', { roomId });
    }
    if (activeRoomRef.current === roomId) {
      activeRoomRef.current = null;
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        onlineUsers,
        joinRoom,
        leaveRoom,
        activeRoomId: activeRoomRef.current
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
