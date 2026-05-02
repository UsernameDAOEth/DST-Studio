import { Link, useLocation } from "wouter";
import { Activity, Bell, Eye, MessageSquare, Settings, Cpu, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Activity, label: "DASHBOARD" },
    { href: "/hermes", icon: Cpu, label: "HERMES" },
    { href: "/watchlist", icon: Eye, label: "WATCHLIST" },
    { href: "/alerts", icon: Bell, label: "ALERTS" },
    { href: "/agent", icon: MessageSquare, label: "AGENT" },
    { href: "/integrations", icon: Settings, label: "INTEGRATIONS" },
    { href: "/evaluation", icon: BarChart2, label: "EVALUATION" },
  ];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 border-r border-border bg-sidebar flex-col">
        <div className="p-5 border-b border-border flex flex-col justify-center">
          <div className="font-display font-bold text-xl text-primary leading-none tracking-tight">DST</div>
          <div className="font-mono text-xs text-muted-foreground uppercase mt-1">SIGNAL LAYER</div>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-mono transition-colors cursor-pointer",
                    isActive
                      ? "border-l-2 border-primary text-primary bg-card"
                      : "border-l-2 border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground font-mono uppercase">
            DJZS AUDIT LAYER
            <div className="mt-1">v1.0.0-PROD</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-sidebar flex justify-around p-2 z-50">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex flex-col items-center justify-center p-2",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
