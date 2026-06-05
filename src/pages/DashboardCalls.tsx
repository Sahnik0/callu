"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, User } from "lucide-react";

interface CallLog {
  _id: string;
  type: "incoming" | "outgoing" | "missed";
  caller: {
    name: string;
    avatar?: string;
  };
  receiver: {
    name: string;
    avatar?: string;
  };
  duration?: number;
  timestamp: string;
  status: "completed" | "missed" | "rejected";
}

const CALLS_PER_PAGE = 7;

export default function CallsPage() {
  const { user } = useAuth();
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Fetch call logs from API
    const fetchCallLogs = async () => {
      try {
        const res = await fetch(`/api/calls/logs?userId=${user?._id}`);
        const data = await res.json();
        setCallLogs(data.logs || []);
      } catch (err) {
        console.error("Failed to fetch call logs:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchCallLogs();
  }, [user]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const totalPages = Math.ceil(callLogs.length / CALLS_PER_PAGE);
  const paginatedLogs = callLogs.slice(
    (currentPage - 1) * CALLS_PER_PAGE,
    currentPage * CALLS_PER_PAGE
  );

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-light tracking-tight text-white">Call History</h2>
        <p className="text-zinc-500 mt-2">
          {callLogs.length > 0 
            ? `${callLogs.length} call${callLogs.length !== 1 ? 's' : ''} on record` 
            : 'No call history yet'}
        </p>
      </header>

      {/* Call Logs List */}
      {!loading && callLogs.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center min-h-[500px] w-full bg-zinc-900/40 border border-zinc-800 rounded-3xl backdrop-blur-sm p-12">
          <div className="w-24 h-24 mb-6 bg-zinc-900/50 rounded-full flex items-center justify-center border border-zinc-800">
            <Phone className="w-12 h-12 text-zinc-600" />
          </div>
          <div className="text-center space-y-3 max-w-md">
            <h3 className="text-3xl font-light text-white tracking-tight">No Calls Yet</h3>
            <p className="text-zinc-500 leading-relaxed font-light">
              Your call history will appear here once you start connecting with community members.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {paginatedLogs.map((log) => {
            const isOutgoing = log.type === "outgoing";
            const isMissed = log.status === "missed";
            const otherPerson = isOutgoing ? log.receiver : log.caller;

            return (
              <div
                key={log._id}
                className="group bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-4 backdrop-blur-sm hover:border-zinc-700/80 hover:bg-zinc-800/60 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center border border-zinc-700">
                      {otherPerson.avatar ? (
                        <img
                          src={otherPerson.avatar}
                          alt={otherPerson.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-zinc-500" />
                      )}
                    </div>

                    {/* Call Info */}
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`text-base font-medium ${isMissed ? 'text-red-400' : 'text-white'}`}>
                          {otherPerson.name}
                        </span>
                        {isOutgoing ? (
                          <PhoneOutgoing className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <PhoneIncoming className={`w-4 h-4 ${isMissed ? 'text-red-500' : 'text-blue-500'}`} />
                        )}
                      </div>
                      <span className="text-sm text-zinc-500">
                        {log.status === "completed" && log.duration
                          ? formatDuration(log.duration)
                          : log.status === "missed"
                          ? "Missed call"
                          : "Call ended"}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">{formatTimestamp(log.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-9 h-9 text-sm font-medium rounded-xl transition-all cursor-pointer ${
                page === currentPage
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                  : "bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
