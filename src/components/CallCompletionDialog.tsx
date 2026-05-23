
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, Clock, FileText } from "lucide-react";

interface CallCompletionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (notes?: string, durationMinutes?: number, callTopic?: string) => void;
  callTopic?: string | null;
  phoneNumber?: string | null;
  title?: string;
  confirmLabel?: string;
}

export function CallCompletionDialog({ 
  isOpen, 
  onClose, 
  onComplete,
  callTopic,
  phoneNumber,
  title = "Complete Call",
  confirmLabel = "Complete Call",
}: CallCompletionDialogProps) {
  const [notes, setNotes] = useState("");
  const [duration, setDuration] = useState("");
  const [topic, setTopic] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationMinutes = duration ? parseInt(duration, 10) : undefined;
    onComplete(notes || undefined, durationMinutes, (topic || callTopic || "").trim() || undefined);
    setNotes("");
    setDuration("");
    setTopic("");
  };

  const handleClose = () => {
    setNotes("");
    setDuration("");
    setTopic("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <Phone className="w-5 h-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {phoneNumber && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800">
              <p className="text-sm text-muted-foreground mb-1">Called</p>
              <p className="font-mono font-semibold">{phoneNumber}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="call-topic" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Call Topic
            </Label>
            <Input
              id="call-topic"
              placeholder="e.g., Bonus follow-up, birthday offer, account check"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            {callTopic && (
              <p className="text-xs text-muted-foreground">
                Scheduled topic: {callTopic}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Call Duration (minutes)
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              placeholder="e.g., 15"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional - leave blank if not tracked</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Call Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about the call..."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Optional - summarize the conversation</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Phone className="w-4 h-4" />
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
