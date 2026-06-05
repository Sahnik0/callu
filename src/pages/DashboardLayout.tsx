import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { CallProvider } from "@/context/CallContext";
import { RoomVoiceProvider } from "@/context/RoomVoiceContext";
import { RoomMusicProvider } from "@/context/RoomMusicContext";
import CallManager from "@/components/CallManager";
import PersistentMusicPlayer from "@/components/PersistentMusicPlayer";
import TermsModal from "@/components/TermsModal";
import CustomContextMenu from "@/components/CustomContextMenu";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster, toast } from "sonner";

export default function DashboardLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/");
      } else if (user.status !== "approved") {
        toast.error("Account not approved yet.");
        router.push("/");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return <div className="h-full bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <SocketProvider>
      <CallProvider>
        <RoomVoiceProvider>
        <RoomMusicProvider>
          <div className="flex-1 overflow-hidden bg-black text-white flex w-full min-h-0">
             <DashboardSidebar />
             
             <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden overscroll-contain min-h-0 no-scrollbar">
               <Outlet />
             </main>

             <CallManager />
             <PersistentMusicPlayer />
             <TermsModal />
             <CustomContextMenu />
             <Toaster 
               position="top-center" 
               theme="dark"
               toastOptions={{
                 style: {
                   background: '#18181b',
                   border: '1px solid #27272a',
                   color: '#fff',
                 },
                 className: 'font-dm',
               }}
             />
          </div>
        </RoomMusicProvider>
        </RoomVoiceProvider>
      </CallProvider>
    </SocketProvider>
  );
}
