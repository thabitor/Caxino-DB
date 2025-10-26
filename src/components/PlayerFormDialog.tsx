import { useState, useEffect } from "react";
import { Player, PlayerFormData, VipLevel, vipTierName } from "@/services/playerService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface PlayerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: PlayerFormData) => void;
  player?: Player | null;
}

export function PlayerFormDialog({ open, onOpenChange, onSubmit, player }: PlayerFormDialogProps) {
  const [formData, setFormData] = useState<PlayerFormData>({
    userId: "",
    username: "",
    firstname: "",
    lastname: "",
    dob: "",
    gender: "Male",
    email: "",
    phone: "",
    casino: "",
    vipLevel: 1,
    totalDeposits: 0,
    lastEmailSent: null,
    preferences: "",
    notes: "",
  });

  useEffect(() => {
    if (player) {
      setFormData({
        userId: player.userId,
        username: player.username,
        firstname: player.firstname,
        lastname: player.lastname,
        dob: player.dob,
        gender: player.gender,
        email: player.email,
        phone: player.phone,
        casino: player.casino,
        vipLevel: player.vipLevel,
        totalDeposits: player.totalDeposits,
        lastEmailSent: player.lastEmailSent,
        preferences: player.preferences,
        notes: player.notes,
      });
    } else {
      setFormData({
        userId: `USR${String(Date.now()).slice(-6)}`,
        username: "",
        firstname: "",
        lastname: "",
        dob: "",
        gender: "Male",
        email: "",
        phone: "",
        casino: "",
        vipLevel: 1,
        totalDeposits: 0,
        lastEmailSent: null,
        preferences: "",
        notes: "",
      });
    }
  }, [player, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{player ? "Edit Player" : "Add New Player"}</DialogTitle>
          <DialogDescription>
            {player ? "Update player information below" : "Fill in the details to add a new player"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                required
                placeholder="USR123456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                placeholder="player123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstname">First Name</Label>
              <Input
                id="firstname"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                required
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastname">Last Name</Label>
              <Input
                id="lastname"
                value={formData.lastname}
                onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                required
                placeholder="Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formData.gender}
                onValueChange={(value: PlayerFormData["gender"]) => setFormData({ ...formData, gender: value })}
              >
                <SelectTrigger id="gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="player@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="casino">Casino</Label>
              <Input
                id="casino"
                value={formData.casino}
                onChange={(e) => setFormData({ ...formData, casino: e.target.value })}
                required
                placeholder="Royal Palace"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vipLevel">VIP Level</Label>
              <Select
                value={String(formData.vipLevel)}
                onValueChange={(value: string) =>
                  setFormData({ ...formData, vipLevel: Number(value) as VipLevel })
                }
              >
                <SelectTrigger id="vipLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — {vipTierName[1]}</SelectItem>
                  <SelectItem value="2">2 — {vipTierName[2]}</SelectItem>
                  <SelectItem value="3">3 — {vipTierName[3]}</SelectItem>
                  <SelectItem value="4">4 — {vipTierName[4]}</SelectItem>
                  <SelectItem value="5">5 — {vipTierName[5]}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalDeposits">Total Deposits ($)</Label>
              <Input
                id="totalDeposits"
                type="number"
                min="0"
                step="0.01"
                value={formData.totalDeposits}
                onChange={(e) => setFormData({ ...formData, totalDeposits: parseFloat(e.target.value) || 0 })}
                required
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastEmailSent">Last Email Sent</Label>
              <Input
                id="lastEmailSent"
                type="datetime-local"
                value={formData.lastEmailSent ? new Date(formData.lastEmailSent).toISOString().slice(0, 16) : ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lastEmailSent: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferences">Preferences</Label>
            <Textarea
              id="preferences"
              value={formData.preferences}
              onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
              placeholder="Email notifications, SMS alerts, etc."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes about the player..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{player ? "Update Player" : "Add Player"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
