import React from 'react';
import { useSocket } from '../context/SocketContext';
import { WifiOff, RefreshCw } from 'lucide-react';

const ReconnectBanner = () => {
  const { isReconnecting, isConnected } = useSocket();

  if (isConnected || !isReconnecting) {
    return null;
  }

  return (
    <div className="bg-amber-600/90 text-white px-4 py-2 text-sm flex items-center justify-center gap-2 shadow-md transition-all animate-pulse z-50">
      <RefreshCw className="w-4 h-4 animate-spin" />
      <span className="font-medium">Connection lost. Reconnecting to ChatRoom real-time server...</span>
    </div>
  );
};

export default ReconnectBanner;
