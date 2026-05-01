import { useQueryClient } from "@tanstack/react-query";
import { useGetIntegrations, getGetIntegrationsQueryKey, useToggleIntegration } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function Integrations() {
  const queryClient = useQueryClient();
  const { data: integrations, isLoading } = useGetIntegrations();
  const toggleMutation = useToggleIntegration();

  const handleToggle = (name: string) => {
    toggleMutation.mutate({ name }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetIntegrationsQueryKey() });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="pb-4 border-b border-border">
        <h1 className="text-2xl font-display text-foreground mb-1">INTEGRATIONS</h1>
        <p className="text-muted-foreground font-mono text-xs uppercase">SYSTEM EXPANSION SCAFFOLD — PHASE 2 / 3 / 4</p>
      </div>

      <p className="text-body max-w-3xl leading-relaxed">
        The following integrations are scaffolded and ready for activation. Each is disabled by default and requires credentials or configuration. Enabling here toggles in-memory state only — no live connections are made until credentials are configured.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-1/2 bg-muted rounded-none" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full bg-muted rounded-none" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations?.map(integration => (
            <Card key={integration.name} className="border-border bg-card flex flex-col h-full hover:border-border/80 transition-colors">
              <CardHeader className="px-6 py-4 border-b border-border">
                <div className="flex justify-between items-start">
                  <div className="space-y-1.5">
                    <CardTitle className="text-lg font-display text-foreground">
                      {integration.displayName}
                    </CardTitle>
                    <span className="chip-neutral opacity-80">{integration.category}</span>
                  </div>
                  <span className="chip-neutral opacity-60 text-[10px]">{integration.phase}</span>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 flex-1 flex flex-col gap-4">
                <div className="flex items-center">
                  {integration.status === "ACTIVE" ? <span className="chip-pass">ACTIVE</span> :
                   integration.status === "DISABLED" ? <span className="chip-neutral">DISABLED</span> :
                   integration.status === "NOT_CONFIGURED" ? <span className="chip-warn">NOT_CONFIGURED</span> :
                   <span className="chip-neutral">{integration.status}</span>}
                </div>
                
                <p className="text-sm text-body leading-relaxed flex-1">
                  {integration.description}
                </p>

                <div className="space-y-2 pt-2">
                  {integration.envKeyRequired && (
                    <div className="text-xs font-mono text-destructive/80">
                      REQUIRES: {integration.envKeyRequired}
                    </div>
                  )}
                  {integration.docsUrl && (
                    <div>
                      <a href={integration.docsUrl} target="_blank" rel="noreferrer" className="text-xs font-mono text-primary hover:underline">
                        DOCS →
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="p-6 pt-0 mt-auto">
                <button
                  onClick={() => handleToggle(integration.name)}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "w-full py-2 font-mono text-xs uppercase transition-colors border",
                    integration.enabled 
                      ? "border-destructive text-destructive hover:bg-destructive/10" 
                      : "border-border text-foreground hover:border-primary hover:text-primary",
                    toggleMutation.isPending && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {integration.enabled ? "DISABLE" : "ENABLE"}
                </button>
              </CardFooter>
            </Card>
          ))}
          {integrations?.length === 0 && (
            <div className="col-span-1 md:col-span-2 p-8 text-center text-muted-foreground font-mono text-sm border border-border">
              NO INTEGRATIONS FOUND
            </div>
          )}
        </div>
      )}
    </div>
  );
}
