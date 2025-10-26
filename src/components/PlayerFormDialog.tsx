
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Player, playerSchema, PlayerFormData, PlayerInsert, PlayerUpdate, vipConfig, VipLevel } from "@/services/playerService";
import { Json } from "@/integrations/supabase/types";

interface PlayerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlayerInsert | PlayerUpdate) => void;
  player: Player | null;
}

const getResetValues = (player: Player | null) => {
  if (!player) {
    return {
      username: "",
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      dob: undefined,
      gender: "other" as const,
      casino: "",
      vip_level: 1 as VipLevel,
      total_deposits: 0,
      last_email_sent: undefined,
      preferences: "{}",
      notes: "",
    };
  }

  let preferencesStr = "{}";
  if (player.preferences) {
    try {
      preferencesStr = JSON.stringify(player.preferences, null, 2);
    } catch {
      preferencesStr = String(player.preferences);
    }
  }

  return {
    ...player,
    phone: player.phone ?? "",
    dob: player.dob ? new Date(player.dob) : undefined,
    gender: (player.gender as "male" | "female" | "other") ?? "other",
    last_email_sent: player.last_email_sent ? new Date(player.last_email_sent) : undefined,
    preferences: preferencesStr,
    vip_level: player.vip_level as VipLevel,
  };
};

export function PlayerFormDialog({ isOpen, onClose, onSubmit, player }: PlayerFormDialogProps) {
  const form = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: getResetValues(null),
  });

  useEffect(() => {
    if (isOpen) {
      form.reset(getResetValues(player));
    }
  }, [player, isOpen, form]);

  const handleFormSubmit = (data: PlayerFormData) => {
    let preferencesJson: Json = null;
    try {
      if (data.preferences) {
        preferencesJson = JSON.parse(data.preferences);
      }
    } catch (e) {
      // If parsing fails, we can either show an error or handle it.
      // The zod schema already validates this, so this catch is a safeguard.
      console.error("Invalid JSON in preferences", e);
      form.setError("preferences", { type: "manual", message: "Invalid JSON format." });
      return;
    }

    onSubmit({
      ...data,
      dob: data.dob ? data.dob.toISOString() : null,
      last_email_sent: data.last_email_sent ? data.last_email_sent.toISOString() : null,
      preferences: preferencesJson,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{player ? "Edit Player" : "Create New Player"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="firstname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dob"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Birth</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "other"}>
                              <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                control={form.control}
                name="casino"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Casino</FormLabel>
                    <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                  control={form.control}
                  name="vip_level"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>VIP Level</FormLabel>
                          <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value || 1)}>
                              <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Select VIP Level" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {(Object.entries(vipConfig) as [string, any][]).map(([level, config]) => (
                                    <SelectItem key={level} value={level}>{config.name}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              <FormField
                control={form.control}
                name="total_deposits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Deposits</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value || 0} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_email_sent"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Last Email Sent</FormLabel>
                     <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferences (JSON format)</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">{player ? "Save Changes" : "Create Player"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
