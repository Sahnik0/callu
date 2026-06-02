import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user || user.role !== "admin") {
        router.push("/");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className="flex h-full items-center justify-center text-zinc-500">Loading...</div>;

  if (!user || user.role !== "admin") return null;

  return (
    <div className="h-full bg-black text-zinc-100 p-8 overflow-y-auto">
      <nav className="mb-8 flex justify-between items-center border-b border-zinc-800 pb-4">
        <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
        <div className="flex gap-4">
             <span className="text-sm text-zinc-500 self-center">Welcome, Admin</span>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
