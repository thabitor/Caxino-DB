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
const FOLLOW_UP_CALL_THRESHOLD_DAYS = 30;

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
      const lastCall = getLastCall(playerCallLogs);
      const reasons: string[] = [];
      let status: FollowUpStatus = "overdue";
      let nextAction = activeCalls.length > 0 ? "Complete scheduled call" : "Schedule relationship call";
      let reasonBadge = "Review";
      let queueCreatedAt: string | null = null;
      let score = 0;

      if (manualFollowUp) {
        score += 160;
        status = "attention";
        reasonBadge = "Manual";
        reasons.push(manualFollowUp.note);
        queueCreatedAt = manualFollowUp.created_at;
        nextAction = "Review manual follow-up";
      }

      if (lastCall) {
        const lastContactDate = new Date(lastCall.completed_at || lastCall.call_time);
        const daysSinceContact = differenceInCalendarDays(now, lastContactDate);

        if (daysSinceContact > FOLLOW_UP_CALL_THRESHOLD_DAYS) {
          score += Math.min(120, 60 + (daysSinceContact - FOLLOW_UP_CALL_THRESHOLD_DAYS) * 3);
          if (!manualFollowUp) {
            status = "overdue";
            reasonBadge = "Cadence";
            queueCreatedAt = addDays(lastContactDate, FOLLOW_UP_CALL_THRESHOLD_DAYS).toISOString();
          }
          reasons.push(`Last logged call was ${daysSinceContact} days ago`);
        }
      } else {
        const createdAt = getTime(player.created_at);
        const daysSinceCreated = createdAt ? differenceInCalendarDays(now, new Date(createdAt)) : FOLLOW_UP_CALL_THRESHOLD_DAYS + 1;

        if (daysSinceCreated > FOLLOW_UP_CALL_THRESHOLD_DAYS) {
          score += 75;
          if (!manualFollowUp) {
            status = "overdue";
            reasonBadge = "No calls";
            queueCreatedAt = getIsoFromTime(createdAt ? addDays(new Date(createdAt), FOLLOW_UP_CALL_THRESHOLD_DAYS).getTime() : null, now);
          }
          reasons.push("No logged call for more than 30 days");
          nextAction = activeCalls.length > 0 ? nextAction : "Schedule first logged call";
        }
      }

      const lastContactLabel = lastCall
        ? `Last call ${formatDistanceToNow(new Date(lastCall.completed_at || lastCall.call_time), { addSuffix: true })}`
        : "No calls logged";

      const title = manualFollowUp ? "Manual follow-up" : "Call overdue";

      return {
        player,
        status,
        score,
        title,
        primaryReason: reasons[0] || "Manual follow-up requested",
        reasons: reasons.slice(0, 4),
        lastContactLabel,
        cadenceLabel: "Call every 30 days",
        nextAction,
        activeTaskCount: activeRegularTasks.length,
        activeCallCount: activeCalls.length,
        dueDate: null,
        lastCallAt: lastCall?.completed_at || lastCall?.call_time || null,
        reasonBadge,
        queueCreatedAt: queueCreatedAt || now.toISOString(),
        manualFollowUpId: manualFollowUp?.id || null,
        manualFollowUpNote: manualFollowUp?.note || null,
      };
    })
    .filter((item) => {
      return Boolean(item.manualFollowUpId) || item.reasonBadge === "Cadence" || item.reasonBadge === "No calls";
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
