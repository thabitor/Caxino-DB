
export interface Player {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type PlayerFormData = Omit<Player, "id" | "createdAt" | "updatedAt">;
