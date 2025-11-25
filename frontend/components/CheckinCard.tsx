"use client";
import { motion, AnimatePresence } from "framer-motion";

export interface UserCheckin {
  id: string;
  name: string;
  avatarUrl?: string;
  noelAvatar?: string;
  checkinTime: string;
}

export default function CheckinCard({ user }: { user: UserCheckin }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, scale: 0.5 }}
        className="flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl mb-4"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-green-500 bg-gray-800">
             <div className="w-full h-full flex items-center justify-center text-2xl">{user.noelAvatar || "👤"}</div>
          </div>
        </div>
        <div>
          <h3 className="text-white font-bold text-lg">{user.name}</h3>
          <p className="text-green-300 text-sm">{user.checkinTime}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}