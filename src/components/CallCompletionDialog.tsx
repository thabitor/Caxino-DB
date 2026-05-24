
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

const CALL_REASONS = ["Reward", "Payment", "Tech issue"] as const;

function parseCallReasons(value?: string | null) {
  if (!value) return [];
  return CALL_REASONS.filter((reason) => value.split(",").map((item) => item.trim()).includes(reason));
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
  const [reasons, setReasons] = useState<string[]>(parseCallReasons(callTopic));

  useEffect(() => {
    if (!isOpen) return;

    setReasons(parseCallReasons(callTopic));
  }, [callTopic, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reasons.length === 0) return;

    const durationMinutes = duration ? parseInt(duration, 10) : undefined;
    onComplete(notes || undefined, durationMinutes, reasons.join(", "));
    setNotes("");
    setDuration("");
    setReasons([]);
  };

  const handleClose = () => {
    setNotes("");
    setDuration("");
    setReasons([]);
    onClose();
  };

  const handleReasonToggle = (callReason: string, checked: boolean) => {
    setReasons((currentReasons) => {
      if (checked) {
        return currentReasons.includes(callReason) ? currentReasons : [...currentReasons, callReason];
      }

      return currentReasons.filter((reason) => reason !== callReason);
    });
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
            <Label htmlFor="call-reason" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Call Reason
            </Label>
            <div id="call-reason" className="grid gap-2 rounded-md border-2 border-blue-200 bg-blue-50/40 p-2 dark:border-blue-900 dark:bg-blue-950/20">
              {CALL_REASONS.map((callReason) => (
                <label key={callReason} className="flex cursor-pointer items-center gap-2 rounded border border-blue-100 bg-background/70 px-2 py-1.5 text-sm dark:border-blue-900">
                  <Checkbox
                    checked={reasons.includes(callReason)}
                    onCheckedChange={(checked) => handleReasonToggle(callReason, checked === true)}
                  />
                  <span className="font-medium">{callReason}</span>
                </label>
              ))}
            </div>
            {callTopic && parseCallReasons(callTopic).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Previous scheduled reason: {callTopic}
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
            <Button type="submit" disabled={reasons.length === 0} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Phone className="w-4 h-4" />
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
