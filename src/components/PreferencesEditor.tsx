import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const nativeSelectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

export interface PlayerPreferences {
  communication?: {
    email?: boolean;
    phone?: boolean;
  };
  preferred_time_from?: number;
  preferred_time_to?: number;
  language?: string;
}

export interface PreferencesEditorProps {
  preferences: PlayerPreferences;
  onUpdate: (newPreferences: PlayerPreferences) => void;
  contactEmailOnly?: boolean;
  telegramMember?: boolean;
  whatsappChannel?: boolean;
  novatalksChannel?: boolean;
  emailChannel?: boolean;
  onContactFlagsUpdate?: (flags: {
    contactEmailOnly: boolean;
    telegramMember: boolean;
    whatsappChannel: boolean;
    novatalksChannel: boolean;
    emailChannel: boolean;
  }) => void;
}

export function PreferencesEditor({
  preferences: initialPreferences,
  onUpdate,
  contactEmailOnly = false,
  telegramMember = false,
  whatsappChannel = false,
  novatalksChannel = false,
  emailChannel = false,
  onContactFlagsUpdate,
}: PreferencesEditorProps) {
  const [preferences, setPreferences] = useState<PlayerPreferences>(initialPreferences);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const updatePreferences = (updates: Partial<PlayerPreferences>) => {
    console.log("=== PREFERENCES EDITOR UPDATE ===");
    console.log("Current preferences:", preferences);
    console.log("Update being applied:", updates);
    
    const newPrefs = { ...preferences, ...updates };
    console.log("New preferences after merge:", newPrefs);
    
    setPreferences(newPrefs);
    onUpdate(newPrefs);
    
    console.log("onUpdate callback called with:", newPrefs);
  };

  const updateCommunication = (key: keyof NonNullable<PlayerPreferences["communication"]>, val: boolean) => {
    updatePreferences({
      communication: {
        ...preferences.communication,
        [key]: val,
      },
    });
  };

  const updateContactFlag = (
    flag: "contactEmailOnly" | "telegramMember" | "whatsappChannel" | "novatalksChannel" | "emailChannel",
    value: boolean
  ) => {
    onContactFlagsUpdate?.({
      contactEmailOnly: flag === "contactEmailOnly" ? value : contactEmailOnly,
      telegramMember: flag === "telegramMember" ? value : telegramMember,
      whatsappChannel: flag === "whatsappChannel" ? value : whatsappChannel,
      novatalksChannel: flag === "novatalksChannel" ? value : novatalksChannel,
      emailChannel: flag === "emailChannel" ? value : emailChannel,
    });
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Communication Channels</CardTitle>
          <CardDescription className="text-xs">Allowed contact methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-toggle" className="text-sm">Email</Label>
            <Switch
              id="email-toggle"
              checked={preferences.communication?.email ?? true}
              onCheckedChange={(checked) => updateCommunication("email", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="phone-toggle" className="text-sm">Phone Call</Label>
            <Switch
              id="phone-toggle"
              checked={preferences.communication?.phone ?? true}
              onCheckedChange={(checked) => updateCommunication("phone", checked)}
            />
          </div>
          <div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border-2 border-emerald-200 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/20">
              <Label htmlFor="email-channel-toggle" className="text-sm font-medium">Email</Label>
              <Switch
                id="email-channel-toggle"
                checked={emailChannel}
                onCheckedChange={(checked) => updateContactFlag("emailChannel", checked)}
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border-2 border-orange-200 bg-orange-50/50 px-3 py-2 dark:border-orange-900 dark:bg-orange-950/20">
              <Label htmlFor="email-only-toggle" className="text-sm font-medium">Email only</Label>
              <Switch
                id="email-only-toggle"
                checked={contactEmailOnly}
                onCheckedChange={(checked) => updateContactFlag("contactEmailOnly", checked)}
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border-2 border-sky-200 bg-sky-50/50 px-3 py-2 dark:border-sky-900 dark:bg-sky-950/20">
              <Label htmlFor="telegram-toggle" className="text-sm font-medium">Telegram</Label>
              <Switch
                id="telegram-toggle"
                checked={telegramMember}
                onCheckedChange={(checked) => updateContactFlag("telegramMember", checked)}
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border-2 border-green-200 bg-green-50/50 px-3 py-2 dark:border-green-900 dark:bg-green-950/20">
              <Label htmlFor="whatsapp-toggle" className="text-sm font-medium">WhatsApp</Label>
              <Switch
                id="whatsapp-toggle"
                checked={whatsappChannel}
                onCheckedChange={(checked) => updateContactFlag("whatsappChannel", checked)}
              />
            </div>
            <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border-2 border-violet-200 bg-violet-50/50 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/20">
              <Label htmlFor="novatalks-toggle" className="text-sm font-medium">Novatalks</Label>
              <Switch
                id="novatalks-toggle"
                checked={novatalksChannel}
                onCheckedChange={(checked) => updateContactFlag("novatalksChannel", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription className="text-xs">Contact and language settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="time-from" className="text-sm">Preferred Time From</Label>
              <select
                value={(preferences.preferred_time_from?.toString()) || "9"}
                onChange={(event) => {
                  const val = event.target.value;
                  console.log("Time From changed to:", val);
                  updatePreferences({ preferred_time_from: parseInt(val) });
                }}
                className={nativeSelectClass}
                id="time-from"
              >
                  {Array.from({ length: 13 }, (_, i) => i + 9).map((hour) => (
                    <option key={hour} value={hour.toString()}>
                      {hour}h
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-to" className="text-sm">Preferred Time To</Label>
              <select
                value={(preferences.preferred_time_to?.toString()) || "21"}
                onChange={(event) => {
                  const val = event.target.value;
                  console.log("Time To changed to:", val);
                  updatePreferences({ preferred_time_to: parseInt(val) });
                }}
                className={nativeSelectClass}
                id="time-to"
              >
                  {Array.from({ length: 13 }, (_, i) => i + 9).map((hour) => (
                    <option key={hour} value={hour.toString()}>
                      {hour}h
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm">Preferred Language</Label>
            <select
              value={preferences.language ?? "en"}
              onChange={(event) => updatePreferences({ language: event.target.value })}
              className={nativeSelectClass}
              id="language"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
