import { useState } from "react";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ManualFollowUpDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (note: string) => Promise<void> | void;
  playerName: string;
}

export function ManualFollowUpDialog({ isOpen, onClose, onSubmit, playerName }: ManualFollowUpDialogProps) {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedNote = note.trim();
    if (!trimmedNote) return;

    try {
      setIsSaving(true);
      await onSubmit(trimmedNote);
      setNote("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setNote("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus className="h-5 w-5 text-primary" />
            Add to Queue
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-follow-up-note">Reason for follow-up</Label>
            <Textarea
              id="manual-follow-up-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder={`Why should ${playerName} be reviewed?`}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This note will appear on the follow-up card.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !note.trim()} className="gap-2">
              <ListPlus className="h-4 w-4" />
              {isSaving ? "Adding..." : "Add to Queue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
