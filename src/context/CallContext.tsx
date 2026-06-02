"use client";
import React, { createContext, useContext, useState } from "react";
import { toast } from "sonner";

interface CallContextType {
  callUser: (userId: string, userName: string, userAvatar?: string, callType?: "voice" | "video") => void;
  // State meant to be consumed by CallManager
  outgoingCallData: { userId: string; userName: string; userAvatar?: string; callType: "voice" | "video" } | null;
  setOutgoingCallData: (data: { userId: string; userName: string; userAvatar?: string; callType: "voice" | "video" } | null) => void;
  isInCall: boolean;
  setIsInCall: (value: boolean) => void;
  // Room state
  isInRoom: boolean;
  setIsInRoom: (value: boolean) => void;
  currentRoomId: string | null;
  setCurrentRoomId: (id: string | null) => void;
  currentRoomName: string | null;
  setCurrentRoomName: (name: string | null) => void;
}

const CallContext = createContext<CallContextType>({
  callUser: () => {},
  outgoingCallData: null,
  setOutgoingCallData: () => {},
  isInCall: false,
  setIsInCall: () => {},
  isInRoom: false,
  setIsInRoom: () => {},
  currentRoomId: null,
  setCurrentRoomId: () => {},
  currentRoomName: null,
  setCurrentRoomName: () => {},
});

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const [outgoingCallData, setOutgoingCallData] = useState<{ userId: string; userName: string; userAvatar?: string; callType: "voice" | "video" } | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomName, setCurrentRoomName] = useState<string | null>(null);

  const callUser = (userId: string, userName: string, userAvatar?: string, callType: "voice" | "video" = "voice") => {
    if (isInCall) {
      toast.error("You are already in a call. Please end the current call first.");
      return;
    }
    setOutgoingCallData({ userId, userName, userAvatar, callType });
    setIsInCall(true);
  };

  return (
    <CallContext.Provider value={{ callUser, outgoingCallData, setOutgoingCallData, isInCall, setIsInCall, isInRoom, setIsInRoom, currentRoomId, setCurrentRoomId, currentRoomName, setCurrentRoomName }}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => useContext(CallContext);
