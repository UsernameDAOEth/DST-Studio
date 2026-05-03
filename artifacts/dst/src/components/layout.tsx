import { Link, useLocation } from "wouter";
import { Activity, Bell, Eye, MessageSquare, Settings, Cpu, BarChart2, Layers } from "lucide-react";
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
    { href: "/stack", icon: Layers, label: "THE STACK" },
  ];

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground font-mono">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-60 border-r border-border bg-sidebar flex-col">
        {/* Logo / Identity */}
        <div className="p-4 border-b border-border">
          <div className="font-mono font-bold text-lg text-primary leading-none tracking-widest glow-green">DST</div>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-widest mt-1.5 leading-tight">
            DETERMINISTIC SIGNAL TRADING
          </div>
          <div className="font-mono text-[8px] text-primary/50 uppercase tracking-widest mt-1 leading-tight">
            A DJZS SYSTEM MODULE
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-px">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer",
                    isActive
                      ? "border-l-2 border-primary text-primary bg-card"
                      : "border-l-2 border-transparent text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                  style={isActive ? { textShadow: "0 0 8px color-mix(in srgb, hsl(82 77% 48%) 40%, transparent)" } : undefined}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Footer — system identity strip */}
        <div className="p-4 border-t border-border">
          <div className="space-y-1">
            <div className="text-[8px] text-primary/70 font-mono uppercase tracking-widest font-bold">
              DST SIGNALS · DJZS AUDITS · HERMES RUNS
            </div>
            <div className="text-[8px] text-muted-foreground/50 font-mono uppercase tracking-widest mt-1 leading-tight">
              BUILT ON THE DETERMINISTIC SIMULATION THESIS
            </div>
            <div className="text-[8px] text-muted-foreground/30 font-mono uppercase tracking-widest mt-1">
              V1.0.0 · PAPER MODE · NO LIVE TRADING
            </div>
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
