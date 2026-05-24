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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CalendarIcon, X, Phone } from "lucide-react";
import { format } from "date-fns";
import { Task, taskSchema, TaskFormData, TaskInsert, TaskUpdate, priorityConfig, statusConfig, TaskPriority, TaskStatus } from "@/services/taskService";
import * as z from "zod";

interface TaskFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskInsert | TaskUpdate) => void;
  task?: Task | null;
  playerId?: string;
  playerPhone?: string;
}

const CALL_REASONS = ["Reward", "Payment", "Tech issue"] as const;

function parseCallReasons(value?: string | null) {
  if (!value) return [];
  return CALL_REASONS.filter((reason) => value.split(",").map((item) => item.trim()).includes(reason));
}

function toggleCallReason(currentValue: string | undefined, callReason: typeof CALL_REASONS[number], checked: boolean) {
  const currentReasons = parseCallReasons(currentValue);
  const nextReasons = checked
    ? currentReasons.includes(callReason) ? currentReasons : [...currentReasons, callReason]
    : currentReasons.filter((reason) => reason !== callReason);

  return nextReasons.join(", ");
}

const extendedTaskSchema = z.object({
  player_id: z.string().min(1, "Player ID is required"),
  title: z.string().optional(), // Make title optional at base level
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  due_date: z.date().optional(),
  is_call: z.boolean().default(false),
  phone_number: z.string().optional(),
  call_topic: z.string().optional(),
  call_time: z.string().optional(),
}).superRefine((data, ctx) => {
  // If it's a call task, validate call-specific fields
  if (data.is_call) {
    if (!data.phone_number || data.phone_number.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Phone number is required for call tasks",
        path: ["phone_number"],
      });
    }
    if (!data.due_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Call date is required",
        path: ["due_date"],
      });
    }
    if (!data.call_time || data.call_time.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Call time is required",
        path: ["call_time"],
      });
    }
    if (!data.call_topic || data.call_topic.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Call reason is required",
        path: ["call_topic"],
      });
    }
  } else {
    // For non-call tasks, title is required
    if (!data.title || data.title.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Title is required for tasks",
        path: ["title"],
      });
    }
  }
});

type ExtendedTaskFormData = z.infer<typeof extendedTaskSchema>;

const getResetValues = (task: Task | null | undefined, playerId?: string, playerPhone?: string): ExtendedTaskFormData => {
  if (!task) {
    return {
      player_id: playerId || "",
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      due_date: undefined,
      is_call: false,
      phone_number: playerPhone || "",
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
    phone_number: task.phone_number ?? (playerPhone || ""),
    call_topic: task.call_topic ?? "",
    call_time: task.due_date ? format(new Date(task.due_date), "HH:mm") : "",
  };
};

export function TaskFormDialog({ isOpen, onClose, onSubmit, task, playerId, playerPhone }: TaskFormDialogProps) {
  const [isCall, setIsCall] = useState(false);

  const form = useForm<ExtendedTaskFormData>({
    resolver: zodResolver(extendedTaskSchema),
    defaultValues: getResetValues(null, playerId, playerPhone),
    mode: "onSubmit", // Only validate when form is submitted
    reValidateMode: "onChange", // After first submit, revalidate on change
  });

  useEffect(() => {
    if (isOpen) {
      const resetValues = getResetValues(task, playerId, playerPhone);
      form.reset(resetValues);
      setIsCall(resetValues.is_call);
    }
  }, [task, playerId, playerPhone, isOpen, form]);

  const handleFormSubmit = (data: ExtendedTaskFormData) => {
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Raw form data:", JSON.stringify(data, null, 2));
    
    // Pre-submission validation for call tasks
    if (data.is_call) {
      console.log("📞 Processing CALL task submission");
      const missingFields: string[] = [];
      
      if (!data.phone_number || data.phone_number.trim() === "") {
        console.error("❌ Missing: Phone Number");
        missingFields.push("Phone Number");
      }
      if (!data.call_topic || data.call_topic.trim() === "") {
        console.error("Missing: Call Reason");
        missingFields.push("Call Reason");
      }
      if (!data.call_time || data.call_time.trim() === "") {
        console.error("❌ Missing: Call Time");
        missingFields.push("Call Time");
      }
      if (!data.due_date) {
        console.error("❌ Missing: Call Date");
        missingFields.push("Call Date");
      }
      
      if (missingFields.length > 0) {
        console.error("❌ VALIDATION FAILED - Missing required fields:", missingFields);
        alert(`⚠️ VALIDATION ERROR\n\nPlease fill in all required fields:\n\n• ${missingFields.join("\n• ")}`);
        return;
      }
      
      console.log("✅ All call task fields validated successfully");
    } else {
      console.log("📝 Processing REGULAR task submission");
      if (!data.title || data.title.trim() === "") {
        console.error("❌ Missing: Title");
        alert("⚠️ VALIDATION ERROR\n\nPlease provide a task title.");
        return;
      }
    }
    
    let dueDate = null;

    if (data.is_call && data.due_date && data.call_time) {
      const date = new Date(data.due_date);
      const [hours, minutes] = data.call_time.split(":");
      date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      dueDate = date.toISOString();
      console.log("✅ Call due date constructed:", dueDate);
    } else if (data.due_date) {
      dueDate = data.due_date.toISOString();
      console.log("✅ Task due date set:", dueDate);
    }

    // For call tasks, use the selected call reason as the title.
    const finalTitle = data.is_call 
      ? (data.call_topic || "Scheduled Call") 
      : (data.title || "Untitled Task");

    const submissionData = {
      player_id: data.player_id,
      title: finalTitle,
      description: data.description || null,
      priority: data.priority,
      status: data.status,
      due_date: dueDate,
      is_call: data.is_call,
      phone_number: data.is_call ? (data.phone_number || null) : null,
      call_topic: data.is_call ? (data.call_topic || null) : null,
    };

    console.log("✅ FINAL SUBMISSION DATA:", JSON.stringify(submissionData, null, 2));
    console.log("🚀 Calling onSubmit callback...");
    
    try {
      onSubmit(submissionData);
      console.log("✅ onSubmit callback completed successfully");
      console.log("✅ Closing dialog...");
      onClose();
    } catch (error) {
      console.error("❌ ERROR in onSubmit callback:", error);
      alert(`Error submitting task: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const watchIsCall = form.watch("is_call");

  useEffect(() => {
    setIsCall(watchIsCall);
    // When switching to call mode, ensure phone number is set (but don't validate yet)
    if (watchIsCall && playerPhone) {
      const currentPhoneNumber = form.getValues("phone_number");
      if (!currentPhoneNumber || currentPhoneNumber.trim() === "") {
        form.setValue("phone_number", playerPhone, { shouldValidate: false });
      }
    }
    
    // Don't trigger validation here - wait for user to submit
  }, [watchIsCall, playerPhone, form]);

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
          <form onSubmit={form.handleSubmit(
            handleFormSubmit,
            (errors) => {
              console.error("❌ FORM VALIDATION FAILED");
              console.error("Validation errors:", errors);
              
              // Create a user-friendly error message
              const errorMessages: string[] = [];
              Object.entries(errors).forEach(([key, error]) => {
                if (error && typeof error === "object" && "message" in error) {
                  const fieldName = key === "phone_number" ? "Phone Number" : 
                                   key === "call_topic" ? "Call Reason" : 
                                   key === "call_time" ? "Call Time" : 
                                   key === "due_date" ? "Call Date" : 
                                   key === "title" ? "Title" : key;
                  errorMessages.push(`${fieldName}: ${error.message}`);
                  console.error(`  - ${fieldName}: ${error.message}`);
                }
              });
              
              // Show alert with all errors
              if (errorMessages.length > 0) {
                alert(`⚠️ VALIDATION ERROR\n\nPlease fix the following:\n\n• ${errorMessages.join("\n• ")}`);
              }
            }
          )} className="space-y-4">
            {form.formState.isSubmitted && Object.keys(form.formState.errors).length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border-2 border-red-400 dark:border-red-600 rounded-lg">
                <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Please fix the following errors:
                </p>
                <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                  {Object.entries(form.formState.errors).map(([key, error]) => (
                    <li key={key} className="font-medium">
                      <strong>{key === "phone_number" ? "Phone Number" : 
                               key === "call_topic" ? "Call Reason" : 
                               key === "call_time" ? "Call Time" : 
                               key === "due_date" ? "Call Date" : 
                               key === "title" ? "Title" : key}:</strong>{" "}
                      {error && typeof error === "object" && "message" in error ? error.message : "This field is required"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        // Immediately set phone number when switching to call mode
                        if (checked && playerPhone) {
                          form.setValue("phone_number", playerPhone, { shouldValidate: true });
                        }
                      }} 
                    />
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
                        <Input 
                          {...field} 
                          placeholder="+1 (555) 123-4567" 
                          className="border-blue-300"
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Pre-filled with player's phone number (you can edit if needed)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="call_topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-700 dark:text-blue-300">Call Reason *</FormLabel>
                      <FormControl>
                        <div className="grid gap-2 rounded-md border-2 border-blue-200 bg-background/70 p-2 dark:border-blue-900">
                          {CALL_REASONS.map((callReason) => (
                            <label key={callReason} className="flex cursor-pointer items-center gap-2 rounded border border-blue-100 bg-blue-50/40 px-2 py-1.5 text-sm dark:border-blue-900 dark:bg-blue-950/20">
                              <Checkbox
                                checked={parseCallReasons(field.value).includes(callReason)}
                                onCheckedChange={(checked) => field.onChange(toggleCallReason(field.value, callReason, checked === true))}
                              />
                              <span className="font-medium">{callReason}</span>
                            </label>
                          ))}
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Required - Select one or more reasons. These will be used as the call task title
                      </FormDescription>
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

            {!isCall && (
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter task title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
              <Button 
                type="submit" 
                className={cn(
                  isCall ? "bg-blue-600 hover:bg-blue-700" : "",
                  Object.keys(form.formState.errors).length > 0 && "opacity-50 cursor-not-allowed"
                )}
                disabled={form.formState.isSubmitting}
              >
                {isCall && <Phone className="w-4 h-4 mr-2" />}
                {form.formState.isSubmitting ? "Saving..." : task ? "Save Changes" : isCall ? "Schedule Call" : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
