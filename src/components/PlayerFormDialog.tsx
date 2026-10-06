import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { PreferencesEditor, PlayerPreferences } from "@/components/PreferencesEditor";
import { Player, playerSchema, PlayerFormData, PlayerInsert, PlayerUpdate, vipConfig, VipLevel } from "@/services/playerService";
import { Json } from "@/integrations/supabase/database.types";

const nativeSelectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

interface PlayerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlayerInsert | PlayerUpdate) => void;
  player: Player | null;
}

const getResetValues = (player: Player | null): PlayerFormData => {
  if (!player) {
    return {
      user_id: "",      firstname: "",
      lastname: "",
      email: "",
      phone: "",
      dob: undefined,
      gender: "other",
      casino: "",
      contact_email_only: false,
      telegram_member: false,
      whatsapp_channel: false,
      novatalks_channel: false,
      email_channel: false,
      sent_vip_guide: false,
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
    user_id: player.user_id,    firstname: player.firstname,
    lastname: player.lastname,
    email: player.email,
    phone: player.phone ?? "",
    dob: player.dob ? new Date(player.dob) : undefined,
    gender: player.gender as "male" | "female" | "other" | undefined,
    casino: player.casino ?? "",
    contact_email_only: player.contact_email_only ?? false,
    telegram_member: player.telegram_member ?? false,
    whatsapp_channel: player.whatsapp_channel ?? false,
    novatalks_channel: player.novatalks_channel ?? false,
    email_channel: player.email_channel ?? false,
    sent_vip_guide: player.sent_vip_guide ?? false,
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
                    name="gender"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <FormControl>
                              <select
                                value={field.value || "other"}
                                onChange={(event) => field.onChange(event.target.value)}
                                className={nativeSelectClass}
                              >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                              </select>
                            </FormControl>
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
                            <FormControl>
                              <select
                                value={String(field.value || 3)}
                                onChange={(event) => field.onChange(Number(event.target.value))}
                                className={nativeSelectClass}
                              >
                                {(Object.keys(vipConfig) as unknown as VipLevel[]).map((level) => (
                                  <option key={level} value={String(level)}>{level} - {vipConfig[level].name}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                  control={form.control}
                  name="sent_vip_guide"
                  render={({ field }) => (
                    <FormItem className="flex min-h-10 items-center gap-3 rounded-md border-2 border-indigo-200 bg-indigo-50/40 px-3 py-2 dark:border-indigo-900 dark:bg-indigo-950/20">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-semibold">VIP guide sent</FormLabel>
                        <p className="text-xs text-muted-foreground">Marks that the player received the VIP guide.</p>
                      </div>
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
              render={({ field }) => {
                const handlePreferencesUpdate = (newPreferences: PlayerPreferences) => {
                  try {
                    const jsonString = JSON.stringify(newPreferences);
                    field.onChange(jsonString);
                  } catch (error) {
                    console.error("Failed to stringify preferences:", error);
                    // Optionally set a form error here
                  }
                };

                let currentPreferences: PlayerPreferences = {};
                try {
                  if (field.value && typeof field.value === 'string') {
                    currentPreferences = JSON.parse(field.value);
                  }
                } catch (error) {
                  console.error("Failed to parse preferences:", error);
                  // Optionally set a form error here
                }
                
                return (
                  <FormItem>
                    <FormControl>
                      <PreferencesEditor 
                        preferences={currentPreferences} 
                        onUpdate={handlePreferencesUpdate} 
                        contactEmailOnly={form.watch("contact_email_only") === true}
                        telegramMember={form.watch("telegram_member") === true}
                        whatsappChannel={form.watch("whatsapp_channel") === true}
                        novatalksChannel={form.watch("novatalks_channel") === true}
                        emailChannel={form.watch("email_channel") === true}
                        onContactFlagsUpdate={({ contactEmailOnly, telegramMember, whatsappChannel, novatalksChannel, emailChannel }) => {
                          form.setValue("contact_email_only", contactEmailOnly);
                          form.setValue("telegram_member", telegramMember);
                          form.setValue("whatsapp_channel", whatsappChannel);
                          form.setValue("novatalks_channel", novatalksChannel);
                          form.setValue("email_channel", emailChannel);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
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
