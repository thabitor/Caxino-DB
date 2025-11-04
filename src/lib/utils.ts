import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type BirthdayStatus = "today" | "tomorrow" | "yesterday" | null;

export function getBirthdayStatus(dob: string | null): BirthdayStatus {
  if (!dob) return null;
  
  const today = new Date();
  const birthDate = new Date(dob);
  
  // Set all dates to midnight for accurate comparison
  today.setHours(0, 0, 0, 0);
  birthDate.setHours(0, 0, 0, 0);
  
  // Set birth date to current year for comparison
  const thisYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  thisYearBirthday.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  
  if (thisYearBirthday.getTime() === today.getTime()) {
    return "today";
  }
  
  if (thisYearBirthday.getTime() === tomorrow.getTime()) {
    return "tomorrow";
  }
  
  if (thisYearBirthday.getTime() === yesterday.getTime()) {
    return "yesterday";
  }
  
  return null;
}

export function getBirthdayBadge(status: BirthdayStatus): { text: string; emoji: string; className: string } | null {
  if (!status) return null;
  
  switch (status) {
    case "today":
      return {
        text: "Birthday Today!",
        emoji: "🎂",
        className: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700"
      };
    case "tomorrow":
      return {
        text: "Birthday Tomorrow",
        emoji: "🎉",
        className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700"
      };
    case "yesterday":
      return {
        text: "Birthday Yesterday",
        emoji: "📅",
        className: "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
      };
  }
}