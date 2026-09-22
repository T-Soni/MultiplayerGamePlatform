import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { AuthScreen } from './components/AuthScreen';
import { PlayerLobby } from './components/PlayerLobby';
import { GameBoard } from './components/GameBoard';
import { AdminDashboard } from './components/AdminDashboard';
import { MatchInfo } from './types';

function MainApp() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'lobby' | 'game' | 'admin'>('lobby');
  const [currentMatch, setCurrentMatch] = useState<{ match: MatchInfo; playerSymbol: 'X' | 'O' } | null>(null);

  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        setActiveTab('admin');
      } else {
        setActiveTab('lobby');
      }
    }
  }, [user?.id, user?.role]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-slate-400">Bootstrapping Platform Client...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const handleGameStart = (match: MatchInfo, playerSymbol: 'X' | 'O') => {
    setCurrentMatch({ match, playerSymbol });
    setActiveTab('game');
  };

  const handleBackToLobby = () => {
    setCurrentMatch(null);
    setActiveTab('lobby');
  };

  const handleViewAnalytics = () => {
    setCurrentMatch(null);
    setActiveTab('admin');
  };

  const handleTabChange = (tab: 'lobby' | 'game' | 'admin') => {
    if (tab === 'lobby') {
      setCurrentMatch(null);
    }
    setActiveTab(tab);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        hasActiveGame={!!currentMatch}
      />

      <main className="flex-1">
        {activeTab === 'lobby' && (
          <PlayerLobby onGameStart={handleGameStart} />
        )}

        {activeTab === 'game' && currentMatch && (
          <GameBoard
            match={currentMatch.match}
            playerSymbol={currentMatch.playerSymbol}
            onBackToLobby={handleBackToLobby}
            onViewAnalytics={handleViewAnalytics}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboard />
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500 font-mono">
        NexToe Multiplayer Platform • Hybrid Microservices & Event-Driven Architecture • Redis & WebSockets
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
