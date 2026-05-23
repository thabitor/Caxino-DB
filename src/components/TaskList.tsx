
import { ReactNode, useState } from "react";
import { format } from "date-fns";
import { Task, TaskPriority, TaskStatus, priorityConfig, statusConfig } from "@/services/taskService";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, CheckCircle, Timer, XCircle, Check, Loader, Phone } from "lucide-react";
import { CallCompletionDialog } from "./CallCompletionDialog";

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onCompleteCall?: (id: string, notes?: string, durationMinutes?: number, callTopic?: string) => void;
}

const statusIcons: Record<TaskStatus, ReactNode> = {
  pending: <Timer className="w-4 h-4 text-yellow-500" />,
  in_progress: <Loader className="w-4 h-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  cancelled: <XCircle className="w-4 h-4 text-gray-500" />,
};

export function TaskList({ tasks, onEdit, onDelete, onComplete, onCompleteCall }: TaskListProps) {
  const [completingCallTask, setCompletingCallTask] = useState<Task | null>(null);

  const handleCompleteClick = (task: Task) => {
    if (task.is_call && onCompleteCall) {
      setCompletingCallTask(task);
    } else {
      onComplete(task.id);
    }
  };

  const handleCallComplete = (notes?: string, durationMinutes?: number, callTopic?: string) => {
    if (completingCallTask && onCompleteCall) {
      onCompleteCall(completingCallTask.id, notes, durationMinutes, callTopic);
    }
    setCompletingCallTask(null);
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10">
        <h3 className="text-lg font-semibold">No Tasks Yet</h3>
        <p className="text-sm text-muted-foreground">Click "Add Task" to create the first one for this player.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => {
          const priority = priorityConfig[task.priority as TaskPriority];
          const status = statusConfig[task.status as TaskStatus];
          const isCallTask = task.is_call;

          return (
            <Card 
              key={task.id} 
              className={`flex flex-col shadow-md ${isCallTask ? 'border-blue-300 bg-blue-50/30 shadow-blue-500/5 dark:border-blue-700 dark:bg-blue-950/20' : ''}`}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {isCallTask && <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                    </div>
                    {task.due_date && (
                      <CardDescription className={isCallTask ? "font-semibold" : ""}>
                        {isCallTask ? "Call at: " : "Due: "}
                        {format(new Date(task.due_date), isCallTask ? "MMM d, yyyy 'at' h:mm a" : "MMM d, yyyy")}
                      </CardDescription>
                    )}
                    {isCallTask && task.phone_number && (
                      <div className="flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300 font-mono bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                        <Phone className="w-3 h-3" />
                        {task.phone_number}
                      </div>
                    )}
                    {isCallTask && task.call_topic && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Topic:</span> {task.call_topic}
                      </p>
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
                        <DropdownMenuItem onClick={() => handleCompleteClick(task)}>
                          {isCallTask ? (
                            <>
                              <Phone className="mr-2 h-4 w-4" />
                              <span>Complete Call</span>
                            </>
                          ) : (
                            <>
                              <Check className="mr-2 h-4 w-4" />
                              <span>Mark as Complete</span>
                            </>
                          )}
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
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Badge className={`${priority.bgColor} ${priority.color} hover:${priority.bgColor}`}>
                  {priority.label}
                </Badge>
                <div className="flex items-center gap-2">
                  {statusIcons[task.status as TaskStatus]}
                  <span className="text-sm font-medium">{status.label}</span>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <CallCompletionDialog
        isOpen={!!completingCallTask}
        onClose={() => setCompletingCallTask(null)}
        onComplete={handleCallComplete}
        callTopic={completingCallTask?.call_topic}
        phoneNumber={completingCallTask?.phone_number}
      />
    </>
  );
}
