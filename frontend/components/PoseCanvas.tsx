"use client";
import { useEffect, useRef } from "react";

export default function PoseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Vẽ giả lập radar quét
    let angle = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "rgba(0, 255, 0, 0.2)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height/2 + Math.sin(angle) * 50);
      ctx.lineTo(canvas.width, canvas.height/2 + Math.sin(angle) * 50);
      ctx.stroke();
      angle += 0.05;
      requestAnimationFrame(render);
    };
    render();
  }, []);

  return <canvas ref={canvasRef} width={640} height={480} className="w-full h-full bg-black/50 rounded-2xl border border-green-500/30" />;
}