import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Watchlist from "@/pages/watchlist";
import Alerts from "@/pages/alerts";
import Agent from "@/pages/agent";
import SignalDetail from "@/pages/signal-detail";
import Audit from "@/pages/audit";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/watchlist" component={Watchlist} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/agent" component={Agent} />
        <Route path="/signal/:asset" component={SignalDetail} />
        <Route path="/audit/:asset" component={Audit} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="dark">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
