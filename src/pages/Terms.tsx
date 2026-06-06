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
        <h1 className="text-3xl font-bold text-primary mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Placeholder — final legal text will be provided in a follow-up.</p>
        <Card className="p-6 sm:p-8 rounded-3xl border-border/50 shadow-soft">
          <p className="text-sm text-muted-foreground leading-relaxed">
            These Terms of Service are a placeholder. The final version will outline the rules and guidelines
            for using Saver's Pantry, including user responsibilities, disclaimers, and limitation of liability.
          </p>
        </Card>
      </div>
    </main>
  );
};

export default Terms;
