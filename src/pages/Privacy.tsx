import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const Privacy = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <ScrollText className="h-3.5 w-3.5" /> Legal
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Privacy Policy</h1>
        <p className="text-xs text-muted-foreground mb-8">
          Effective Date: May 26, 2026 &middot; Last Updated: May 26, 2026
        </p>

        <Card className="p-6 sm:p-8 rounded-3xl border-border/50 shadow-soft space-y-6 text-sm sm:text-[15px] leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">1. Introduction</h2>
            <p className="mb-3">
              Welcome to Saver's Pantry. We are committed to protecting your privacy and being transparent
              about how we collect, use, and protect your information. This Privacy Policy explains our
              practices regarding your personal data when you use our mobile application and website
              (collectively, the "Service").
            </p>
            <p className="mb-3">
              By using Saver's Pantry, you agree to the practices described in this policy. If you do not
              agree with our practices, please do not use the Service.
            </p>
            <p className="mb-2">This policy applies to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The Saver's Pantry mobile application on iOS and Android</li>
              <li>The www.saverspantry.com website</li>
              <li>Any related services we provide</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">2. Information We Collect</h2>

            <h3 className="text-base font-semibold text-foreground mt-2 mb-2">2.1 Information You Provide Directly</h3>
            <p className="mb-2">When you create an account and use Saver's Pantry, we collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Name</strong> — used to personalize your experience.</li>
              <li><strong>Email address</strong> — used for account authentication, account recovery, and important service communications.</li>
              <li><strong>Password</strong> — encrypted using industry-standard hashing (handled by our authentication provider, Supabase); we never see or store your plaintext password.</li>
              <li><strong>Sign-In with Apple or Google credentials</strong> — if you choose these methods, we receive your name and email from Apple or Google (subject to your choices on those platforms, including Apple's "Hide My Email" feature).</li>
              <li><strong>ZIP code or general location</strong> — used to show you grocery deals relevant to your area.</li>
              <li><strong>Food preferences, dietary restrictions, and cuisine selections</strong> — used to personalize recipe and ingredient swap recommendations.</li>
              <li>Pantry contents you choose to track.</li>
              <li>Meal plans, saved swaps, and grocery lists you create.</li>
              <li>Feedback, support requests, and other communications you send us.</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-5 mb-2">2.2 Information Collected Automatically</h3>
            <p className="mb-2">When you use the Service, we automatically collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Device information</strong> — device type, operating system version, unique device identifiers, and mobile network information.</li>
              <li><strong>Usage data</strong> — which features you use, how often, screens viewed, time spent in the app, and interaction patterns.</li>
              <li><strong>Log data</strong> — IP address, browser type, access times, pages visited, and the page you visited before navigating to our Service.</li>
              <li><strong>Cookies and similar technologies</strong> — used for authentication, session management, and analytics (described in Section 7).</li>
              <li><strong>Crash reports</strong> — anonymous diagnostic information sent when the app encounters errors, used to fix bugs.</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-5 mb-2">2.3 Information We Do NOT Collect</h3>
            <p className="mb-2">We want to be clear about what we don't collect:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>We do not collect precise GPS location — only approximate location based on ZIP code.</li>
              <li>We do not access your contacts, photos, or other personal device data unless you explicitly grant permission (e.g., camera for barcode scanning).</li>
              <li>We do not collect financial or payment information — Saver's Pantry is currently a free service.</li>
              <li>We do not collect health or medical data.</li>
              <li>We do not collect data from users under 13 (see Section 9).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Provide and operate the Service, including authenticating your account and personalizing your experience.</li>
              <li>Generate recipe and ingredient swap recommendations based on your preferences.</li>
              <li>Show you grocery deals relevant to your location.</li>
              <li>Send you transactional emails (e.g., password reset, account-related notifications).</li>
              <li>Communicate with you about your account, new features, or updates to the Service.</li>
              <li>Improve the Service by analyzing usage patterns and fixing bugs.</li>
              <li>Protect the security of our users and the Service, including preventing fraud and abuse.</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p className="mb-2">We do NOT use your information to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Sell your data to third parties.</li>
              <li>Show you ads from advertisers.</li>
              <li>Build profiles for advertising purposes.</li>
              <li>Discriminate in any way.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">4. How We Share Your Information</h2>
            <p className="mb-3">
              We share information with third parties only as necessary to provide the Service. The third
              parties we use are:
            </p>

            <h3 className="text-base font-semibold text-foreground mt-2 mb-2">4.1 Service Providers</h3>
            <p className="mb-2">We share data with the following service providers, each bound by their own privacy practices:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Supabase</strong> — provides database hosting and authentication infrastructure (<a className="text-primary underline" href="https://supabase.com/privacy" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Anthropic</strong> — provides the AI engine that powers our recipe generator, ingredient swap engine, and nutrition lookup. Anthropic does not train its models on customer data sent through its API (<a className="text-primary underline" href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Google</strong> — provides Sign In with Google (if you choose) and Google Places API for store information (<a className="text-primary underline" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Apple</strong> — provides Sign In with Apple (if you choose) and supports iOS app distribution (<a className="text-primary underline" href="https://www.apple.com/legal/privacy/en-ww/" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>PostHog</strong> — provides analytics so we can understand how users interact with the app and improve it (<a className="text-primary underline" href="https://posthog.com/privacy" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Sentry</strong> — provides error and crash reporting so we can fix bugs (<a className="text-primary underline" href="https://sentry.io/privacy/" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Resend</strong> — sends transactional emails (e.g., password resets) on our behalf (<a className="text-primary underline" href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">privacy</a>).</li>
              <li><strong>Lovable / Vercel</strong> — provides hosting infrastructure for our application (<a className="text-primary underline" href="https://lovable.dev/privacy" target="_blank" rel="noreferrer">privacy</a>).</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-5 mb-2">4.2 Legal Disclosures</h3>
            <p>
              We may disclose your information if required to do so by law, such as in response to a valid
              subpoena, court order, or government request, or when we believe disclosure is necessary to
              protect our rights, your safety, or the safety of others.
            </p>

            <h3 className="text-base font-semibold text-foreground mt-5 mb-2">4.3 Business Transfers</h3>
            <p>
              If Saver's Pantry is acquired by, merges with, or is sold to another company, your information
              may be transferred as part of that transaction. We will notify you via email and/or a prominent
              notice on our Service before your information is transferred and becomes subject to a
              different privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">5. Data Retention</h2>
            <p className="mb-2">
              We retain your information for as long as your account is active or as needed to provide the
              Service. When you delete your account:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Your personal data is permanently deleted from our systems within 30 days.</li>
              <li>Anonymized analytics data may be retained for service improvement, but cannot be linked back to you.</li>
              <li>We may retain certain information if required by law (e.g., for tax or audit purposes).</li>
            </ul>
            <p>
              To delete your account, go to <strong>Settings → Account → Delete Account</strong> in the app,
              or contact us at <a className="text-primary underline" href="mailto:support@saverspantry.com">support@saverspantry.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">6. Data Security</h2>
            <p className="mb-2">We use industry-standard security measures to protect your information, including:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Encryption in transit using HTTPS/TLS for all data exchanged with our servers.</li>
              <li>Encryption at rest for data stored in our database (provided by Supabase).</li>
              <li>Hashed passwords (we never store passwords in plaintext).</li>
              <li>Access controls limiting who at Saver's Pantry can access user data (currently, only the founding team).</li>
              <li>Regular security updates and dependency patching.</li>
            </ul>
            <p>
              However, no method of transmission over the internet is 100% secure. While we strive to
              protect your personal information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">7. Cookies and Tracking Technologies</h2>
            <p className="mb-2">We use the following types of cookies and similar technologies:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Essential cookies</strong> — required for authentication and core app functionality; cannot be disabled.</li>
              <li><strong>Analytics cookies</strong> — provided by PostHog; help us understand how users interact with the Service so we can improve it; can be opted out (contact support@saverspantry.com).</li>
            </ul>
            <p className="mb-2">We do NOT use:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Advertising cookies.</li>
              <li>Third-party tracking cookies for ads.</li>
              <li>Cross-site behavioral tracking.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">8. Your Rights and Choices</h2>
            <p className="mb-3">You have the following rights regarding your personal information:</p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.1 Access and Portability</h3>
            <p className="mb-3">
              You can access and review your personal information at any time by signing into your account.
              To request a complete copy of your data in machine-readable format, email <a className="text-primary underline" href="mailto:support@saverspantry.com">support@saverspantry.com</a>.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.2 Correction</h3>
            <p className="mb-3">
              You can update most of your information directly in the app via Settings. For information you
              cannot edit, email support@saverspantry.com.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.3 Deletion</h3>
            <p className="mb-3">
              You can delete your account at any time via Settings → Account → Delete Account. This
              permanently removes your personal data from our systems within 30 days.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.4 Opt-Out of Communications</h3>
            <p className="mb-3">
              You can opt out of marketing emails using the unsubscribe link in any marketing email. Note:
              you cannot opt out of transactional emails (password resets, security alerts) while you have
              an active account.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.5 California Residents (CCPA)</h3>
            <p className="mb-3">
              If you are a California resident, you have additional rights under the California Consumer
              Privacy Act (CCPA), including the right to know what personal information is collected, the
              right to know whether personal information is sold or disclosed, the right to opt out of the
              sale of personal information (we do not sell personal information), and the right to equal
              service and price even if you exercise your privacy rights.
            </p>

            <h3 className="text-base font-semibold text-foreground mb-2">8.6 European Users (GDPR)</h3>
            <p>
              If you are in the European Economic Area, United Kingdom, or Switzerland, you have rights
              under the General Data Protection Regulation (GDPR), including the right to access, correct,
              delete, or restrict processing of your personal data; the right to data portability; and the
              right to lodge a complaint with a supervisory authority.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">9. Children's Privacy</h2>
            <p className="mb-3">
              Saver's Pantry is not intended for users under the age of 13. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and believe your
              child has provided us with personal information, please contact us at
              support@saverspantry.com so we can remove the information.
            </p>
            <p>For users between 13 and 18, we recommend using the Service with parental supervision.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">10. International Data Transfers</h2>
            <p>
              Saver's Pantry is based in the United States. If you access the Service from outside the
              United States, your information will be transferred to and processed in the United States,
              which has different data protection laws than your country. By using the Service, you consent
              to this transfer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">11. Changes to This Privacy Policy</h2>
            <p className="mb-2">
              We may update this Privacy Policy from time to time to reflect changes in our practices or for
              legal, operational, or regulatory reasons. When we make material changes:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>We will update the "Last Updated" date at the top of this policy.</li>
              <li>We will notify you via email or a prominent notice in the app at least 30 days before the changes take effect.</li>
              <li>Continued use of the Service after changes take effect constitutes acceptance of the updated policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">12. Contact Us</h2>
            <p className="mb-2">
              If you have questions, concerns, or requests regarding this Privacy Policy or your personal
              information, please contact us:
            </p>
            <p className="mb-1">
              <strong>Email:</strong> <a className="text-primary underline" href="mailto:support@saverspantry.com">support@saverspantry.com</a>
            </p>
            <p className="mb-3">
              <strong>Website:</strong> <a className="text-primary underline" href="https://www.saverspantry.com" target="_blank" rel="noreferrer">https://www.saverspantry.com</a>
            </p>
            <p className="text-muted-foreground text-sm">We will respond to privacy-related inquiries within 5 business days.</p>
          </section>
        </Card>
      </div>
    </main>
  );
};

export default Privacy;
