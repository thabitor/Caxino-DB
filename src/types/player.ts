
export type VipLevel = 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  userId: string;
  username: string;
  firstname: string;
  lastname: string;
  dob: string;
  gender: "Male" | "Female" | "Other" | "Prefer not to say";
  email: string;
  phone: string;
  casino: string;
  vipLevel: VipLevel;
  totalDeposits: number;
  lastEmailSent: string | null;
  preferences: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PlayerFormData = Omit<Player, "id" | "createdAt" | "updatedAt">;

export const vipTierName: Record<VipLevel, string> = {
  1: "Bronze",
  2: "Silver",
  3: "Gold",
  4: "Platinum",
  5: "Diamond",
};

export const getFullName = (player: Player): string => {
  return `${player.firstname} ${player.lastname}`.trim();
};
  