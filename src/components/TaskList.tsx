import { ReactNode } from "react";
import { format } from "date-fns";
import { Task, TaskPriority, TaskStatus, priorityConfig, statusConfig } from "@/services/taskService";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, CheckCircle, AlertOctagon, Timer, XCircle, Check, Loader } from "lucide-react";

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

const statusIcons: Record<TaskStatus, ReactNode> = {
  pending: <Timer className="w-4 h-4 text-yellow-500" />,
  in_progress: <Loader className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  cancelled: <XCircle className="w-4 h-4 text-gray-500" />,
};

export function TaskList({ tasks, onEdit, onDelete, onComplete }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-semibold">No Tasks Yet</h3>
        <p className="text-sm text-muted-foreground">Click "Add Task" to create the first one for this player.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {tasks.map((task) => {
        const priority = priorityConfig[task.priority as TaskPriority];
        const status = statusConfig[task.status as TaskStatus];

        return (
          <Card key={task.id} className="flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  {task.due_date && (
                    <CardDescription>
                      Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                    </CardDescription>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {task.status !== 'completed' && (
                       <DropdownMenuItem onClick={() => onComplete(task.id)}>
                         <Check className="mr-2 h-4 w-4" />
                         <span>Mark as Complete</span>
                       </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => onEdit(task)}>
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <Badge className={`${priority.bgColor} ${priority.color} hover:${priority.bgColor}`}>{priority.label}</Badge>
              <div className="flex items-center gap-2">
                {statusIcons[task.status as TaskStatus]}
                <span className="text-sm font-medium">{status.label}</span>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
