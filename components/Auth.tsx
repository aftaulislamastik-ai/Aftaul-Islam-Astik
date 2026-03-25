import React, { useState } from 'react';
import { Eye, EyeOff, Radio, Zap, Mail, User, Lock, ArrowLeft, Chrome } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';

interface AuthProps {
  onLogin: (user: UserType) => void;
}

type AuthView = 'login' | 'signup' | 'forgot';

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [view, setView] = useState<AuthView>('login');
  const [showPassword, setShowPassword] = useState(false);
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Feedback State
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clearForm = () => {
    setError('');
    setSuccess('');
    setUsername('');
    setEmail('');
    setPassword('');
  };

  const handleSwitchView = (newView: AuthView) => {
    clearForm();
    setView(newView);
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const result = await authService.loginWithGoogle();
      if (!result.success) {
        setError(result.message);
      }
      // Success handled by onAuthStateChanged in App.tsx
    } catch (e) {
      setError('Google Link Failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (view === 'login') {
        if (!email || !password) {
          setError('Email and Password required.');
          setIsLoading(false);
          return;
        }
        // Note: Firebase login uses Email, not Username
        const result = await authService.login(email, password);
        if (!result.success) {
          setError(result.message);
        }
      } 
      else if (view === 'signup') {
        if (!username || !email || !password) {
          setError('All fields required for initialization.');
          setIsLoading(false);
          return;
        }
        const result = await authService.register(username, email, password);
        if (result.success && result.user) {
          setSuccess(result.message);
        } else {
          setError(result.message);
        }
      }
      else if (view === 'forgot') {
        if (!email) {
          setError('Target email required.');
          setIsLoading(false);
          return;
        }
        const result = await authService.resetPassword(email);
        if (result.success) {
          setSuccess(result.message);
          setTimeout(() => handleSwitchView('login'), 3000);
        } else {
          setError(result.message);
        }
      }
    } catch (e) {
      setError('System Failure.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop')] bg-cover bg-center relative overflow-y-auto py-6">
      <div className="absolute inset-0 bg-cyber-dark/80 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md p-5 sm:p-8 bg-cyber-panel/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-cyber-accent/20">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-4">
          <div className="p-3 bg-cyber-accent/20 rounded-full mb-3 border border-cyber-accent/50 animate-glow">
            <Radio className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-500">
            COMMUNE
          </h1>
          <p className="text-slate-400 text-[10px] sm:text-xs tracking-wide mt-1 uppercase">
            {view === 'login' && 'Identify Yourself'}
            {view === 'signup' && 'New Neural Link'}
            {view === 'forgot' && 'Recover Access'}
          </p>
        </div>

        {/* Form Container */}
        <div className="space-y-4">
          
          {/* Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-200 text-[10px] p-2 rounded text-center animate-shake">
              CRITICAL: {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/50 text-green-200 text-[10px] p-2 rounded text-center animate-pulse">
              SUCCESS: {success}
            </div>
          )}

          {/* Username Field (Signup Only) */}
          {view === 'signup' && (
            <div className="relative group">
               <User className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 w-4 h-4 transition-colors" />
               <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder-slate-600"
                placeholder="Choose Alias"
              />
            </div>
          )}

          {/* Email Field (All Views) */}
          <div className="relative group">
             <Mail className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 w-4 h-4 transition-colors" />
             <input 
               type="email" 
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder-slate-600"
               placeholder={view === 'login' ? "Email Address" : "Neural Mail Address"}
             />
          </div>
          
          {/* Password Field */}
          {(view === 'login' || view === 'signup') && (
            <div>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-cyan-400 w-4 h-4 transition-colors" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-9 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all placeholder-slate-600"
                  placeholder={view === 'signup' ? "Create Passcode" : "Passcode"}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {view === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <button 
                    onClick={() => handleSwitchView('forgot')}
                    className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Main Action Button */}
          <button 
            onClick={handleSubmit}
            disabled={isLoading}
            className={`group w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-bold py-2.5 rounded-lg shadow-lg shadow-violet-900/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {isLoading ? (
               <span className="animate-pulse text-sm">PROCESSING...</span>
            ) : (
               <>
                 <span className="text-sm">
                    {view === 'login' && 'INITIALIZE LINK'}
                    {view === 'signup' && 'CREATE IDENTITY'}
                    {view === 'forgot' && 'SEND RECOVERY'}
                 </span>
                 <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
               </>
            )}
          </button>

          {/* Google Sign In (Login/Signup only) */}
          {(view === 'login' || view === 'signup') && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-700"></div>
                <span className="flex-shrink mx-3 text-slate-500 text-[10px]">OR CONNECT VIA</span>
                <div className="flex-grow border-t border-slate-700"></div>
              </div>

              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2 rounded-lg transition-all flex items-center justify-center gap-2.5 group"
              >
                 <Chrome size={16} className="text-white group-hover:text-cyan-400 transition-colors" />
                 <span className="text-sm">Google Neural Link</span>
              </button>
            </>
          )}

          {/* Navigation Links */}
          <div className="text-center pt-1.5 border-t border-white/5 mt-2">
            {view === 'login' && (
              <button 
                onClick={() => handleSwitchView('signup')}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                No Identity? <span className="text-cyan-400">Sign Up</span>
              </button>
            )}
            {(view === 'signup' || view === 'forgot') && (
              <button 
                onClick={() => handleSwitchView('login')}
                className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2 w-full"
              >
                <ArrowLeft size={12} /> Back to Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
