import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  onlineUsers: [],
});

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    if (user && user.status === 'approved' && !socketRef.current) {
      const serverUrl = import.meta.env.VITE_API_URL || "https://callu-production.up.railway.app";
      console.log(`[Socket] Connecting to server at ${serverUrl}`);
      const newSocket = io(serverUrl, {
        path: "/socket.io",
        transports: ["websocket"],
      });

      newSocket.on("connect", () => {
        console.log("[Socket] Connected successfully, identifying user...");
        setIsSocketConnected(true);
        newSocket.emit("identify", user._id);
      });

      newSocket.on("connect_error", (error) => {
        console.error("[Socket] Connection error:", error);
      });

      newSocket.on("online-users-list", (users: string[]) => {
        setOnlineUsers(users);
      });

      newSocket.on("user-online", (userId: string) => {
        setOnlineUsers((prev) => Array.from(new Set([...prev, userId])));
      });

      newSocket.on("user-offline", (userId: string) => {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      });

      newSocket.on("disconnect", (reason) => {
        setIsSocketConnected(false);
      });

      socketRef.current = newSocket;

      return () => {
        newSocket.disconnect();
        socketRef.current = null;
      };
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
