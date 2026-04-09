"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Loader2 } from "lucide-react";

const STEPS = [
  { message: "Analyzing your invoice…", duration: 5000 },
  { message: "Extracting key details…", duration: 5000 },
  { message: "Organizing the data…", duration: 15000 },
  { message: "Finalizing results…", duration: 3000 },
  { message: "Almost there…", duration: Infinity },
];

interface ProcessingDialogProps {
  open: boolean;
}

export function ProcessingDialog({ open }: ProcessingDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      return;
    }

    let current = 0;

    function advance() {
      const next = current + 1;
      if (next < STEPS.length && STEPS[next].duration !== Infinity) {
        current = next;
        setStepIndex(current);
        timer = setTimeout(advance, STEPS[current].duration);
      } else if (next < STEPS.length) {
        current = next;
        setStepIndex(current);
      }
    }

    let timer = setTimeout(advance, STEPS[0].duration);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-sm text-center [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Processing your invoice
            </p>
            <div className="min-h-[2rem] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <ShimmeringText
                    text={STEPS[stepIndex].message}
                    className="text-lg font-semibold"
                    duration={2}
                    spread={3}
                    startOnView={false}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full bg-primary"
                animate={{
                  width: i === stepIndex ? 24 : 6,
                  opacity: i <= stepIndex ? 1 : 0.3,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
