import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for InvoicExtract: how we collect, use, and protect your data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | InvoicExtract",
    description:
      "Privacy Policy for InvoicExtract: how we collect, use, and protect your data.",
    url: "/privacy",
  },
  twitter: {
    title: "Privacy Policy | InvoicExtract",
    description:
      "Privacy Policy for InvoicExtract: how we collect, use, and protect your data.",
  },
};

export default function PrivacyPage() {
  return (
    <section className="px-4 py-14 sm:px-6 md:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">
          Legal
        </p>
        <h1 className="font-display mt-3 mb-3 text-4xl font-extrabold tracking-tight md:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mb-10 text-sm">
          Last updated: November 11, 2026
        </p>

        <div className="text-muted-foreground max-w-none text-[0.9375rem] leading-relaxed [&>section]:border-border [&>section]:border-t [&>section]:py-6 [&_h2]:font-display [&_h2]:text-foreground [&_h2]:mt-0 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold">
          <section>
            <h2>1. Introduction</h2>
            <p>
              InvoicExtract (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed
              to protecting your privacy. This Privacy Policy describes how we
              collect, use, and safeguard your information when you use our
              invoice data extraction service.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Account Information:</strong>{" "}
                Your name and email address, provided when you create an
                account (via email/password or Google sign-in).
              </li>
              <li>
                <strong className="text-foreground">Uploaded Documents:</strong>{" "}
                Invoice files (PDF, PNG, JPEG) that you upload for processing.
              </li>
              <li>
                <strong className="text-foreground">Usage Data:</strong>{" "}
                Information about how you interact with the service, including
                pages visited, features used, and processing history.
              </li>
              <li>
                <strong className="text-foreground">Analytics Data:</strong>{" "}
                We use a self-hosted, privacy-friendly analytics tool (Umami) to
                collect aggregate, anonymous usage statistics, such as page
                views, referring sites, and general device, browser, and country
                information. This data is cookieless, is not used to personally
                identify you, and is not shared with any third party.
              </li>
              <li>
                <strong className="text-foreground">Contact Information:</strong>{" "}
                Name, email, and message content submitted through our contact
                form.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the collected information to:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>Process and extract data from uploaded invoices</li>
              <li>Manage your account, credits, and processing history</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Improve our AI extraction accuracy and service quality</li>
              <li>Send important service-related notifications</li>
            </ul>
          </section>

          <section>
            <h2>4. Data Processing and Storage</h2>
            <p>
              Uploaded invoices are processed using AI models provided by
              OpenAI to check that a document is an invoice and to extract
              structured data from it. We retain the extracted data and
              document metadata for your account history. Original uploaded
              files are stored until you delete them or until the retention
              period you choose in Settings ends, whichever comes first. We do
              not use your documents to train AI models.
            </p>
            <p className="mt-3">
              You can delete individual documents, or your whole account along
              with all of its documents, original files and credits, from the
              dashboard at any time.
            </p>
          </section>

          <section>
            <h2>5. Data Sharing</h2>
            <p>
              We do not sell your personal information. We may share data with
              the following categories of service providers:
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>
                <strong className="text-foreground">Authentication:</strong>{" "}
                Google, when you choose to sign in with your Google account.
              </li>
              <li>
                <strong className="text-foreground">AI Processing:</strong>{" "}
                OpenAI, which processes the documents you upload (page images
                and the text read from them) to extract invoice data.
              </li>
              <li>
                <strong className="text-foreground">Infrastructure:</strong>{" "}
                Hosting, email delivery and workflow automation providers for
                running the service.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your
              data, including encrypted connections (HTTPS), secure API
              authentication, and access controls. However, no method of
              electronic transmission or storage is 100% secure.
            </p>
          </section>

          <section>
            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Export your extracted invoice data</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us through the
              contact form on our website.
            </p>
          </section>

          <section>
            <h2>8. Cookies and Analytics</h2>
            <p>
              We use essential cookies required for authentication and session
              management. We do not use advertising or third-party tracking
              cookies. Our analytics (self-hosted Umami) is cookieless and
              collects only aggregate, anonymous usage statistics.
            </p>
          </section>

          <section>
            <h2>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of material changes by posting the updated policy on
              this page with a revised &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2>10. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, please reach out
              to us via the contact form in the footer of our website.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
