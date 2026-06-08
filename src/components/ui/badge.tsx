import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex max-w-full items-center whitespace-nowrap rounded-md border px-1 py-0 text-[10px] font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function getBadgeText(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getBadgeText).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getBadgeText(children.props.children);
  }

  return "";
}

function Badge({ className, variant, title, children, ...props }: BadgeProps) {
  const inferredTitle = title ?? (getBadgeText(children) || undefined);

  return (
    <div className={cn(badgeVariants({ variant }), className)} title={inferredTitle} {...props}>
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
