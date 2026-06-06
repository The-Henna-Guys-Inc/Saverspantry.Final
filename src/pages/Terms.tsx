import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { ScrollText } from "lucide-react";

const Terms = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <ScrollText className="h-3.5 w-3.5" /> Legal
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Terms of Service</h1>
        <p className="text-xs text-muted-foreground mb-8">
          Effective Date: May 26, 2026 &middot; Last Updated: May 26, 2026
        </p>

        <Card className="p-6 sm:p-8 rounded-3xl border-border/50 shadow-soft space-y-6 text-sm sm:text-[15px] leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">1. Agreement to Terms</h2>
            <p className="mb-3">
              Welcome to Saver's Pantry. These Terms of Service ("Terms") form a legally binding agreement
              between you and Saver's Pantry ("we," "us," or "our") governing your access to and use of our
              mobile application and website (collectively, the "Service").
            </p>
            <p>
              By creating an account, downloading our app, or otherwise using the Service, you agree to be
              bound by these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">2. Eligibility</h2>
            <p className="mb-2">
              You must be at least 13 years old to use Saver's Pantry. By using the Service, you represent
              and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You are at least 13 years of age.</li>
              <li>If you are under 18, you are using the Service with the involvement and consent of a parent or legal guardian.</li>
              <li>You have the legal capacity to enter into these Terms.</li>
              <li>You will use the Service in compliance with these Terms and all applicable laws.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">3. Your Account</h2>
            <p className="mb-2">To use most features of the Service, you must create an account. You agree to:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Provide accurate, current, and complete information when creating your account.</li>
              <li>Keep your account information up to date.</li>
              <li>Maintain the security and confidentiality of your password.</li>
              <li>Be responsible for all activity that occurs under your account.</li>
              <li>Notify us immediately if you suspect unauthorized use of your account.</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms or are used in
              ways that harm our Service or other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">4. The Service</h2>

            <h3 className="text-base font-semibold text-foreground mb-2">4.1 What Saver's Pantry Provides</h3>
            <p className="mb-2">Saver's Pantry is a grocery savings and meal planning service that helps users:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Find ingredient alternatives that match nutrition profile, cooking properties, and cuisine.</li>
              <li>Generate AI-powered recipes based on user preferences.</li>
              <li>Plan meals and create grocery lists.</li>
              <li>Track pantry contents.</li>
              <li>Discover weekly deals from participating grocery stores in supported areas.</li>
              <li>Look up nutritional information for foods.</li>
            </ul>

            <h3 className="text-base font-semibold text-foreground mt-5 mb-2">4.2 No Guarantees</h3>
            <p className="mb-2">
              While we work hard to provide accurate, helpful, and high-quality content, you acknowledge
              and agree that:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Grocery deals shown in the app are sourced from publicly available flyers and promotions. Prices, availability, and terms are subject to change at the retailer's discretion. We do not guarantee that any deal will be available at any specific time or price.</li>
              <li>Nutrition information is provided for general reference only and is not a substitute for professional medical, dietary, or nutritional advice. Consult a qualified healthcare provider before making dietary decisions, especially if you have allergies, medical conditions, or specific dietary needs.</li>
              <li>Recipes and ingredient swap suggestions are generated using AI and may contain errors, omissions, or unsuitable recommendations for your specific needs. You are responsible for verifying recipes, checking ingredients for allergens, and ensuring food safety in your own kitchen.</li>
              <li>Cuisine classifications, dietary tags (vegetarian, halal, kosher, etc.), and ingredient categorizations are best-effort and may contain inaccuracies. Verify with primary sources if you have strict dietary requirements.</li>
              <li>Store information (addresses, hours, contact details) may change without notice. We are not responsible for outdated store information.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">5. Acceptable Use</h2>
            <p className="mb-2">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any laws.</li>
              <li>Impersonate any person or entity, or falsely state or misrepresent your affiliation with a person or entity.</li>
              <li>Interfere with or disrupt the Service or servers connected to the Service.</li>
              <li>Attempt to gain unauthorized access to any part of the Service or other accounts.</li>
              <li>Use automated means (bots, scrapers, etc.) to access or collect data from the Service without our express written permission.</li>
              <li>Upload viruses, malicious code, or other harmful content.</li>
              <li>Reverse engineer, decompile, or attempt to extract source code from the Service.</li>
              <li>Use the Service to harass, abuse, threaten, or harm other users.</li>
              <li>Submit false reports about deals, stores, or content.</li>
              <li>Resell, redistribute, or commercialize any part of the Service without our written permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">6. User-Generated Content</h2>
            <p className="mb-2">
              The Service may allow you to submit content such as pantry items, meal plans, deal reports,
              store suggestions, feedback, or other materials ("User Content"). When you submit User Content:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You retain ownership of your User Content.</li>
              <li>You grant Saver's Pantry a non-exclusive, worldwide, royalty-free license to use, store, display, and process your User Content as needed to operate and improve the Service.</li>
              <li>You represent that you have all necessary rights to submit the content and that it does not violate any laws or third-party rights.</li>
              <li>We reserve the right to remove any User Content at our discretion, particularly if it violates these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">7. Intellectual Property</h2>
            <p className="mb-3">
              Saver's Pantry and all related content — including but not limited to the app's design, source
              code, brand name, logo, written materials, AI-generated recipes (subject to the terms below),
              and visual identity — are owned by us or our licensors and are protected by intellectual
              property laws.
            </p>
            <p className="mb-2">
              You are granted a limited, non-exclusive, non-transferable, revocable license to use the
              Service for personal, non-commercial purposes. This license does not include the right to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Modify, copy, distribute, or create derivative works of the Service.</li>
              <li>Use the Service for commercial purposes without our written consent.</li>
              <li>Use our brand name, logo, or trademarks without our written consent.</li>
            </ul>
            <p>
              Recipes generated by the AI for your personal use are yours to use freely in your home
              cooking. Commercial use of generated recipes (e.g., in a cookbook, restaurant menu, or paid
              newsletter) requires our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">8. Third-Party Services</h2>
            <p>
              Saver's Pantry integrates with third-party services (Supabase, Google, Apple, Anthropic,
              PostHog, etc.) as described in our Privacy Policy. Your use of these third-party services is
              subject to their own terms and privacy policies. We are not responsible for the practices of
              third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">9. Disclaimers</h2>
            <p className="mb-3 uppercase text-xs tracking-wide text-muted-foreground">
              The Service is provided "as is" and "as available," without warranties of any kind, either
              express or implied, including but not limited to implied warranties of merchantability,
              fitness for a particular purpose, and non-infringement.
            </p>
            <p className="mb-2">Without limiting the foregoing, Saver's Pantry does not warrant that:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>The Service will be uninterrupted, timely, secure, or error-free.</li>
              <li>The information provided through the Service (including deals, prices, recipes, nutrition info, and cuisine classifications) is accurate, complete, or current.</li>
              <li>Any errors in the Service will be corrected.</li>
              <li>The Service will meet your specific requirements.</li>
              <li>Any defects or bugs will be fixed within any particular timeframe.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">10. Limitation of Liability</h2>
            <p className="mb-3 uppercase text-xs tracking-wide text-muted-foreground">
              To the maximum extent permitted by applicable law, in no event shall Saver's Pantry, its
              officers, directors, employees, or agents be liable for any indirect, incidental, special,
              consequential, or punitive damages, including without limitation:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Loss of profits, data, use, goodwill, or other intangible losses.</li>
              <li>Damages resulting from your access to or use of, or inability to access or use, the Service.</li>
              <li>Damages resulting from any conduct or content of any third party on the Service.</li>
              <li>Damages resulting from any reliance you place on information provided by the Service, including but not limited to grocery prices, nutritional information, recipe instructions, or cuisine classifications.</li>
              <li>Damages resulting from allergic reactions, foodborne illness, or other health issues arising from following recipes or recommendations from the Service. You are responsible for verifying that recipes are safe for you and your household.</li>
            </ul>
            <p className="mb-3 uppercase text-xs tracking-wide text-muted-foreground">
              Our total liability to you for any claims arising out of or related to these Terms or the
              Service shall not exceed the amount you paid us in the 12 months preceding the claim (which,
              for free users, is zero dollars).
            </p>
            <p>
              Some jurisdictions do not allow the exclusion of certain warranties or limitation of certain
              damages, so some of the above limitations may not apply to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">11. Indemnification</h2>
            <p className="mb-2">
              You agree to indemnify and hold harmless Saver's Pantry, its officers, directors, employees,
              and agents from any claims, damages, losses, liabilities, costs, and expenses (including
              reasonable attorneys' fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your use or misuse of the Service.</li>
              <li>Your violation of these Terms.</li>
              <li>Your violation of any rights of another person or entity.</li>
              <li>Any User Content you submit.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">12. Termination</h2>
            <p className="mb-2">
              We may suspend or terminate your account and access to the Service at any time, with or
              without cause, with or without notice, including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>Violations of these Terms.</li>
              <li>Conduct that we believe harms other users, our Service, or third parties.</li>
              <li>Extended periods of inactivity.</li>
              <li>Legal or regulatory requirements.</li>
            </ul>
            <p className="mb-2">
              You may terminate your account at any time via <strong>Settings → Account → Delete Account</strong>. Upon termination:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your right to use the Service ceases immediately.</li>
              <li>Your personal data will be deleted as described in our Privacy Policy.</li>
              <li>Provisions of these Terms that by their nature should survive termination will survive (e.g., intellectual property, disclaimers, limitation of liability, indemnification, dispute resolution).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">13. Changes to the Service</h2>
            <p className="mb-2">
              We reserve the right to modify, suspend, or discontinue the Service (or any part of it) at
              any time, with or without notice. We are not liable to you or any third party for any
              modification, suspension, or discontinuance of the Service.
            </p>
            <p>
              We reserve the right to add or remove features, change pricing (if and when we introduce paid
              features), and adjust supported geographic areas at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">14. Changes to These Terms</h2>
            <p className="mb-2">We may revise these Terms from time to time. When we make material changes:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li>We will update the "Last Updated" date at the top of these Terms.</li>
              <li>We will notify you via email or a prominent notice in the app at least 30 days before the changes take effect.</li>
              <li>Continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</li>
            </ul>
            <p>If you do not agree to the updated Terms, you must stop using the Service and may delete your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">15. Governing Law and Dispute Resolution</h2>
            <p className="mb-3">
              These Terms are governed by the laws of the State of Illinois, United States, without regard
              to its conflict of laws principles.
            </p>
            <p className="mb-2">Any disputes arising out of or related to these Terms or the Service shall be resolved as follows:</p>
            <ul className="list-disc pl-6 space-y-1 mb-3">
              <li><strong>Step 1: Informal resolution.</strong> We encourage you to contact us at <a className="text-primary underline" href="mailto:support@saverspantry.com">support@saverspantry.com</a> first to discuss any concerns. Most issues can be resolved this way.</li>
              <li><strong>Step 2:</strong> If informal resolution fails, disputes shall be resolved exclusively in the state or federal courts located in Peoria County, Illinois, and you consent to the personal jurisdiction of these courts.</li>
            </ul>
            <p>You agree that any claim must be filed within one (1) year after the cause of action arises, or it will be permanently barred.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">16. Class Action Waiver</h2>
            <p>
              To the maximum extent permitted by law, you and Saver's Pantry agree that any dispute
              resolution proceedings will be conducted only on an individual basis and not in a class,
              consolidated, or representative action.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">17. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, the remaining
              provisions will remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">18. Entire Agreement</h2>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you
              and Saver's Pantry regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-primary mb-3">19. Contact</h2>
            <p className="mb-1">Questions about these Terms? Contact us:</p>
            <p className="mb-1"><strong>Email:</strong> <a className="text-primary underline" href="mailto:support@saverspantry.com">support@saverspantry.com</a></p>
            <p><strong>Website:</strong> <a className="text-primary underline" href="https://www.saverspantry.com" target="_blank" rel="noreferrer">https://www.saverspantry.com</a></p>
          </section>
        </Card>
      </div>
    </main>
  );
};

export default Terms;
