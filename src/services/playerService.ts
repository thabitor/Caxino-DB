
import { Player, PlayerFormData } from "@/types/player";

const STORAGE_KEY = "caxino_players";

export const playerService = {
  getAll: (): Player[] => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  getById: (id: string): Player | undefined => {
    const players = playerService.getAll();
    return players.find(player => player.id === id);
  },

  create: (data: PlayerFormData): Player => {
    const players = playerService.getAll();
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    players.push(newPlayer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return newPlayer;
  },

  update: (id: string, data: Partial<PlayerFormData>): Player | undefined => {
    const players = playerService.getAll();
    const index = players.findIndex(player => player.id === id);
    if (index === -1) return undefined;
    
    players[index] = {
      ...players[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return players[index];
  },

  delete: (id: string): boolean => {
    const players = playerService.getAll();
    const filtered = players.filter(player => player.id !== id);
    if (filtered.length === players.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};
