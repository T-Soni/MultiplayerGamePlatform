export type UserRole = 'player' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  credits: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface GameRules {
  id?: string;
  gridSize: number;
  winCondition: number;
  turnTimeoutSeconds: number;
  updatedAt?: string;
}

export interface ScoringPolicy {
  id?: string;
  winCredits: number;
  lossCredits: number;
  drawCredits: number;
  updatedAt?: string;
}

export interface MatchPlayer {
  userId: string;
  username: string;
  symbol: 'X' | 'O';
}

export interface MatchInfo {
  matchId: string;
  gridSize?: number;
  winCondition?: number;
  playerX: MatchPlayer;
  playerO: MatchPlayer;
  createdAt: string;
  status: string;
}

export interface MatchmakingStatus {
  status: 'idle' | 'queued' | 'matched';
  gridSize?: number;
  queuePosition?: number | null;
  totalQueued?: number;
  match?: MatchInfo | null;
}

export interface GameState {
  gridSize: number;
  winCondition: number;
  board: (string | null)[];
  currentTurn: 'X' | 'O' | null;
  movesCount: number;
  isGameOver: boolean;
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  isDraw: boolean;
  startTime: number;
}

export interface GameOverResult {
  winner: 'X' | 'O' | null;
  winningLine: number[] | null;
  isDraw: boolean;
  winnerId: string | null;
  loserId: string | null;
  reason: 'win' | 'draw' | 'resignation' | 'timeout';
}

export interface AnalyticsOverview {
  totalMatches: number;
  totalWins: number;
  totalDraws: number;
  avgDurationSeconds: number;
  avgMovesPerMatch: number;
}

export interface MatchRecord {
  id: string;
  match_id: string;
  player_x_id: string;
  player_x_username: string;
  player_o_id: string;
  player_o_username: string;
  winner_id: string | null;
  loser_id: string | null;
  is_draw: boolean;
  reason: string;
  move_count: number;
  grid_size: number;
  win_condition: number;
  duration_seconds: number;
  credits_awarded_x: number;
  credits_awarded_o: number;
  ended_at: string;
}

export interface PlayerStats {
  username: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}
