import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { CalendarDays, Refrigerator, Utensils, Tag, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/planner", label: "Planner", Icon: CalendarDays },
  { to: "/pantry", label: "Pantry", Icon: Refrigerator },
  { to: "/cook", label: "Cook", Icon: Utensils },
  { to: "/deals", label: "Deals", Icon: Tag },
  { to: "/dashboard", label: "Stats", Icon: BarChart3 },
];

export const MobileTabBar = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  // Hide on auth page or when signed out
  if (loading || !user || pathname.startsWith("/auth")) return null;

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-md border-t border-border/60 safe-bottom"
    >
      <ul className="grid grid-cols-5">
        {tabs.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[56px] text-[11px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
