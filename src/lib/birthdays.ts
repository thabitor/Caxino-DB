import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { Player } from "@/services/playerService";

export interface UpcomingBirthday {
  player: Player;
  nextBirthday: Date;
  daysUntil: number;
  turningAge: number;
}

function getNextBirthdayDate(dob: string, today = new Date()) {
  const birthDate = new Date(dob);
  const todayStart = startOfDay(today);
  let nextBirthday = new Date(todayStart.getFullYear(), birthDate.getMonth(), birthDate.getDate());

  if (nextBirthday < todayStart) {
    nextBirthday = new Date(todayStart.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
  }

  return nextBirthday;
}

export function getUpcomingBirthdays(players: Player[], options?: { withinDays?: number; limit?: number }) {
  const today = new Date();
  const upcoming = players
    .filter((player) => Boolean(player.dob))
    .map((player) => {
      const nextBirthday = getNextBirthdayDate(player.dob!, today);
      const birthDate = new Date(player.dob!);
      const daysUntil = differenceInCalendarDays(nextBirthday, startOfDay(today));
      const turningAge = nextBirthday.getFullYear() - birthDate.getFullYear();

      return { player, nextBirthday, daysUntil, turningAge };
    })
    .filter((birthday) => options?.withinDays === undefined || birthday.daysUntil <= options.withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.player.username.localeCompare(b.player.username));

  return options?.limit ? upcoming.slice(0, options.limit) : upcoming;
}

export function getBirthdayTimingLabel(daysUntil: number) {
  if (daysUntil === 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export function formatBirthdayDate(date: Date) {
  return format(date, "MMM d");
}
