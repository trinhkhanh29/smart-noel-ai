"use client";
import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[100px]">
      <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
    </div>
  );
}