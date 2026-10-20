import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// apple.com 스타일 버튼: 알약형(pill) 채움 버튼이 기본. 최소 높이 44px.
const buttonVariants = cva(
  "pressable inline-flex shrink-0 items-center justify-center gap-2 font-normal whitespace-nowrap outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        destructive: "bg-destructive text-white",
        outline: "border border-primary text-primary hover:bg-primary hover:text-primary-foreground",
        secondary: "bg-section text-foreground hover:bg-border/60",
        ghost: "text-primary hover:underline underline-offset-4",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 rounded-full px-[22px] text-body",
        xs: "h-7 rounded-full px-3 text-micro",
        sm: "h-9 rounded-full px-4 text-small",
        lg: "h-[52px] w-full rounded-full px-7 text-body",
        icon: "size-11 rounded-full",
        "icon-xs": "size-7 rounded-full",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
