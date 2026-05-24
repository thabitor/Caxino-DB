import { addDays, differenceInCalendarDays, formatDistanceToNow, isToday, isTomorrow, parseISO, startOfDay } from "date-fns";
import type { CallLog } from "@/services/callLogService";
import type { ManualFollowUp } from "@/services/manualFollowUpService";
import type { Player, PlayerWithTasks, VipLevel } from "@/services/playerService";
import { getBirthdayStatus } from "@/lib/utils";
import type { Task } from "@/services/taskService";

export type FollowUpStatus = "overdue" | "today" | "soon" | "attention" | "healthy";

export interface FollowUpItem {
  player: PlayerWithTasks;
  status: FollowUpStatus;
  score: number;
  title: string;
  primaryReason: string;
  reasons: string[];
  lastContactLabel: string;
  cadenceLabel: string;
  nextAction: string;
  activeTaskCount: number;
  activeCallCount: number;
  dueDate?: string | null;
  lastCallAt?: string | null;
  reasonBadge: string;
  queueCreatedAt: string;
  manualFollowUpId?: string | null;
  manualFollowUpNote?: string | null;
}

const cadenceDaysByVip: Record<VipLevel, number> = {
  1: 60,
  2: 45,
  3: 30,
  4: 14,
  5: 7,
};
const RECENT_CALL_REVIEW_MS = 60 * 60 * 1000;

function getCadenceDays(player: Player): number {
  const vipLevel = player.vip_level as VipLevel;
  return cadenceDaysByVip[vipLevel] || 30;
}

function isActiveTask(task: Task): boolean {
  return task.status !== "completed" && task.status !== "cancelled";
}

function getEarliestDueTask(tasks: Task[]): Task | undefined {
  return tasks
    .filter((task): task is Task & { due_date: string } => Boolean(task.due_date))
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
}

function getLastCall(callLogs: CallLog[]): CallLog | undefined {
  return [...callLogs].sort((a, b) => {
    const aTime = new Date(a.completed_at || a.call_time).getTime();
    const bTime = new Date(b.completed_at || b.call_time).getTime();
    return bTime - aTime;
  })[0];
}

function isInsidePreferredWindow(player: Player, now: Date): boolean {
  if (player.preferred_time_from == null || player.preferred_time_to == null) {
    return false;
  }

  const hour = now.getHours();
  return hour >= player.preferred_time_from && hour < player.preferred_time_to;
}

function getTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getIsoFromTime(time: number | null, fallback: Date): string {
  return new Date(time ?? fallback.getTime()).toISOString();
}

function getBirthdayQueueTime(birthdayStatus: ReturnType<typeof getBirthdayStatus>, now: Date): number | null {
  if (!birthdayStatus) return null;

  if (birthdayStatus === "tomorrow") {
    return startOfDay(now).getTime();
  }

  if (birthdayStatus === "today") {
    return startOfDay(addDays(now, -1)).getTime();
  }

  return startOfDay(addDays(now, -2)).getTime();
}

export function buildFollowUpQueue(
  players: PlayerWithTasks[],
  tasks: Task[],
  callLogs: CallLog[],
  manualFollowUps: ManualFollowUp[] = [],
  now = new Date()
): FollowUpItem[] {
  const tasksByPlayer = new Map<string, Task[]>();
  const callsByPlayer = new Map<string, CallLog[]>();
  const manualByPlayer = new Map<string, ManualFollowUp>();

  tasks.filter(isActiveTask).forEach((task) => {
    const existing = tasksByPlayer.get(task.player_id) || [];
    existing.push(task);
    tasksByPlayer.set(task.player_id, existing);
  });

  callLogs.forEach((callLog) => {
    const existing = callsByPlayer.get(callLog.player_id) || [];
    existing.push(callLog);
    callsByPlayer.set(callLog.player_id, existing);
  });

  manualFollowUps.forEach((followUp) => {
    const existing = manualByPlayer.get(followUp.player_id);
    if (!existing || new Date(followUp.created_at).getTime() > new Date(existing.created_at).getTime()) {
      manualByPlayer.set(followUp.player_id, followUp);
    }
  });

  const queueItems = players
    .filter((player) => (player.account_status || "open").trim().toLowerCase() !== "closed")
    .map((player) => {
      const playerTasks = tasksByPlayer.get(player.id) || [];
      const playerCallLogs = callsByPlayer.get(player.id) || [];
      const manualFollowUp = manualByPlayer.get(player.id);
      const activeCalls = playerTasks.filter((task) => task.is_call);
      const activeRegularTasks = playerTasks.filter((task) => !task.is_call);
      const earliestTask = getEarliestDueTask(playerTasks);
      const lastCall = getLastCall(playerCallLogs);
      const cadenceDays = getCadenceDays(player);
      const birthdayStatus = getBirthdayStatus(player.dob);
      const reasons: string[] = [];
      const triggerTimes: number[] = [];
      let score = 0;
      let status: FollowUpStatus = "healthy";
      let nextAction = "Review relationship notes";
      let recentlyContacted = false;
      let reasonBadge = "Review";

      if (manualFollowUp) {
        score += 160;
        status = "attention";
        reasonBadge = "Manual";
        reasons.push(manualFollowUp.note);
        triggerTimes.push(getTime(manualFollowUp.created_at) ?? now.getTime());
        nextAction = "Review manual follow-up";
      }

      if (earliestTask?.due_date) {
        const dueDate = parseISO(earliestTask.due_date);
        const daysUntilDue = differenceInCalendarDays(dueDate, now);

        if (daysUntilDue < 0) {
          score += earliestTask.is_call ? 120 : 95;
          status = "overdue";
          if (reasonBadge !== "Manual") reasonBadge = "Overdue";
          reasons.push(`${earliestTask.is_call ? "Call" : "Task"} overdue by ${formatDistanceToNow(dueDate)}`);
          triggerTimes.push(getTime(earliestTask.created_at) ?? dueDate.getTime());
          nextAction = earliestTask.is_call ? "Complete overdue call" : "Complete overdue task";
        } else if (isToday(dueDate)) {
          score += earliestTask.is_call ? 100 : 80;
          status = "today";
          if (reasonBadge === "Review") reasonBadge = "Due today";
          reasons.push(`${earliestTask.is_call ? "Call" : "Task"} due today`);
          triggerTimes.push(getTime(earliestTask.created_at) ?? dueDate.getTime());
          nextAction = earliestTask.is_call ? "Make scheduled call" : "Handle due task";
        } else if (isTomorrow(dueDate) || daysUntilDue <= 3) {
          score += earliestTask.is_call ? 55 : 40;
          status = status === "healthy" ? "soon" : status;
          if (reasonBadge === "Review") reasonBadge = "Due soon";
          reasons.push(`${earliestTask.is_call ? "Call" : "Task"} due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`);
          triggerTimes.push(getTime(earliestTask.created_at) ?? dueDate.getTime());
          nextAction = "Prepare next touchpoint";
        }
      }

      if (birthdayStatus) {
        const birthdayScore = birthdayStatus === "today" ? 85 : birthdayStatus === "tomorrow" ? 55 : 35;
        score += birthdayScore;
        status = status === "healthy" ? (birthdayStatus === "today" ? "today" : "soon") : status;
        if (reasonBadge === "Review") reasonBadge = "Birthday";
        reasons.push(
          birthdayStatus === "today"
            ? "Birthday today"
            : birthdayStatus === "tomorrow"
              ? "Birthday tomorrow"
              : "Birthday was yesterday"
        );
        triggerTimes.push(getBirthdayQueueTime(birthdayStatus, now) ?? now.getTime());
        nextAction = birthdayStatus === "today" ? "Send birthday outreach" : nextAction;
      }

      if (lastCall) {
        const lastContactDate = new Date(lastCall.completed_at || lastCall.call_time);
        recentlyContacted = now.getTime() - lastContactDate.getTime() < RECENT_CALL_REVIEW_MS;
        const daysSinceContact = differenceInCalendarDays(now, lastContactDate);
        const daysOverCadence = daysSinceContact - cadenceDays;

        if (recentlyContacted) {
          score += 140;
          status = status === "healthy" ? "today" : status;
          if (reasonBadge === "Review") reasonBadge = "Recent call";
          reasons.push("Call logged recently");
          triggerTimes.push(getTime(lastCall.created_at) ?? getTime(lastCall.completed_at) ?? getTime(lastCall.call_time) ?? now.getTime());
          nextAction = "Review call outcome";
        } else if (daysOverCadence > 0) {
          score += Math.min(80, 35 + daysOverCadence * 4);
          status = status === "healthy" ? "attention" : status;
          if (reasonBadge === "Review") reasonBadge = "Cadence";
          reasons.push(`No logged call for ${daysSinceContact} days`);
          triggerTimes.push(addDays(lastContactDate, cadenceDays).getTime());
          nextAction = activeCalls.length > 0 ? nextAction : "Schedule relationship call";
        }
      } else {
        score += 65;
        status = status === "healthy" ? "attention" : status;
        if (reasonBadge === "Review") reasonBadge = "No calls";
        reasons.push("No calls logged yet");
        triggerTimes.push(getTime(player.created_at) ?? now.getTime());
        nextAction = activeCalls.length > 0 ? nextAction : "Schedule first logged call";
      }

      if (!player.phone) {
        score += 20;
        if (reasonBadge === "Review") reasonBadge = "Missing info";
        reasons.push("Missing phone number");
        triggerTimes.push(getTime(player.updated_at) ?? getTime(player.created_at) ?? now.getTime());
      }

      if (!player.preferences || (typeof player.preferences === "object" && Object.keys(player.preferences).length === 0)) {
        score += 12;
        if (reasonBadge === "Review") reasonBadge = "Preferences";
        reasons.push("Contact preferences incomplete");
        triggerTimes.push(getTime(player.updated_at) ?? getTime(player.created_at) ?? now.getTime());
      }

      if (isInsidePreferredWindow(player, now)) {
        score += 10;
        if (reasonBadge === "Review") reasonBadge = "Good time";
        reasons.push("Inside preferred contact window now");
      }

      const lastContactLabel = lastCall
        ? `Last call ${formatDistanceToNow(new Date(lastCall.completed_at || lastCall.call_time), { addSuffix: true })}`
        : "No calls logged";

      const title =
        status === "overdue"
          ? "Overdue follow-up"
          : status === "today"
            ? "Contact today"
            : status === "soon"
              ? "Upcoming touchpoint"
              : status === "attention"
                ? "Needs attention"
                : "Healthy";

      return {
        player,
        status,
        score,
        title,
        primaryReason: reasons[0] || "Relationship looks current",
        reasons: reasons.slice(0, 4),
        lastContactLabel,
        cadenceLabel: `VIP ${player.vip_level || 3}: every ${cadenceDays} days`,
        nextAction,
        activeTaskCount: activeRegularTasks.length,
        activeCallCount: activeCalls.length,
        dueDate: earliestTask?.due_date,
        lastCallAt: lastCall?.completed_at || lastCall?.call_time || null,
        reasonBadge,
        queueCreatedAt: getIsoFromTime(triggerTimes.length > 0 ? Math.max(...triggerTimes) : null, now),
        manualFollowUpId: manualFollowUp?.id || null,
        manualFollowUpNote: manualFollowUp?.note || null,
      };
    })
    .filter((item) => {
      const lastCallTime = item.lastCallAt ? new Date(item.lastCallAt).getTime() : null;
      const recentlyContacted =
        lastCallTime !== null && Number.isFinite(lastCallTime) && now.getTime() - lastCallTime < RECENT_CALL_REVIEW_MS;

      return Boolean(item.manualFollowUpId) || recentlyContacted || item.status !== "healthy" || item.activeCallCount > 0 || item.activeTaskCount > 0;
    })
    .sort((a, b) => {
      const aTime = getTime(a.queueCreatedAt) ?? 0;
      const bTime = getTime(b.queueCreatedAt) ?? 0;

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.player.username.localeCompare(b.player.username);
    });

  return queueItems;
}
