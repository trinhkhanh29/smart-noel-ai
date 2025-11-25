"use client";
import { useEffect, useState } from "react";

export default function SnowEffect() {
  const [flakes, setFlakes] = useState<number[]>([]);
  useEffect(() => setFlakes(Array.from({ length: 30 })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {flakes.map((_, i) => (
        <div key={i} className="absolute text-white animate-pulse" style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random()
        }}>❄</div>
      ))}
    </div>
  );
}