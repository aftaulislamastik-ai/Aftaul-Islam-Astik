import React, { useState } from 'react';
import { Mail, RefreshCw, LogOut, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { authService } from '../services/authService';
import { User } from '../types';

interface EmailVerificationProps {
  user: User;
  onCheckVerification: () => Promise<boolean>;
}

export const EmailVerification: React.FC<EmailVerificationProps> = ({ user, onCheckVerification }) => {
  const [resendStatus, setResendStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleResend = async () => {
    setIsLoading(true);
    setCheckMessage(null);
    const result = await authService.resendVerification();
    setResendStatus(result.message);
    setIsLoading(false);
  };

  const handleRefreshCheck = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    
    // Call the parent function to check firebase status
    const isVerified = await onCheckVerification();
    
    if (isVerified) {
      setCheckMessage({ type: 'success', text: 'Verification confirmed! Redirecting...' });
      // The parent component (App.tsx) will handle the redirect by changing the state
    } else {
      setCheckMessage({ type: 'error', text: 'Still pending. Please check your inbox and click the link.' });
    }
    
    setIsChecking(false);
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-cyber-dark relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-cyber-dark/80 to-transparent"></div>

      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 bg-cyber-panel/60 backdrop-blur-xl border border-yellow-500/30 rounded-2xl shadow-[0_0_30px_rgba(234,179,8,0.1)] text-center">
        
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-yellow-500/10 rounded-full border border-yellow-500/50 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-yellow-400" />
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1.5 tracking-widest">VERIFICATION REQUIRED</h1>
        <p className="text-slate-400 text-xs sm:text-sm mb-4">
          Neural link established, but security protocols are pending. 
          A verification signal has been sent to <span className="text-cyan-400">{user.email}</span>.
        </p>

        {/* Status Messages */}
        {resendStatus && (
          <div className="mb-4 p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs rounded">
            {resendStatus}
          </div>
        )}

        {checkMessage && (
          <div className={`mb-4 p-2 border text-xs rounded flex items-center justify-center gap-2 ${
            checkMessage.type === 'success' 
              ? 'bg-green-500/10 border-green-500/30 text-green-300' 
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}>
            {checkMessage.type === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            {checkMessage.text}
          </div>
        )}

        <div className="space-y-2.5">
          <button 
            onClick={handleRefreshCheck}
            disabled={isChecking}
            className={`w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 ${isChecking ? 'opacity-75 cursor-wait' : ''}`}
          >
            <span className="text-sm">{isChecking ? 'SYNCING...' : 'I HAVE VERIFIED'}</span>
            <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
          </button>

          <button 
            onClick={handleResend}
            disabled={isLoading || isChecking}
            className="w-full bg-slate-800/50 hover:bg-slate-700 border border-slate-600 text-slate-300 py-2 rounded-lg transition-all flex items-center justify-center gap-2 text-xs"
          >
            <Mail size={14} />
            {isLoading ? 'TRANSMITTING...' : 'RESEND LINK'}
          </button>

          <div className="pt-3 border-t border-white/10 mt-3">
             <button 
               onClick={() => authService.logout()}
               className="text-[10px] text-red-400 hover:text-red-300 flex items-center justify-center gap-1 w-full"
             >
               <LogOut size={10} /> Abort Connection (Logout)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};