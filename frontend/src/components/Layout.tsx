import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Reclamos", end: true },
  { to: "/claims/new", label: "Nuevo reclamo" },
  { to: "/analytics", label: "Analitica" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b bg-card px-7 py-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
            RP
          </span>
          <div>
            <h1 className="text-sm font-semibold">Reclamos Postventa</h1>
            <p className="text-xs text-muted-foreground">Sistema NoSQL - MongoDB + Neo4j</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                cn(
                  "rounded-lg border border-transparent px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  isActive && "border-border bg-accent text-accent-foreground"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-7 py-7">
        <Outlet />
      </main>
    </div>
  );
}
