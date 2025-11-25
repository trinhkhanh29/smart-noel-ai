"use client";
import { Users } from "lucide-react";

export default function RealtimeCounter({ count }: { count: number }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-red-600/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-red-500/50 shadow-lg flex items-center gap-3 animate-pulse">
      <Users className="w-6 h-6" />
      <div>
        <span className="text-xs uppercase font-semibold opacity-80 block">Đang có mặt</span>
        <span className="text-2xl font-bold leading-none">{count}</span>
      </div>
    </div>
  );
}