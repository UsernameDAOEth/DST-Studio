import { Link } from "wouter";
import { TerminalSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <Card className="max-w-md w-full border-border bg-card">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <TerminalSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">404 NOT FOUND</h1>
          <p className="text-muted-foreground font-mono text-sm mb-6">
            ERR_INVALID_ROUTE: The requested interface path does not exist in the DST terminal.
          </p>
          <Link href="/">
            <div className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-sm hover:bg-primary/90 transition-colors cursor-pointer">
              RETURN TO DASHBOARD
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
