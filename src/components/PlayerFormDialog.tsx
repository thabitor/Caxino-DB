import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { PreferencesEditor } from "@/components/PreferencesEditor";
import { Player, playerSchema, PlayerFormData, PlayerInsert, PlayerUpdate, vipConfig, VipLevel } from "@/services/playerService";
import { Json } from "@/integrations/supabase/database.types";

interface PlayerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlayerInsert | PlayerUpdate) => void;
  player: Player | null;
}

const getResetValues = (player: Player | null): PlayerFormData => {
  if (!player) {
    return {
      user_id: "",
      username: "",
      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      dob: undefined,
      gender: "other",
      casino: "",
      vip_level: 3,
      last_email_sent: undefined,
      preferences: "{}",
      notes: "",
    };
  }

  let preferencesStr = "{}";
  if (player.preferences && typeof player.preferences === 'object') {
    try {
      preferencesStr = JSON.stringify(player.preferences, null, 2);
    } catch {
      preferencesStr = String(player.preferences);
    }
  } else if (player.preferences) {
    preferencesStr = String(player.preferences);
  }

  return {
    user_id: player.user_id,
    username: player.username,
    firstname: player.firstname,
    lastname: player.lastname,
    email: player.email,
    phone: player.phone ?? "",
    dob: player.dob ? new Date(player.dob) : undefined,
    gender: player.gender as "male" | "female" | "other" | undefined,
    casino: player.casino ?? "",
    vip_level: player.vip_level as VipLevel,
    last_email_sent: player.last_email_sent ? new Date(player.last_email_sent) : undefined,
    preferences: preferencesStr,
    notes: player.notes ?? "",
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
    let preferencesJson: Json = {};
    if (data.preferences) {
      try {
        preferencesJson = JSON.parse(data.preferences);
      } catch (e) {
        form.setError("preferences", { type: "manual", message: "Invalid JSON format." });
        return;
      }
    }

    const submissionData = {
      ...data,
      dob: data.dob ? data.dob.toISOString().slice(0, 10) : null,
      last_email_sent: data.last_email_sent ? data.last_email_sent.toISOString() : null,
      preferences: preferencesJson,
    };
    
    onSubmit(submissionData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{player ? "Edit Player" : "Create New Player"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 p-1">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  name="firstname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
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
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            field.onChange(dateValue ? new Date(dateValue) : undefined);
                          }}
                          max={new Date().toISOString().split('T')[0]}
                          min="1900-01-01"
                        />
                      </FormControl>
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
                            <Select onValueChange={(value) => field.onChange(Number(value))} value={String(field.value || 3)}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select VIP Level" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {(Object.keys(vipConfig) as unknown as VipLevel[]).map((level) => (
                                      <SelectItem key={level} value={String(level)}>{level} - {vipConfig[level].name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="last_email_sent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Email Sent</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            field.onChange(dateValue ? new Date(dateValue) : undefined);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...field} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-6" />

            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Player Preferences</h3>
              <p className="text-sm text-muted-foreground">Configure communication and notification preferences</p>
            </div>

            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PreferencesEditor value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit">{player ? "Save Changes" : "Create Player"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
