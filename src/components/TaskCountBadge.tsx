import { Badge } from "@/components/ui/badge";

interface TaskCountBadgeProps {
  count: number;
}

export function TaskCountBadge({ count }: TaskCountBadgeProps) {
  if (count === 0) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <Badge variant={count > 0 ? "default" : "secondary"}>
      {count}
    </Badge>
  );
}
