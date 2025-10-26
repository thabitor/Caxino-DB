
import { Task, TaskFormData, priorityOrder } from "@/types/task";

const STORAGE_KEY = "caxino_tasks";

export const taskService = {
  getAll: (): Task[] => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Task[];
  },

  getByPlayerId: (playerId: string): Task[] => {
    const tasks = taskService.getAll();
    return tasks
      .filter((task) => task.playerId === playerId)
      .sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  },

  getById: (id: string): Task | undefined => {
    const tasks = taskService.getAll();
    return tasks.find((task) => task.id === id);
  },

  create: (data: TaskFormData): Task => {
    const tasks = taskService.getAll();
    const newTask: Task = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return newTask;
  },

  update: (id: string, data: Partial<TaskFormData>): Task | undefined => {
    const tasks = taskService.getAll();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return undefined;

    tasks[index] = {
      ...tasks[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return tasks[index];
  },

  delete: (id: string): boolean => {
    const tasks = taskService.getAll();
    const filtered = tasks.filter((task) => task.id !== id);
    if (filtered.length === tasks.length) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },

  toggleComplete: (id: string): Task | undefined => {
    const task = taskService.getById(id);
    if (!task) return undefined;
    return taskService.update(id, { completed: !task.completed });
  },

  getTaskCountByPlayerId: (playerId: string): { total: number; pending: number } => {
    const tasks = taskService.getByPlayerId(playerId);
    return {
      total: tasks.length,
      pending: tasks.filter((t) => !t.completed).length,
    };
  },
};
