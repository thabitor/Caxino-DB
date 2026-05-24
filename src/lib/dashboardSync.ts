export const DASHBOARD_REFRESH_EVENT = "caxino-dashboard-refresh";
export const DASHBOARD_REFRESH_KEY = "caxinoDashboardRefreshAt";
export const FOLLOW_UP_VIEWED_EVENT = "caxino-follow-up-viewed";
export const FOLLOW_UP_VIEWED_KEY = "viewedFollowUpPlayers";
export const FOLLOW_UP_HIGHLIGHT_KEY = "followUpHighlightedPlayers";
export const FOLLOW_UP_DISMISSED_KEY = "dismissedFollowUpPlayers";
export const FOLLOW_UP_CONTACTED_KEY = "contactedFollowUpPlayers";
export const FOLLOW_UP_RECENT_ACTIVITY_KEY = "recentFollowUpActivity";
export const FOLLOW_UP_RECENT_ACTIVITY_CLEARED_AT_KEY = "recentFollowUpActivityClearedAt";
export const FOLLOW_UP_TTL_MS = 60 * 60 * 1000;
export const FOLLOW_UP_HIGHLIGHT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const FOLLOW_UP_RECENT_ACTIVITY_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type FollowUpRecentActivityType = "opened" | "dismissed";
export type ActionHistoryActivityType =
  | "follow_up_opened"
  | "follow_up_dismissed"
  | "call_logged"
  | "account_closed"
  | "account_reopened"
  | "player_added";

export interface FollowUpRecentActivity {
  playerId: string;
  type: FollowUpRecentActivityType;
  timestamp: string;
}

export interface ActionHistoryActivity {
  playerId: string;
  type: ActionHistoryActivityType;
  timestamp: string;
  detail?: string | null;
}

export function notifyDashboardRefresh() {
  if (typeof window === "undefined") return;

  const timestamp = Date.now().toString();
  localStorage.setItem(DASHBOARD_REFRESH_KEY, timestamp);
  window.dispatchEvent(new CustomEvent(DASHBOARD_REFRESH_EVENT, { detail: { timestamp } }));
}

export function getDashboardRefreshToken() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(DASHBOARD_REFRESH_KEY);
}

function getValidFollowUpState(key: string, ttlMs = FOLLOW_UP_TTL_MS) {
  if (typeof window === "undefined") return {};

  try {
    const stored = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, string>;
    const now = Date.now();
    const current = Object.fromEntries(
      Object.entries(stored).filter(([, timestamp]) => {
        const savedAt = new Date(timestamp).getTime();
        return Number.isFinite(savedAt) && now - savedAt < ttlMs;
      })
    );

    localStorage.setItem(key, JSON.stringify(current));
    return current;
  } catch {
    localStorage.removeItem(key);
    return {};
  }
}

function saveFollowUpState(key: string, playerId: string, ttlMs = FOLLOW_UP_TTL_MS) {
  if (typeof window === "undefined") return;

  const next = {
    ...getValidFollowUpState(key, ttlMs),
    [playerId]: new Date().toISOString(),
  };

  localStorage.setItem(key, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(FOLLOW_UP_VIEWED_EVENT, { detail: { playerId } }));
}

function getValidRecentActivity() {
  if (typeof window === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(FOLLOW_UP_RECENT_ACTIVITY_KEY) || "[]") as FollowUpRecentActivity[];
    const now = Date.now();
    const current = stored.filter((activity) => {
      const savedAt = new Date(activity.timestamp).getTime();
      return activity.playerId && (activity.type === "opened" || activity.type === "dismissed") && Number.isFinite(savedAt) && now - savedAt < FOLLOW_UP_RECENT_ACTIVITY_TTL_MS;
    });

    localStorage.setItem(FOLLOW_UP_RECENT_ACTIVITY_KEY, JSON.stringify(current));
    return current;
  } catch {
    localStorage.removeItem(FOLLOW_UP_RECENT_ACTIVITY_KEY);
    return [];
  }
}

function saveRecentActivity(playerId: string, type: FollowUpRecentActivityType) {
  if (typeof window === "undefined") return;

  const activity = {
    playerId,
    type,
    timestamp: new Date().toISOString(),
  };
  const existing = getValidRecentActivity().filter(
    (item) => !(item.playerId === playerId && item.type === type)
  );

  localStorage.setItem(FOLLOW_UP_RECENT_ACTIVITY_KEY, JSON.stringify([activity, ...existing]));
  window.dispatchEvent(new CustomEvent(FOLLOW_UP_VIEWED_EVENT, { detail: { playerId } }));
}

export function getViewedFollowUps() {
  return getValidFollowUpState(FOLLOW_UP_VIEWED_KEY);
}

export function getHighlightedFollowUps() {
  return getValidFollowUpState(FOLLOW_UP_HIGHLIGHT_KEY, FOLLOW_UP_HIGHLIGHT_TTL_MS);
}

export function getDismissedFollowUps() {
  return getValidFollowUpState(FOLLOW_UP_DISMISSED_KEY);
}

export function getContactedFollowUps() {
  return getValidFollowUpState(FOLLOW_UP_CONTACTED_KEY);
}

export function getRecentFollowUpActivity() {
  return getValidRecentActivity();
}

export function getRecentFollowUpActivityClearedAt() {
  if (typeof window === "undefined") return null;

  return localStorage.getItem(FOLLOW_UP_RECENT_ACTIVITY_CLEARED_AT_KEY);
}

export function clearRecentFollowUpActivity() {
  if (typeof window === "undefined") return;

  const timestamp = new Date().toISOString();
  localStorage.setItem(FOLLOW_UP_RECENT_ACTIVITY_KEY, JSON.stringify([]));
  localStorage.setItem(FOLLOW_UP_RECENT_ACTIVITY_CLEARED_AT_KEY, timestamp);
  window.dispatchEvent(new CustomEvent(FOLLOW_UP_VIEWED_EVENT, { detail: { clearedAt: timestamp } }));
}

export function restoreDismissedFollowUp(playerId: string) {
  if (typeof window === "undefined") return;

  const dismissed = getValidFollowUpState(FOLLOW_UP_DISMISSED_KEY);
  delete dismissed[playerId];
  localStorage.setItem(FOLLOW_UP_DISMISSED_KEY, JSON.stringify(dismissed));

  const recentActivity = getValidRecentActivity().filter(
    (activity) => !(activity.playerId === playerId && activity.type === "dismissed")
  );
  localStorage.setItem(FOLLOW_UP_RECENT_ACTIVITY_KEY, JSON.stringify(recentActivity));

  notifyDashboardRefresh();
  window.dispatchEvent(new CustomEvent(FOLLOW_UP_VIEWED_EVENT, { detail: { playerId } }));
}

export function markFollowUpViewed(playerId: string) {
  saveFollowUpState(FOLLOW_UP_VIEWED_KEY, playerId);
  saveFollowUpState(FOLLOW_UP_HIGHLIGHT_KEY, playerId, FOLLOW_UP_HIGHLIGHT_TTL_MS);
  saveRecentActivity(playerId, "opened");
}

export function markFollowUpContacted(playerId: string) {
  saveFollowUpState(FOLLOW_UP_CONTACTED_KEY, playerId);
}

export function dismissFollowUp(playerId: string) {
  saveFollowUpState(FOLLOW_UP_DISMISSED_KEY, playerId);
  saveRecentActivity(playerId, "dismissed");
}
