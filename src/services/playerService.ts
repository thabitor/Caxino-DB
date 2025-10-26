
import { Player, PlayerFormData, VipLevel } from "@/types/player";

const STORAGE_KEY = "caxino_players";

const tierToLevel: Record<string, VipLevel> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
};

const isVipLevelNumber = (v: unknown): v is VipLevel => {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
};

const normalizeVipLevel = (v: unknown): VipLevel => {
  if (isVipLevelNumber(v)) return v;
  if (typeof v === "string" && v in tierToLevel) return tierToLevel[v];
  return 1;
};

const generateMockPlayers = (): Player[] => {
  const casinos = ["Royal Palace", "Golden Crown", "Diamond Club", "Emerald Bay", "Crystal Casino"];
  const vipLevels: VipLevel[] = [1, 2, 3, 4, 5];
  const genders: Player["gender"][] = ["Male", "Female", "Other"];

  return Array.from({ length: 15 }, (_, i) => ({
    id: crypto.randomUUID(),
    userId: `USR${String(i + 1000).padStart(6, "0")}`,
    username: `player${i + 1}`,
    firstname: ["John", "Emma", "Michael", "Sarah", "David", "Lisa", "James", "Maria", "Robert", "Anna", "William", "Sophie", "Daniel", "Emily", "Thomas"][i] || `Player${i + 1}`,
    lastname: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"][i] || `Lastname${i + 1}`,
    dob: new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split("T")[0],
    gender: genders[i % 3],
    email: `player${i + 1}@example.com`,
    phone: `+1 (555) ${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    casino: casinos[i % casinos.length],
    vipLevel: vipLevels[Math.floor(i / 3) % vipLevels.length],
    totalDeposits: Math.floor(Math.random() * 50000) + 500,
    lastEmailSent: i % 3 === 0 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : null,
    preferences: i % 2 === 0 ? "Email notifications, SMS alerts" : "Email notifications only",
    notes: i % 4 === 0 ? "High value customer, prefers slot games" : i % 3 === 0 ? "Prefers table games" : "",
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

export const playerService = {
  getAll: (): Player[] => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const mockPlayers = generateMockPlayers();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockPlayers));
      return mockPlayers;
    }
    const parsed = JSON.parse(stored) as Array<Record<string, unknown>>;
    const normalized = parsed.map((p) => {
      const vipLevel = normalizeVipLevel(p.vipLevel);
      return {
        ...p,
        vipLevel,
      } as Player;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  },

  getById: (id: string): Player | undefined => {
    const players = playerService.getAll();
    return players.find((player) => player.id === id);
  },

  create: (data: PlayerFormData): Player => {
    const players = playerService.getAll();
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      ...data,
      vipLevel: normalizeVipLevel(data.vipLevel),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    players.push(newPlayer);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return newPlayer;
  },

  update: (id: string, data: Partial<PlayerFormData>): Player | undefined => {
    const players = playerService.getAll();
    const index = players.findIndex((player) => player.id === id);
    if (index === -1) return undefined;

    players[index] = {
      ...players[index],
      ...data,
      vipLevel: data.vipLevel !== undefined ? normalizeVipLevel(data.vipLevel) : players[index].vipLevel,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    return players[index];
  },

  delete: (id: string): boolean => {
    const players = playerService.getAll();
    const filtered = players.filter((player) => player.id !== id);
    if (filtered.length === players.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};
  