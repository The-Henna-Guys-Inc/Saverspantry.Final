import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";


const CREAM = "#FAF5EC";
const GREEN = "#1F5132";
const ESPRESSO = "#412402";
const MUTED = "#5F5E5A";
const CARD_BORDER = "rgba(31,81,50,0.12)";

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 20,
  padding: 24,
  border: `1px solid ${CARD_BORDER}`,
  boxShadow: "0 4px 20px -8px rgba(31,81,50,0.18)",
};

const PERKS = [
  { icon: "🍳", text: "Cuisine-aware recipes" },
  { icon: "📋", text: "Meal plans + grocery lists" },
  { icon: "🏪", text: "Curated deals at grocers near you" },
  { icon: "📦", text: "Pantry tracking with bulk-buy savings" },
];

const Welcome = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  return (
    <main className="min-h-[100dvh] flex items-start sm:items-center justify-center px-5 py-8" style={{ background: CREAM }}>
      <div className="w-full max-w-md space-y-5">
        <div className="flex justify-center">
          <BrandMark to="" size="lg" showTagline />
        </div>

        <div style={cardStyle} className="text-center">
          <h1 style={{ color: GREEN, fontWeight: 700, fontSize: 24, lineHeight: 1.2 }}>
            Save $100+ a month<br />on groceries
          </h1>
          <p className="mt-3" style={{ color: MUTED, fontSize: 15, lineHeight: 1.5 }}>
            Swap ingredients to save money — same nutrition, your cuisine, no guesswork.
          </p>
        </div>

        <div style={cardStyle}>
          <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, letterSpacing: 1.2 }}>
            FREE ACCOUNT PERKS
          </p>
          <ul className="mt-3 space-y-2.5">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-start gap-3" style={{ color: ESPRESSO, fontSize: 15 }}>
                <span aria-hidden className="text-xl leading-none shrink-0">{p.icon}</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            asChild
            className="w-full rounded-2xl text-white hover:opacity-90"
            style={{ height: 56, background: GREEN, fontSize: 16, fontWeight: 700 }}
          >
            <Link to="/demo">Try it — no account needed</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full rounded-2xl bg-white hover:bg-white/90"
            style={{ height: 56, fontSize: 16, fontWeight: 700, color: GREEN, borderColor: GREEN, borderWidth: 2 }}
          >
            <Link to="/auth?mode=signup">Create free account</Link>
          </Button>
          <p className="text-center pt-1" style={{ color: MUTED, fontSize: 14 }}>
            Already have an account?{" "}
            <Link to="/auth" className="underline hover:opacity-80" style={{ color: GREEN, fontWeight: 600 }}>
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </main>
  );
};

export default Welcome;
