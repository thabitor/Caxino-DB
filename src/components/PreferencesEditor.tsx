import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
}

export function PreferencesEditor({ preferences: initialPreferences, onUpdate }: PreferencesEditorProps) {
  const [preferences, setPreferences] = useState<PlayerPreferences>(initialPreferences);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const updatePreferences = (updates: Partial<PlayerPreferences>) => {
    const newPrefs = { ...preferences, ...updates };
    setPreferences(newPrefs);
    onUpdate(newPrefs);
  };

  const updateCommunication = (key: keyof NonNullable<PlayerPreferences["communication"]>, val: boolean) => {
    updatePreferences({
      communication: {
        ...preferences.communication,
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="time-from" className="text-sm">Preferred Time From</Label>
              <Select
                value={preferences.preferred_time_from?.toString() ?? "9"}
                onValueChange={(val) => updatePreferences({ preferred_time_from: parseInt(val) })}
              >
                <SelectTrigger id="time-from">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => i + 9).map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {hour}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-to" className="text-sm">Preferred Time To</Label>
              <Select
                value={preferences.preferred_time_to?.toString() ?? "21"}
                onValueChange={(val) => updatePreferences({ preferred_time_to: parseInt(val) })}
              >
                <SelectTrigger id="time-to">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 13 }, (_, i) => i + 9).map((hour) => (
                    <SelectItem key={hour} value={hour.toString()}>
                      {hour}h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        </CardContent>
      </Card>
    </div>
  );
}
