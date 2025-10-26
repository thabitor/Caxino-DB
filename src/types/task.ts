
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  playerId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskFormData = Omit<Task, "id" | "createdAt" | "updatedAt">;

export const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  critical: {
    label: "Critical",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800",
  },
  high: {
    label: "High",
    color: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-950 border-orange-300 dark:border-orange-800",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-800",
  },
  low: {
    label: "Low",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-800",
  },
};

export const priorityOrder: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
