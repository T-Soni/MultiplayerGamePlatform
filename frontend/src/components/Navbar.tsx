import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Coins, LogOut, Shield, User, Activity, Swords, LayoutDashboard } from 'lucide-react';

interface NavbarProps {
  activeTab: 'lobby' | 'game' | 'admin';
  setActiveTab: (tab: 'lobby' | 'game' | 'admin') => void;
  hasActiveGame: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, hasActiveGame }) => {
  const { user, logout } = useAuth();
  const [clusterHealthy, setClusterHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    const checkCluster = async () => {
      try {
        const res = await api.getClusterStatus();
        setClusterHealthy(res.allServicesOnline);
      } catch {
        setClusterHealthy(false);
      }
    };
    checkCluster();
    const interval = setInterval(checkCluster, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 font-black text-xl text-white tracking-tighter">
            #
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg text-white tracking-tight">NexToe</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Microservices
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${clusterHealthy === true ? 'bg-emerald-400 animate-pulse' : clusterHealthy === false ? 'bg-rose-500' : 'bg-amber-400'}`} />
              <span>{clusterHealthy === true ? 'Cluster Active' : clusterHealthy === false ? 'Cluster Degradation' : 'Connecting...'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs - Role-based labels and arrangement */}
        <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
          {user?.role === 'admin' ? (
            <>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Admin Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('lobby')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'lobby'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span>Test Lobby</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setActiveTab('lobby')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'lobby'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Swords className="w-4 h-4" />
                <span>Play Arena</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'admin'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Stats & Metrics</span>
              </button>
            </>
          )}

          {hasActiveGame && (
            <button
              onClick={() => setActiveTab('game')}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all animate-pulse ${
                activeTab === 'game'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40 border border-indigo-500/40'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Live Match</span>
            </button>
          )}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-3">
          {user && (
            <>
              {/* Credit Balance Badge */}
              <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-bold shadow-inner">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>{user.credits}</span>
                <span className="text-[10px] text-amber-400/80 font-normal">CR</span>
              </div>

              {/* User Identity */}
              <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
                {user.role === 'admin' ? (
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span className="font-semibold text-slate-200">{user.username}</span>
                <span className="text-slate-500 uppercase text-[9px] px-1 py-0.5 rounded bg-slate-900">
                  {user.role}
                </span>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                title="Logout"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors border border-transparent hover:border-rose-500/20"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

      </div>
    </header>
  );
};
