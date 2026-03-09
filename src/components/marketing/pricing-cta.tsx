"use client";

import Link from "next/link";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ContactDialog } from "@/components/marketing/contact-dialog";

interface PricingCtaProps {
  cta: string;
  highlighted: boolean;
  comingSoon?: boolean;
  contactUs?: boolean;
}

export function PricingCta({ cta, highlighted, comingSoon, contactUs }: PricingCtaProps) {
  const variant = highlighted ? "default" : "outline";

  if (comingSoon) {
    return (
      <Button className="w-full" variant="outline" disabled>
        {cta}
      </Button>
    );
  }

  if (contactUs) {
    return (
      <ContactDialog>
        <Button className="w-full" variant={variant}>
          {cta}
        </Button>
      </ContactDialog>
    );
  }

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button className="w-full" variant={variant}>
            {cta}
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button asChild className="w-full" variant={variant}>
          <Link href="/dashboard">{cta}</Link>
        </Button>
      </SignedIn>
    </>
  );
}
