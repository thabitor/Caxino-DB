import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlayerPreferences {
  communication?: {
    email?: boolean;
    sms?: boolean;
    phone?: boolean;
  };
  contact_time?: "morning" | "afternoon" | "evening" | "any";
  marketing_consent?: boolean;
  language?: string;
  notifications?: {
    promotions?: boolean;
    account_updates?: boolean;
    game_results?: boolean;
  };
}

interface PreferencesEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function PreferencesEditor({ value, onChange }: PreferencesEditorProps) {
  const [preferences, setPreferences] = useState<PlayerPreferences>({});

  useEffect(() => {
    try {
      const parsed = value ? JSON.parse(value) : {};
      setPreferences(parsed);
    } catch {
      setPreferences({});
    }
  }, [value]);

  const updatePreferences = (updates: Partial<PlayerPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    onChange(JSON.stringify(newPrefs));
  };

  const updateCommunication = (key: keyof NonNullable<PlayerPreferences["communication"]>, val: boolean) => {
    updatePreferences({
      communication: {
        ...preferences.communication,
        [key]: val,
      },
    });
  };

  const updateNotifications = (key: keyof NonNullable<PlayerPreferences["notifications"]>, val: boolean) => {
    updatePreferences({
      notifications: {
        ...preferences.notifications,
        [key]: val,
      },
    });
  };

  return (
    <div className="space-y-4">
      <Card>
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
            <Label htmlFor="sms-toggle" className="text-sm">SMS</Label>
            <Switch
              id="sms-toggle"
              checked={preferences.communication?.sms ?? true}
              onCheckedChange={(checked) => updateCommunication("sms", checked)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription className="text-xs">Contact and language settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contact-time" className="text-sm">Preferred Contact Time</Label>
            <Select
              value={preferences.contact_time ?? "any"}
              onValueChange={(val) => updatePreferences({ contact_time: val as PlayerPreferences["contact_time"] })}
            >
              <SelectTrigger id="contact-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                <SelectItem value="afternoon">Afternoon (12 PM - 5 PM)</SelectItem>
                <SelectItem value="evening">Evening (5 PM - 9 PM)</SelectItem>
                <SelectItem value="any">Any Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="language" className="text-sm">Preferred Language</Label>
            <Select
              value={preferences.language ?? "en"}
              onValueChange={(val) => updatePreferences({ language: val })}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="it">Italian</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="ar">Arabic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <Label htmlFor="marketing-toggle" className="text-sm">Marketing Consent</Label>
              <p className="text-xs text-muted-foreground">Receive promotional offers</p>
            </div>
            <Switch
              id="marketing-toggle"
              checked={preferences.marketing_consent ?? false}
              onCheckedChange={(checked) => updatePreferences({ marketing_consent: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription className="text-xs">Notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="promo-toggle" className="text-sm">Promotions</Label>
            <Switch
              id="promo-toggle"
              checked={preferences.notifications?.promotions ?? true}
              onCheckedChange={(checked) => updateNotifications("promotions", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="account-toggle" className="text-sm">Account Updates</Label>
            <Switch
              id="account-toggle"
              checked={preferences.notifications?.account_updates ?? true}
              onCheckedChange={(checked) => updateNotifications("account_updates", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="game-toggle" className="text-sm">Game Results</Label>
            <Switch
              id="game-toggle"
              checked={preferences.notifications?.game_results ?? true}
              onCheckedChange={(checked) => updateNotifications("game_results", checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
