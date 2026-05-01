import { Link, useLocation } from "wouter";
import { Activity, Bell, Eye, MessageSquare, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const navItems = [
    { href: "/", icon: Activity, label: "Dashboard" },
    { href: "/watchlist", icon: Eye, label: "Watchlist" },
    { href: "/alerts", icon: Bell, label: "Alerts" },
    { href: "/agent", icon: MessageSquare, label: "Agent" },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg tracking-tight">DST TERMINAL</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border text-xs text-muted-foreground mono-nums">
          SYSTEM_READY
          <br />
          v0.1.0-alpha
        </div>
      </div>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 h-full">{children}</div>
      </main>
    </div>
  );
}
