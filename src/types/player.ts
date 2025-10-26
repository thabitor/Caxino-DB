
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

export const vipConfig: Record<VipLevel, { name: string; color: string; bgColor: string }> = {
    1: { name: "Bronze", color: "text-amber-800 dark:text-amber-300", bgColor: "bg-amber-100 dark:bg-amber-900" },
    2: { name: "Silver", color: "text-slate-700 dark:text-slate-300", bgColor: "bg-slate-200 dark:bg-slate-700" },
    3: { name: "Gold", color: "text-yellow-700 dark:text-yellow-300", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
    4: { name: "Platinum", color: "text-cyan-700 dark:text-cyan-300", bgColor: "bg-cyan-100 dark:bg-cyan-900" },
    5: { name: "Diamond", color: "text-indigo-700 dark:text-indigo-300", bgColor: "bg-indigo-100 dark:bg-indigo-900" },
};

export const getFullName = (player: Player): string => {
  return `${player.firstname} ${player.lastname}`.trim();
};
