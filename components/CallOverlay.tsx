import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, User as UserIcon, Volume2, VolumeX } from 'lucide-react';
import { Call, User } from '../types';
import { dbService } from '../services/dbService';
import { motion, AnimatePresence } from 'motion/react';

interface CallOverlayProps {
  call: Call;
  currentUser: User;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  currentUser,
  onAccept,
  onReject,
  onEnd,
  remoteStream,
  localStream
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isLoudspeaker, setIsLoudspeaker] = useState(false);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement>(null);
  const outgoingToneRef = useRef<HTMLAudioElement>(null);

  const isCaller = call.callerId === currentUser.id;
  const otherUserId = isCaller ? call.receiverId : call.callerId;

  useEffect(() => {
    const fetchOtherUser = async () => {
      const user = await dbService.getUserById(otherUserId);
      setOtherUser(user);
    };
    fetchOtherUser();
  }, [otherUserId]);

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle Ringtones
  useEffect(() => {
    if (call.status === 'ringing') {
      if (isCaller) {
        outgoingToneRef.current?.play().catch(e => console.log("Audio play blocked", e));
      } else {
        ringtoneRef.current?.play().catch(e => console.log("Audio play blocked", e));
      }
    } else {
      ringtoneRef.current?.pause();
      outgoingToneRef.current?.pause();
    }

    return () => {
      ringtoneRef.current?.pause();
      outgoingToneRef.current?.pause();
    };
  }, [call.status, isCaller]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleLoudspeaker = () => {
    // In web browsers, we can't easily switch hardware output, 
    // but we can simulate it by increasing volume or using setSinkId if available.
    // For now, we'll just toggle the state and show UI feedback.
    setIsLoudspeaker(!isLoudspeaker);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isLoudspeaker ? 0.5 : 1.0;
    }
  };

  const getStatusText = () => {
    if (call.status === 'ringing') {
      return isCaller ? 'Calling...' : 'Incoming Call...';
    }
    if (call.status === 'accepted') {
      return remoteStream ? 'Connected' : 'Connecting...';
    }
    return call.status.charAt(0).toUpperCase() + call.status.slice(1);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-cyber-dark/95 backdrop-blur-xl p-4"
      >
        <div className="w-full max-w-md bg-cyber-panel border border-cyber-accent/30 rounded-[2.5rem] p-10 flex flex-col items-center shadow-2xl shadow-cyber-accent/20">
          
          {/* User Info */}
          <div className="mb-10 text-center">
            <div className="w-28 h-28 rounded-full bg-cyber-panel border-2 border-cyber-accent flex items-center justify-center mb-6 mx-auto relative">
              <div className="absolute inset-0 rounded-full animate-ping bg-cyber-accent/20" />
              <div className="w-full h-full rounded-full overflow-hidden z-10 border-2 border-cyber-accent/50">
                {otherUser?.avatar ? (
                  <img src={otherUser.avatar} alt={otherUser.name} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-14 h-14 text-cyber-accent" />
                )}
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{otherUser?.name || 'Operative'}</h2>
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${call.status === 'ringing' ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
              <p className="text-cyber-accent font-mono text-sm uppercase tracking-widest">
                {getStatusText()}
              </p>
            </div>
          </div>

          {/* Audio Elements */}
          <audio ref={remoteAudioRef} autoPlay />
          <audio ref={ringtoneRef} loop src="https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3" />
          <audio ref={outgoingToneRef} loop src="https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3" />

          {/* Controls */}
          <div className="flex flex-col items-center gap-8 w-full">
            <div className="flex items-center justify-center gap-6">
              {call.status === 'ringing' && !isCaller ? (
                <>
                  <button
                    onClick={onReject}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all hover:scale-110 shadow-xl shadow-red-500/30 group"
                  >
                    <PhoneOff className="w-10 h-10 group-hover:rotate-12 transition-transform" />
                  </button>
                  <button
                    onClick={onAccept}
                    className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white transition-all hover:scale-110 shadow-xl shadow-green-500/30 animate-bounce group"
                  >
                    <Phone className="w-10 h-10 group-hover:-rotate-12 transition-transform" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-cyber-panel text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                  </button>
                  
                  <button
                    onClick={onEnd}
                    className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all hover:scale-110 shadow-xl shadow-red-500/30"
                  >
                    <PhoneOff className="w-10 h-10" />
                  </button>

                  <button
                    onClick={toggleLoudspeaker}
                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                      isLoudspeaker ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50' : 'bg-cyber-panel text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {isLoudspeaker ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
                  </button>
                </>
              )}
            </div>

            {/* Abort Button for Caller */}
            {isCaller && call.status === 'ringing' && (
              <button
                onClick={onEnd}
                className="px-6 py-2 rounded-full border border-white/10 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest font-mono"
              >
                Cancel Transmission
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
