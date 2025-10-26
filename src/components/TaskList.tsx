import { Task, TaskPriority, TaskStatus } from "@/services/taskService";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CheckCircle, Circle } from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onToggle: (taskId: string) => void;
}

const priorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-green-700", bgColor: "bg-green-100 dark:bg-green-900" },
  medium: { label: "Medium", color: "text-yellow-700", bgColor: "bg-yellow-100 dark:bg-yellow-900" },
  high: { label: "High", color: "text-red-700", bgColor: "bg-red-100 dark:bg-red-900" },
};

const statusConfig: Record<TaskStatus, { label: string; icon: React.ReactNode }> = {
    pending: { label: "Pending", icon: <Circle className="h-4 w-4 text-muted-foreground" /> },
    in_progress: { label: "In Progress", icon: <Circle className="h-4 w-4 text-blue-500 animate-pulse" /> },
    completed: { label: "Completed", icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
};

export default function TaskList({ tasks, onEdit, onDelete, onToggle }: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="text-center text-muted-foreground">No tasks for this player yet.</p>;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <Card key={task.id}>
          <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => onToggle(task.id)} className="h-6 w-6">
                  {statusConfig[task.status].icon}
                </Button>
                <h3 className={`font-semibold ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</h3>
              </div>
              
              {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge className={`${priorityConfig[task.priority].bgColor} ${priorityConfig[task.priority].color} hover:${priorityConfig[task.priority].bgColor}`}>{priorityConfig[task.priority].label}</Badge>
                {task.due_date && <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => onEdit(task)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
