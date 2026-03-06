import Link from "next/link";
import { Receipt } from "lucide-react";
import { ContactDialog } from "@/components/marketing/contact-dialog";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              <span className="font-bold">InvoiceExtract</span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              AI-powered invoice data extraction for modern businesses.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#features" className="hover:text-foreground transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="#how-it-works" className="hover:text-foreground transition-colors">How it works</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Blog</Link></li>
              <li>
                <ContactDialog>
                  <button className="hover:text-foreground transition-colors cursor-pointer">Contact</button>
                </ContactDialog>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="#" className="hover:text-foreground transition-colors">Privacy</Link></li>
              <li><Link href="#" className="hover:text-foreground transition-colors">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} InvoiceExtract. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
