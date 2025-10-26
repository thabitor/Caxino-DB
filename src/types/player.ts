
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
  vipLevel: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
  totalDeposits: number;
  lastEmailSent: string | null;
  preferences: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PlayerFormData = Omit<Player, "id" | "createdAt" | "updatedAt">;

export const getFullName = (player: Player): string => {
  return `${player.firstname} ${player.lastname}`.trim();
};
