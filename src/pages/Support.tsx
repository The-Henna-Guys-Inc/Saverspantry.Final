import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { HelpCircle, Mail, MessageSquareQuestion, Bug } from "lucide-react";

const Support = () => {
  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="container max-w-3xl mx-auto px-6 py-6 sm:py-10">
        <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-widest mb-2">
          <HelpCircle className="h-3.5 w-3.5" /> Support
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Support</h1>
        <p className="text-muted-foreground mb-8">
          Need help with Saver's Pantry? We're here for you.
        </p>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-primary">Get in Touch</h2>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-1">
            Email: support@saverspantry.com
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We typically respond within 1-2 business days.
          </p>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <MessageSquareQuestion className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">How does the ingredient swap engine work?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Saver's Pantry uses AI to find ingredients that match the nutrition profile, cooking properties, and cuisine of what you originally chose, while saving you money.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Are the deals you show paid placements?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                No. All deals are sourced directly from grocer flyers and public promotions. We never accept paid placements.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">How current are the deals?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Most deals are refreshed weekly. We mark expiry dates on each deal.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Why don't I see deals in my area?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                We're currently launching in Chicagoland and Peoria, IL. If you're elsewhere, join our waitlist on the deals page and we'll let you know when we expand to your area.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">How do I delete my account?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Go to Settings → Account → Delete Account. Your data is permanently removed within 30 days.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Is my data sold or shared?</h3>
              <p className="text-sm text-foreground/80 leading-relaxed">
                No. We don't sell user data. See our Privacy Policy for details.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-border/50 shadow-soft">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
              <Bug className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-primary">Bug Reports & Feature Requests</h2>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Email support@saverspantry.com with the subject "Bug" or "Feature Request" and we'll respond within a few business days.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default Support;
