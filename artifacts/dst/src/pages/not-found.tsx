import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="max-w-md w-full border border-border bg-card p-8 flex flex-col items-center text-center">
        <h1 className="text-3xl font-display font-bold text-foreground mb-2">404 NOT FOUND</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase mb-8">
          ERR_INVALID_ROUTE: THE REQUESTED INTERFACE PATH DOES NOT EXIST IN THE DST TERMINAL.
        </p>
        <Link href="/">
          <div className="px-6 py-3 border border-border text-foreground font-mono text-sm uppercase hover:border-primary hover:text-primary transition-colors cursor-pointer inline-block">
            RETURN TO DASHBOARD
          </div>
        </Link>
      </div>
    </div>
  );
}
