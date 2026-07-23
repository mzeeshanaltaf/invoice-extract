"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

interface PricingCtaProps {
  cta: string;
  highlighted: boolean;
  comingSoon?: boolean;
  contactUs?: boolean;
}

export function PricingCta({ cta, highlighted, comingSoon, contactUs }: PricingCtaProps) {
  const variant = highlighted ? "default" : "outline";
  const { data: session } = useSession();

  if (comingSoon) {
    return (
      <Button className="w-full" variant="outline" disabled>
        {cta}
      </Button>
    );
  }

  if (contactUs) {
    return (
      <Button asChild className="w-full" variant={variant}>
        <Link href="/contact">{cta}</Link>
      </Button>
    );
  }

  return (
    <Button asChild className="w-full" variant={variant}>
      <Link href={session ? "/dashboard" : "/sign-up"}>{cta}</Link>
    </Button>
  );
}
