import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { HelpCircle, Mail, MessageSquare, Bug, Sparkles } from "lucide-react";

type QA = { q: string; a: React.ReactNode };

const SECTIONS: { title: string; items: QA[] }[] = [
  {
    title: "Getting Started",
    items: [
      {
        q: "How does the ingredient swap engine work?",
        a: "Tell us what ingredient you cook with (like \"chicken thighs\" or \"basmati rice\"), and our AI will suggest alternatives that match the same nutrition profile, cooking properties, and cuisine. The goal is to help you save money without losing taste or nutritional value.",
      },
      {
        q: "What cuisines does Saver's Pantry support?",
        a: "Currently, we support 8+ major cuisines including Indian, Mexican, Italian, Chinese, Thai, Mediterranean, American, and Vietnamese. We continue adding more based on user demand.",
      },
      {
        q: "Do I need an account to use Saver's Pantry?",
        a: "Yes. An account lets us save your preferences, pantry items, meal plans, and saved swaps so they persist across sessions and devices.",
      },
    ],
  },
  {
    title: "Deals & Stores",
    items: [
      {
        q: "Are the deals you show paid placements?",
        a: "No. All deals are sourced directly from publicly available grocery flyers and promotions. We never accept paid placements. Our goal is to help you save real money, not to push promoted products.",
      },
      {
        q: "How current are the deals?",
        a: "Most deals are refreshed weekly. Each deal shows an expiry date so you know how long the price is valid. We do our best to keep deals current, but prices and availability are ultimately controlled by individual stores.",
      },
      {
        q: "Why don't I see deals in my area?",
        a: "Saver's Pantry is rolling out across the U.S., but our deals are community-sourced and curated by our small team, so coverage in some areas is still thin. If you don't see many deals near you yet, it just means we're still building up local sources. We're working hard behind the scenes, and deals should start showing up in your area soon. You can help by submitting deals you spot locally or by adding your ZIP to the waitlist on the Deals page so we know where to prioritize next.",
      },
      {
        q: "How do you decide which stores to feature?",
        a: "We focus on local specialty grocers and value-focused supermarkets that serve diverse communities. We feature stores across multiple cuisines (South Asian, Mexican, East Asian, Middle Eastern, mainstream) to serve a range of cooking traditions.",
      },
      {
        q: "What if a deal is wrong or expired?",
        a: "Email us at support@saverspantry.com with the deal details. We'll review and update or remove it. We rely on user reports to keep deals accurate, so thank you for telling us.",
      },
    ],
  },
  {
    title: "Account & Privacy",
    items: [
      {
        q: "How do I delete my account?",
        a: "Open the app and go to Settings → Account → Delete Account. Confirm the action when prompted. Your data is permanently removed from our systems within 30 days.",
      },
      {
        q: "Is my data sold or shared?",
        a: (
          <>
            No, we never sell your data. We share limited data only with service providers necessary to
            operate the app (like our database host and AI provider). Full details are in our{" "}
            <a className="text-primary underline" href="/privacy">Privacy Policy</a>.
          </>
        ),
      },
      {
        q: "Can I export my data?",
        a: "Yes. Email support@saverspantry.com requesting a data export, and we'll send you a complete copy of your account data in machine-readable format within 5 business days.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "On the sign-in screen, tap \"Forgot Password.\" Enter your email and we'll send you a reset link. If you don't see the email, check your spam folder.",
      },
      {
        q: "I signed in with Apple or Google. How do I recover my account?",
        a: "Sign in using the same Apple or Google account you originally used. If you've lost access to that account, contact support@saverspantry.com so we can help.",
      },
    ],
  },
  {
    title: "Recipes & Nutrition",
    items: [
      {
        q: "Are the recipes safe for people with allergies?",
        a: "Our recipes are AI-generated and may contain errors. Always verify ingredient lists for allergens before cooking. If you have severe allergies, double-check every ingredient and consult a doctor or dietitian for dietary advice. Saver's Pantry is not a substitute for professional medical or nutritional guidance.",
      },
      {
        q: "Are the nutrition numbers accurate?",
        a: "Nutrition information is sourced from public databases and AI estimation. It's accurate to within typical ranges for most foods but should be considered approximate, especially for prepared dishes. Don't rely on it for strict medical dietary needs without verification.",
      },
      {
        q: "The AI gave me a weird recipe. What do I do?",
        a: "AI can occasionally produce odd suggestions, especially for unusual ingredient combinations. If a recipe seems off, generate a new one. We'd love feedback — email examples to support@saverspantry.com so we can improve the system.",
      },
    ],
  },
  {
    title: "Technical Issues",
    items: [
      {
        q: "The app is slow or freezing.",
        a: "Try closing and reopening the app. If issues persist, restart your device. Still having problems? Email us with your device model, operating system version, and a description of what you were doing when the issue happened.",
      },
      {
        q: "I can't sign in.",
        a: "First, confirm your email and password are correct. Try \"Forgot Password\" if needed. If you're using Apple or Google sign-in and it's not working, try email/password as a backup. Email support if issues continue.",
      },
      {
        q: "The app crashed.",
        a: "We automatically receive anonymized crash reports, but it helps if you email us with what you were doing when it crashed. Include the screen you were on and any steps that lead to the crash.",
      },
    ],
  },
  {
    title: "Feedback & Suggestions",
    items: [
      {
        q: "How do I suggest a new feature?",
        a: "Email support@saverspantry.com with the subject line \"Feature Request.\" Tell us what problem the feature would solve for you. We read every suggestion and use them to prioritize what to build next.",
      },
      {
        q: "How do I report a bug?",
        a: "Email support@saverspantry.com with the subject line \"Bug.\" Include your device, app version, what you did, what you expected to happen, and what actually happened. Screenshots help.",
      },
      {
        q: "How can I help Saver's Pantry grow?",
        a: "Three ways: (1) Tell friends and family who would benefit. (2) Submit local store deals you know about. (3) Email us feedback — even short notes help us improve. We're a small, founder-run team and every piece of feedback shapes what we build.",
      },
    ],
  },
];

const Support = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <HelpCircle className="h-3.5 w-3.5" /> Support
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-2">Support</h1>
        <p className="text-muted-foreground mb-8 text-sm sm:text-base">
          Welcome to Saver's Pantry Support. We're here to help you save more on groceries and get the most
          out of the app.
        </p>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">Get in Touch</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-2">
            The fastest way to reach us is by email:
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed mb-1">
            <strong>Email:</strong>{" "}
            <a className="text-primary underline" href="mailto:support@saverspantry.com">
              support@saverspantry.com
            </a>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            <strong>Response time:</strong> Within 1-2 business days (we're a small team and we read every
            message personally).
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed mb-1">When emailing, please include:</p>
          <ul className="list-disc pl-6 text-sm text-foreground/80 space-y-1">
            <li>A clear subject line ("Bug," "Feature Request," "Account Help," or "Question").</li>
            <li>Your device type (iPhone, Android, web browser).</li>
            <li>App version (find this in Settings → About).</li>
            <li>A description of what happened and what you expected.</li>
            <li>Screenshots if applicable.</li>
          </ul>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-6">
            {SECTIONS.map((sec) => (
              <div key={sec.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-accent mb-3">
                  {sec.title}
                </h3>
                <div className="space-y-4">
                  {sec.items.map((item, i) => (
                    <div key={i}>
                      <p className="text-sm font-semibold text-foreground mb-1">Q: {item.q}</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">A: {item.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Bug className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">Bug Reports & Feature Requests</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Email{" "}
            <a className="text-primary underline" href="mailto:support@saverspantry.com">
              support@saverspantry.com
            </a>{" "}
            with the subject "Bug" or "Feature Request" and we'll respond within a few business days.
          </p>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">About Saver's Pantry</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-3">
            Saver's Pantry is built by a solo founder in Central Illinois who wanted to help families save
            real money on groceries without giving up the foods and flavors they love. The app launched in
            2026 in Chicagoland and Peoria, Illinois, with plans to expand based on user demand.
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            We're independent, ad-free, and never accept paid placements. Our growth depends on users who
            find the app genuinely useful and share it with others.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default Support;
