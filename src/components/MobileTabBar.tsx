import { NavLink } from "react-router-dom";
import { CalendarDays, Refrigerator, Tag, BarChart3, BookmarkCheck } from "lucide-react";

const tabs = [
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/pantry", label: "Pantry", icon: Refrigerator },
  { to: "/sales", label: "Sales", icon: Tag },
  { to: "/dashboard", label: "Stats", icon: BarChart3 },
  { to: "/library", label: "Library", icon: BookmarkCheck },
];

export const MobileTabBar = () => (
  <nav
    className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-md border-t border-border/60 pb-[env(safe-area-inset-bottom)]"
    aria-label="Primary"
  >
    <ul className="grid grid-cols-5 h-16">
      {tabs.map(({ to, label, icon: Icon }) => (
        <li key={to} className="flex">
          <NavLink
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-smooth ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? "scale-110" : ""}`} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);
