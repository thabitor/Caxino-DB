
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CalendarIcon, X, Phone } from "lucide-react";
import { format } from "date-fns";
import { Task, taskSchema, TaskFormData, TaskInsert, TaskUpdate, priorityConfig, statusConfig, TaskPriority, TaskStatus } from "@/services/taskService";
import * as z from "zod";

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskInsert | TaskUpdate) => void;
  task: Task | null;
  playerId: string;
}

const extendedTaskSchema = taskSchema.extend({
  is_call: z.boolean().default(false),
  phone_number: z.string().optional(),
  call_topic: z.string().optional(),
  call_time: z.string().optional(),
});

type ExtendedTaskFormData = z.infer<typeof extendedTaskSchema>;

const getResetValues = (task: Task | null, playerId: string): ExtendedTaskFormData => {
  if (!task) {
    return {
      player_id: playerId,
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      due_date: undefined,
      is_call: false,
      phone_number: "",
      call_topic: "",
      call_time: "",
    };
  }
  return {
    ...task,
    description: task.description ?? "",
    due_date: task.due_date ? new Date(task.due_date) : undefined,
    priority: task.priority as TaskPriority,
    status: task.status as TaskStatus,
    is_call: task.is_call || false,
    phone_number: task.phone_number ?? "",
    call_topic: task.call_topic ?? "",
    call_time: task.due_date ? format(new Date(task.due_date), "HH:mm") : "",
  };
};

export function TaskFormDialog({ isOpen, onClose, onSubmit, task, playerId }: TaskFormDialogProps) {
  const [isCall, setIsCall] = useState(false);

  const form = useForm<ExtendedTaskFormData>({
    resolver: zodResolver(extendedTaskSchema),
    defaultValues: getResetValues(null, playerId),
  });

  useEffect(() => {
    if (isOpen) {
      const resetValues = getResetValues(task, playerId);
      form.reset(resetValues);
      setIsCall(resetValues.is_call);
    }
  }, [task, playerId, isOpen, form]);

  const handleFormSubmit = (data: ExtendedTaskFormData) => {
    let dueDate = null;

    if (data.is_call && data.due_date && data.call_time) {
      const date = new Date(data.due_date);
      const [hours, minutes] = data.call_time.split(":");
      date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      dueDate = date.toISOString();
    } else if (data.due_date) {
      dueDate = data.due_date.toISOString();
    }

    const submissionData = {
      player_id: data.player_id,
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      status: data.status,
      due_date: dueDate,
      is_call: data.is_call,
      phone_number: data.is_call ? data.phone_number : null,
      call_topic: data.is_call ? data.call_topic : null,
    };

    onSubmit(submissionData);
  };

  const watchIsCall = form.watch("is_call");

  useEffect(() => {
    setIsCall(watchIsCall);
  }, [watchIsCall]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCall && <Phone className="w-5 h-5 text-blue-600" />}
            {task ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="is_call"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/50">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      This is a call reminder
                    </FormLabel>
                    <FormDescription>
                      Track phone calls with specific times and phone numbers
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isCall && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-700 dark:text-blue-300">Phone Number *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 (555) 123-4567" className="border-blue-300" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="call_topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-700 dark:text-blue-300">Call Topic (Optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Account verification, Bonus discussion" className="border-blue-300" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-blue-700 dark:text-blue-300">Call Date *</FormLabel>
                        <Popover modal={true}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button 
                                variant="outline" 
                                className={cn(
                                  "w-full pl-3 text-left font-normal justify-start border-blue-300",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? format(field.value, "PP") : <span>Pick date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                            <Calendar 
                              mode="single" 
                              selected={field.value} 
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                              initialFocus 
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="call_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-blue-700 dark:text-blue-300">Call Time *</FormLabel>
                        <FormControl>
                          <Input {...field} type="time" className="border-blue-300" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isCall ? "Call Title/Subject" : "Title"}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={isCall ? "e.g., Follow-up call with John" : "Enter task title"} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isCall ? "Call Notes" : "Description"}</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      value={field.value ?? ""} 
                      placeholder={isCall ? "Add any notes about the call..." : "Add task description (optional)"}
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isCall && (
              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date (Optional)</FormLabel>
                    <div className="flex gap-2">
                      <Popover modal={true}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button 
                              variant="outline" 
                              className={cn(
                                "flex-1 pl-3 text-left font-normal justify-start",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                          <Calendar 
                            mode="single" 
                            selected={field.value} 
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                            initialFocus 
                          />
                        </PopoverContent>
                      </Popover>
                      {field.value && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => field.onChange(undefined)}
                          className="shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.keys(priorityConfig).map((p) => (
                        <SelectItem key={p} value={p}>{priorityConfig[p as TaskPriority].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.keys(statusConfig).map((s) => (
                        <SelectItem key={s} value={s}>{statusConfig[s as TaskStatus].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" className={isCall ? "bg-blue-600 hover:bg-blue-700" : ""}>
                {isCall && <Phone className="w-4 h-4 mr-2" />}
                {task ? "Save Changes" : isCall ? "Schedule Call" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
