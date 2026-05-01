import { IntegrationStatus } from "@workspace/api-zod";

export const INTEGRATIONS = [
  {
    name: "hermes",
    displayName: "Hermes Scheduler",
    description: "15-minute recurring scan orchestration for all tracked assets. Triggers recompute, alert evaluation, and delivery on schedule.",
    category: "SCHEDULER",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: null,
    docsUrl: null,
    phase: "Phase 2",
  },
  {
    name: "pyth",
    displayName: "Pyth Network Price Feed",
    description: "High-frequency price confidence layer. Overlays Pyth confidence intervals on DST entry zones for more precise invalidation.",
    category: "PRICE_FEED",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "PYTH_ENDPOINT",
    docsUrl: "https://docs.pyth.network",
    phase: "Phase 2",
  },
  {
    name: "browserbase",
    displayName: "Browserbase Research",
    description: "Triggered web research for high-interest setups. Runs when confidence > 75 and verdict = APPROVED. Fetches recent news and on-chain narrative signals.",
    category: "RESEARCH",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "BROWSERBASE_API_KEY",
    docsUrl: "https://browserbase.com",
    phase: "Phase 2",
  },
  {
    name: "xmtp",
    displayName: "XMTP Alert Delivery",
    description: "Decentralized wallet-to-wallet message delivery for signal alerts. Sends APPROVED signals to subscribed wallet addresses.",
    category: "ALERTS",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "XMTP_PRIVATE_KEY",
    docsUrl: "https://xmtp.org",
    phase: "Phase 3",
  },
  {
    name: "telegram",
    displayName: "Telegram Bot Alerts",
    description: "Telegram bot delivery for APPROVED signal notifications. Sends formatted signal reports to a configured chat or group.",
    category: "ALERTS",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "TELEGRAM_BOT_TOKEN",
    docsUrl: "https://core.telegram.org/bots",
    phase: "Phase 3",
  },
  {
    name: "discord",
    displayName: "Discord Webhook Alerts",
    description: "Discord webhook delivery for signal and audit notifications. Posts embeds to a configured channel when APPROVED signals fire.",
    category: "ALERTS",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "DISCORD_WEBHOOK_URL",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    phase: "Phase 3",
  },
  {
    name: "mpp",
    displayName: "MPP Enrichment",
    description: "Paid market positioning and participant data enrichment layer. Adds institutional flow, options flow, and dark pool signals to high-confidence setups.",
    category: "ENRICHMENT",
    enabled: false,
    configured: false,
    status: "NOT_CONFIGURED",
    envKeyRequired: "MPP_API_KEY",
    docsUrl: null,
    phase: "Phase 4",
  },
];

// In-memory toggle store
const enabledStore: Record<string, boolean> = {};

export function getIntegrations() {
  return INTEGRATIONS.map((i) => ({
    ...i,
    enabled: enabledStore[i.name] ?? false,
    status: (enabledStore[i.name] ? "ACTIVE" : (i.configured ? "DISABLED" : "NOT_CONFIGURED")) as any,
  }));
}

export function toggleIntegration(name: string) {
  const integration = INTEGRATIONS.find((i) => i.name === name);
  if (!integration) return null;
  enabledStore[name] = !(enabledStore[name] ?? false);
  return {
    ...integration,
    enabled: enabledStore[name],
    status: (enabledStore[name] ? "ACTIVE" : (integration.configured ? "DISABLED" : "NOT_CONFIGURED")) as any,
  };
}
