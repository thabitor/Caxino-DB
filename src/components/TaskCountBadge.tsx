import { useState, useEffect } from "react";
import { taskService } from "@/services/taskService";
import { AlertCircle } from "lucide-react";

interface TaskCountBadgeProps {
  playerId: string;
}

export function TaskCountBadge({ playerId }: TaskCountBadgeProps) {
  const [taskCount, setTaskCount] = useState<{ total: number; pending: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaskCount = async () => {
      setLoading(true);
      const count = await taskService.getTaskCountByPlayerId(playerId);
      setTaskCount(count);
      setLoading(false);
    };

    fetchTaskCount();
  }, [playerId]);

  if (loading) {
    return <span className="text-slate-300 dark:text-slate-700">...</span>;
  }

  if (!taskCount || taskCount.total === 0) {
    return <span className="text-slate-300 dark:text-slate-700">-</span>;
  }

  if (taskCount.pending > 0) {
    return (
      <div className="flex items-center justify-center gap-1">
        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
        <span className="font-semibold text-orange-600 dark:text-orange-400">
          {taskCount.pending}
        </span>
      </div>
    );
  }

  return <span className="text-slate-400 dark:text-slate-600">✓</span>;
}
