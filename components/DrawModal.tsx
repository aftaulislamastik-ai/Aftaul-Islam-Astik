import React, { useRef, useState, useEffect } from 'react';
import { X, Check, Trash2 } from 'lucide-react';

interface DrawModalProps {
  onClose: () => void;
  onSave: (data: string) => void;
}

export const DrawModal: React.FC<DrawModalProps> = ({ onClose, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#06b6d4');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.fillStyle = '#0f172a';
         ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSave = () => {
    if (canvasRef.current) {
        onSave(canvasRef.current.toDataURL());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-cyber-panel border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
        <div className="p-3 bg-slate-900 border-b border-white/5 flex justify-between items-center">
           <h3 className="text-white font-bold">Digital Canvas</h3>
           <button onClick={onClose} className="text-slate-400 hover:text-white"><X /></button>
        </div>
        
        <div className="flex-1 relative bg-slate-900 cursor-crosshair">
           <canvas 
             ref={canvasRef}
             className="w-full h-full touch-none"
             onMouseDown={startDrawing}
             onMouseMove={draw}
             onMouseUp={stopDrawing}
             onMouseLeave={stopDrawing}
             onTouchStart={startDrawing}
             onTouchMove={draw}
             onTouchEnd={stopDrawing}
           />
        </div>

        <div className="p-4 bg-slate-900 border-t border-white/5 flex items-center justify-between gap-4">
            <div className="flex gap-2">
                {['#06b6d4', '#8b5cf6', '#ef4444', '#22c55e', '#ffffff'].map(c => (
                    <button 
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                      style={{backgroundColor: c}}
                    />
                ))}
            </div>
            
            <div className="flex gap-2">
                <button onClick={clearCanvas} className="p-2 bg-slate-800 rounded text-slate-300 hover:bg-slate-700">
                    <Trash2 size={18} />
                </button>
                <button onClick={handleSave} className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-600 rounded text-white font-bold hover:shadow-lg">
                    Send Art
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
