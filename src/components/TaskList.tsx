import { Task, TaskPriority } from "@/services/taskService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2, Calendar, AlertCircle } from "lucide-react";

const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
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

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggleComplete: (taskId: string) => void;
}

export function TaskList({ tasks, onEdit, onDelete, onToggleComplete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
        <p className="text-sm text-slate-600 dark:text-slate-400">No tasks yet</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
          Create a reminder to get started
        </p>
      </div>
    );
  }

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: "Overdue", color: "text-red-600 dark:text-red-400" };
    } else if (diffDays === 0) {
      return { text: "Today", color: "text-orange-600 dark:text-orange-400" };
    } else if (diffDays === 1) {
      return { text: "Tomorrow", color: "text-yellow-600 dark:text-yellow-400" };
    } else if (diffDays <= 7) {
      return { text: `${diffDays} days`, color: "text-blue-600 dark:text-blue-400" };
    }
    return { text: date.toLocaleDateString(), color: "text-slate-600 dark:text-slate-400" };
  };

  return (
    <div className="space-y-3">
      {tasks.map((task, index) => {
        const priority = priorityConfig[task.priority];
        const dueInfo = task.dueDate ? formatDueDate(task.dueDate) : null;

        return (
          <div key={task.id}>
            <div
              className={`p-3 rounded-lg border transition-all ${
                task.completed
                  ? "bg-slate-50/50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700"
                  : `${priority.bgColor} border-2`
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => onToggleComplete(task.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4
                      className={`font-medium text-sm ${
                        task.completed
                          ? "line-through text-slate-500 dark:text-slate-500"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {task.title}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${
                        task.completed
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          : priority.color
                      }`}
                    >
                      {priority.label}
                    </Badge>
                  </div>

                  {task.description && (
                    <p
                      className={`text-xs mt-1 ${
                        task.completed
                          ? "text-slate-400 dark:text-slate-600"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {task.description}
                    </p>
                  )}

                  {dueInfo && (
                    <div className="flex items-center gap-1 mt-2">
                      <Calendar className={`w-3 h-3 ${dueInfo.color}`} />
                      <span className={`text-xs font-medium ${dueInfo.color}`}>
                        {dueInfo.text}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(task)}
                      className="h-7 text-xs gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(task.id)}
                      className="h-7 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            {index < tasks.length - 1 && (
              <Separator className="my-3 bg-slate-200 dark:bg-slate-800" />
            )}
          </div>
        );
      })}
    </div>
  );
}
