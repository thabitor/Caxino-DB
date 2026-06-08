import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface PlayerFlyoutProps {
  playerId: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlayerFlyout({ playerId, isOpen, onOpenChange }: PlayerFlyoutProps) {
  const playerUrl = playerId ? `/player/${playerId}` : "";
  const playerWindowUrl = playerId ? `${playerUrl}?from=window` : "";
  const embeddedUrl = playerId ? `${playerUrl}?embed=1` : "";

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[min(1300px,98vw)] flex-col gap-0 overflow-hidden border-l-2 p-0 sm:max-w-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 shadow-sm">
          <SheetHeader className="space-y-0">
            <SheetTitle>Player Workspace</SheetTitle>
            <SheetDescription>Review details and complete actions without leaving the dashboard.</SheetDescription>
          </SheetHeader>
          {playerId && (
            <Button asChild variant="outline" size="sm" className="mr-8 shrink-0 gap-1.5">
              <a href={playerWindowUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open in window
              </a>
            </Button>
          )}
        </div>
        {playerId ? (
          <iframe
            key={playerId}
            src={embeddedUrl}
            title="Player workspace"
            className="h-full min-h-0 w-full flex-1 border-0 bg-background"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a player to open their workspace.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
