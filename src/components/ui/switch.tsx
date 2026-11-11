"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer border-input bg-muted data-[state=checked]:border-foreground data-[state=checked]:bg-foreground relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50",
        "after:absolute after:-inset-2 after:content-['']",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="bg-card border-input pointer-events-none block size-[1.125rem] translate-x-0.5 rounded-full border shadow-[var(--shadow-lift)] transition-transform duration-150 ease-out data-[state=checked]:translate-x-[1.375rem] data-[state=checked]:border-transparent data-[state=checked]:bg-background"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
