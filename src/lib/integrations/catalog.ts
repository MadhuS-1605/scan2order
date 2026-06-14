// Catalogue of supported integrations. Pure module (no server deps) so the
// admin UI can import it. Credential fields are stored per-provider in
// Integration.config. Most are scaffolding ready for real API wiring; the
// "webhook" provider fires live on order events.

export type IntegrationCategory = "POS" | "PMS" | "ACCOUNTING" | "SSO" | "WEBHOOK";

export type IntegrationField = {
  key: string;
  label: string;
  type?: "text" | "password" | "url";
  placeholder?: string;
};

export type IntegrationProvider = {
  slug: string;
  name: string;
  category: IntegrationCategory;
  blurb: string;
  fields: IntegrationField[];
  live?: boolean; // true = actually does something now (webhook)
};

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  POS: "Point of sale",
  PMS: "Hotel property management",
  ACCOUNTING: "Accounting",
  SSO: "Single sign-on",
  WEBHOOK: "Webhooks & automation",
};

export const PROVIDERS: IntegrationProvider[] = [
  {
    slug: "webhook",
    name: "Outbound webhook",
    category: "WEBHOOK",
    blurb: "POST order events (created, paid) to your endpoint, Zapier or Make.",
    live: true,
    fields: [
      { key: "url", label: "Endpoint URL", type: "url", placeholder: "https://hooks.example.com/orders" },
      { key: "secret", label: "Signing secret (optional)", type: "password", placeholder: "sent as X-STO-Secret" },
    ],
  },
  {
    slug: "petpooja",
    name: "Petpooja",
    category: "POS",
    blurb: "Sync menu & push orders to your Petpooja POS.",
    fields: [
      { key: "appKey", label: "App key", placeholder: "from Petpooja dashboard" },
      { key: "appSecret", label: "App secret", type: "password" },
      { key: "restId", label: "Restaurant ID" },
    ],
  },
  {
    slug: "posist",
    name: "Posist",
    category: "POS",
    blurb: "Push orders & pull menu from Posist.",
    fields: [
      { key: "apiKey", label: "API key", type: "password" },
      { key: "outletId", label: "Outlet ID" },
    ],
  },
  {
    slug: "opera",
    name: "Oracle OPERA",
    category: "PMS",
    blurb: "Post room-service charges to a guest folio.",
    fields: [
      { key: "baseUrl", label: "OPERA Cloud base URL", type: "url" },
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", type: "password" },
      { key: "hotelId", label: "Hotel ID" },
    ],
  },
  {
    slug: "cloudbeds",
    name: "Cloudbeds",
    category: "PMS",
    blurb: "Sync room charges with Cloudbeds PMS.",
    fields: [
      { key: "apiKey", label: "API key", type: "password" },
      { key: "propertyId", label: "Property ID" },
    ],
  },
  {
    slug: "tally",
    name: "Tally",
    category: "ACCOUNTING",
    blurb: "Export daily sales vouchers to Tally Prime.",
    fields: [
      { key: "companyName", label: "Company name" },
      { key: "host", label: "Tally host:port", placeholder: "localhost:9000" },
    ],
  },
  {
    slug: "zoho-books",
    name: "Zoho Books",
    category: "ACCOUNTING",
    blurb: "Create sales invoices in Zoho Books.",
    fields: [
      { key: "orgId", label: "Organization ID" },
      { key: "clientId", label: "Client ID" },
      { key: "clientSecret", label: "Client secret", type: "password" },
    ],
  },
  {
    slug: "google-sso",
    name: "Google Workspace SSO",
    category: "SSO",
    blurb: "Let staff sign in with Google. Set the OAuth callback in Google Cloud.",
    fields: [
      { key: "clientId", label: "OAuth client ID" },
      { key: "clientSecret", label: "OAuth client secret", type: "password" },
      { key: "domain", label: "Allowed email domain", placeholder: "yourcafe.com" },
    ],
  },
  {
    slug: "microsoft-sso",
    name: "Microsoft Entra SSO",
    category: "SSO",
    blurb: "Staff sign-in with Microsoft 365 / Entra ID.",
    fields: [
      { key: "tenantId", label: "Tenant ID" },
      { key: "clientId", label: "Application (client) ID" },
      { key: "clientSecret", label: "Client secret", type: "password" },
    ],
  },
];

export function providerBySlug(slug: string): IntegrationProvider | undefined {
  return PROVIDERS.find((p) => p.slug === slug);
}

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "WEBHOOK",
  "POS",
  "PMS",
  "ACCOUNTING",
  "SSO",
];
