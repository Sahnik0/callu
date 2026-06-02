"use client";
import { useEffect, useState } from "react";
import { Check, Loader2, Ban, Trash2, Users, Clock, Activity } from "lucide-react";

interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  status: string;
  createdAt: string;
}

export default function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [pendingRes, approvedRes] = await Promise.all([
        fetch("/api/users?status=pending"),
        fetch("/api/users?status=approved")
      ]);
      const pendingData = await pendingRes.json();
      const approvedData = await approvedRes.json();
      setPendingUsers(pendingData.users || []);
      setApprovedUsers(approvedData.users || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await fetch("/api/users/approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved" }),
      });
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke access for this user?')) return;
    try {
      await fetch("/api/users/approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Permanently delete this user? This action cannot be undone.')) return;
    try {
      await fetch("/api/users/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      fetchUsers();
    } catch (error) {
      console.error(error);
    }
  };

  const displayUsers = activeTab === 'pending' ? pendingUsers : approvedUsers;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Admin Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex items-start justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <div className="z-10">
               <p className="text-zinc-500 text-sm font-medium mb-1">Total Members</p>
               <h3 className="text-4xl font-light text-white">{approvedUsers.length}</h3>
            </div>
            <div className="w-12 h-12 bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500 z-10">
               <Users size={24} />
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
         </div>
         
         <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex items-start justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <div className="z-10">
               <p className="text-zinc-500 text-sm font-medium mb-1">Pending Requests</p>
               <h3 className="text-4xl font-light text-white">{pendingUsers.length}</h3>
            </div>
            <div className="w-12 h-12 bg-amber-900/20 rounded-2xl flex items-center justify-center text-amber-500 z-10">
               <Clock size={24} />
            </div>
             <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
         </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex items-start justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors">
            <div className="z-10">
               <p className="text-zinc-500 text-sm font-medium mb-1">System Status</p>
               <h3 className="text-2xl font-light text-white flex items-center gap-2">
                 <span className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                 </span>
                 Operational
               </h3>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-500 z-10">
               <Activity size={24} />
            </div>
             <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
         </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-light">User Management</h2>
        <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === 'pending' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            Pending ({pendingUsers.length})
          </button>
          <button 
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-2 rounded-md text-sm transition-colors cursor-pointer ${activeTab === 'approved' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-white'}`}
          >
            Approved ({approvedUsers.length})
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-zinc-600" /></div>
      ) : displayUsers.length === 0 ? (
        <p className="text-zinc-500">No {activeTab} users.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayUsers.map((user) => (
            <div key={user._id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium text-white">{user.name}</h3>
                <p className="text-sm text-zinc-400 mt-1">{user.email}</p>
                <p className="text-sm text-zinc-500 font-mono mt-1">{user.mobile}</p>
                <p className="text-xs text-zinc-600 mt-4">
                  {activeTab === 'pending' ? 'Applied' : 'Approved'}: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              {activeTab === 'pending' ? (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleApprove(user._id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-zinc-100 text-black hover:bg-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => handleDelete(user._id)}
                    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleRevoke(user._id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-orange-500/20 cursor-pointer"
                  >
                    <Ban size={16} /> Revoke
                  </button>
                  <button
                    onClick={() => handleDelete(user._id)}
                    className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
