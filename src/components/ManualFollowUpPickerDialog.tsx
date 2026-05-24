import { useMemo, useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PlayerWithTasks } from "@/services/playerService";
import { getFullName } from "@/services/playerService";

interface ManualFollowUpPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (player: PlayerWithTasks, note: string) => Promise<void> | void;
  players: PlayerWithTasks[];
}

export function ManualFollowUpPickerDialog({ isOpen, onClose, onSubmit, players }: ManualFollowUpPickerDialogProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const eligiblePlayers = useMemo(
    () => players.filter((player) => (player.account_status || "open").trim().toLowerCase() !== "closed"),
    [players]
  );
  const selectedPlayer = useMemo(
    () => eligiblePlayers.find((player) => player.id === selectedPlayerId) || null,
    [eligiblePlayers, selectedPlayerId]
  );

  const reset = () => {
    setSelectedPlayerId("");
    setNote("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!selectedPlayer || !trimmedNote) return;

    try {
      setIsSaving(true);
      await onSubmit(selectedPlayer, trimmedNote);
      reset();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" />
            Add to Queue
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Player</Label>
            <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a player" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {eligiblePlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {getFullName(player)} - @{player.username}
                  </SelectItem>
                ))}
                {eligiblePlayers.length === 0 && (
                  <SelectItem value="none" disabled>
                    No open players available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="queue-follow-up-note">Reason for follow-up</Label>
            <Textarea
              id="queue-follow-up-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Why should this player be reviewed?"
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">This note will appear on the follow-up card.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !selectedPlayer || !note.trim()} className="gap-2">
              <ListPlus className="h-4 w-4" />
              {isSaving ? "Adding..." : "Add to Queue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
