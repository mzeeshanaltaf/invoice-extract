import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — InvoiceExtract",
  description: "Terms of Service for InvoiceExtract — the rules and guidelines for using our invoice extraction service.",
};

export default function TermsPage() {
  return (
    <section className="px-4 py-24 md:py-32">
      <div className="container mx-auto max-w-3xl">
        <p className="mb-2 text-sm font-semibold tracking-widest uppercase text-primary">
          Legal
        </p>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight">
          Terms of Service
        </h1>
        <p className="mb-10 text-sm text-muted-foreground">
          Last updated: March 9, 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mb-3 [&_h2]:mt-0">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using InvoiceExtract (&quot;the Service&quot;), you
              agree to be bound by these Terms of Service. If you do not agree
              to these terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2>2. Description of Service</h2>
            <p>
              InvoiceExtract is an AI-powered invoice data extraction platform.
              Users can upload invoice documents (PDF, PNG, JPEG) and receive
              structured data output including line items, totals, vendor
              details, and other invoice fields.
            </p>
          </section>

          <section>
            <h2>3. User Accounts</h2>
            <p>
              To use the Service, you must create an account through our
              authentication provider. You are responsible for maintaining the
              security of your account and for all activities that occur under
              your account. You must provide accurate and complete information
              when creating your account.
            </p>
          </section>

          <section>
            <h2>4. Credits and Payment</h2>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>
                New accounts receive 5 free credits upon signup.
              </li>
              <li>
                Each page processed consumes 1 credit (1 credit = 1 page).
              </li>
              <li>
                Credits are non-transferable and non-refundable unless
                otherwise required by applicable law.
              </li>
              <li>
                We reserve the right to modify credit pricing and allocation
                at any time with reasonable notice.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>
                Upload documents containing malware, viruses, or malicious
                content
              </li>
              <li>
                Use the Service for any illegal purpose or to process
                fraudulent documents
              </li>
              <li>
                Attempt to reverse-engineer, decompile, or access the
                underlying AI models
              </li>
              <li>
                Circumvent or attempt to circumvent any usage limits, credit
                restrictions, or security measures
              </li>
              <li>
                Use automated systems or bots to access the Service without
                our prior written consent
              </li>
              <li>
                Share your account credentials with third parties
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Uploaded Content</h2>
            <p>
              You retain ownership of all documents you upload to the Service.
              By uploading a document, you grant us a limited, non-exclusive
              license to process the document for the purpose of providing the
              extraction service. We do not claim ownership of your uploaded
              documents or the extracted data.
            </p>
          </section>

          <section>
            <h2>7. Accuracy and Limitations</h2>
            <p>
              While we strive for high extraction accuracy, AI-based processing
              is not perfect. The Service provides extracted data on an
              &quot;as-is&quot; basis. You are responsible for reviewing and verifying
              the accuracy of extracted data before using it for any business,
              financial, or legal purpose. We are not liable for errors in
              extracted data.
            </p>
          </section>

          <section>
            <h2>8. Service Availability</h2>
            <p>
              We strive to maintain high availability but do not guarantee
              uninterrupted access to the Service. We may temporarily suspend
              or limit access for maintenance, updates, or unforeseen
              circumstances. We will make reasonable efforts to provide advance
              notice of planned downtime.
            </p>
          </section>

          <section>
            <h2>9. Intellectual Property</h2>
            <p>
              The Service, including its design, features, code, and AI models,
              is owned by InvoiceExtract and protected by intellectual property
              laws. You may not copy, modify, distribute, or create derivative
              works based on the Service without our prior written consent.
            </p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, InvoiceExtract shall not
              be liable for any indirect, incidental, special, consequential,
              or punitive damages resulting from your use of the Service,
              including but not limited to loss of data, loss of profits, or
              business interruption.
            </p>
          </section>

          <section>
            <h2>11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any
              time for violation of these Terms. You may delete your account at
              any time. Upon termination, your right to use the Service ceases
              immediately, and we may delete your account data in accordance
              with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2>12. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you
              of material changes by posting the updated terms on this page. Your
              continued use of the Service after changes are posted constitutes
              acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2>13. Contact</h2>
            <p>
              If you have questions about these Terms of Service, please
              contact us through the contact form on our website.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
