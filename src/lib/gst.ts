import "server-only";
import { env } from "@/lib/env";
import { reportError } from "@/lib/observability";

// GSTIN verification against the GSTN, via Sandbox (api.sandbox.co.in).
//
// Flow: authenticate (api key + secret -> short-lived access token) then call
// the public "Search Taxpayer" endpoint for the GSTIN. We surface the GSTN's
// registered legal name / trade name / status so onboarding can auto-fill the
// business name instead of trusting typed input.
//
// All network paths are fail-soft, mirroring src/lib/cloudflare.ts: if the
// provider is unconfigured or errors, we log via reportError and return a
// structured { ok:false } — never throw into onboarding. The tenant can still
// save the GSTIN manually (unverified).

// Standard 15-char GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z',
// checksum char. https://en.wikipedia.org/wiki/GSTIN
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export type GstVerifyResult =
  | {
      ok: true;
      gstin: string;
      legalName: string;
      tradeName: string | null;
      status: string;
      address: string | null;
    }
  | {
      ok: false;
      error: string;
      code: "FORMAT" | "UNCONFIGURED" | "PROVIDER" | "NOT_FOUND";
    };

export function normalizeGstin(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function gstConfigured(): boolean {
  return env.gst.configured();
}

// Exchange the API key/secret for a short-lived access token. Returns null on
// any failure (already logged).
async function authenticate(): Promise<string | null> {
  try {
    const res = await fetch(`${env.gst.baseUrl}/authenticate`, {
      method: "POST",
      headers: {
        "x-api-key": env.gst.apiKey,
        "x-api-secret": env.gst.apiSecret,
        "x-api-version": env.gst.apiVersion,
      },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      data?: { access_token?: string };
    };
    // Sandbox has returned the token at the top level and (in newer docs) nested
    // under `data` — accept either.
    const token = body.access_token ?? body.data?.access_token ?? null;
    if (!res.ok || !token) {
      reportError("gst.authenticate", new Error(`status ${res.status}`));
      return null;
    }
    return token;
  } catch (e) {
    reportError("gst.authenticate", e);
    return null;
  }
}

// Shape of the GSTN payload we care about (Sandbox wraps it under `data`).
type GstnTaxpayer = {
  gstin?: string;
  lgnm?: string; // legal name of business
  tradeNam?: string; // trade name
  sts?: string; // status, e.g. "Active"
  pradr?: { adr?: string }; // principal place of business (full address string)
};

function flattenAddress(addr: string | undefined): string | null {
  const a = addr?.trim();
  return a ? a : null;
}

export async function verifyGstin(input: string): Promise<GstVerifyResult> {
  const gstin = normalizeGstin(input);

  if (!GSTIN_REGEX.test(gstin)) {
    return {
      ok: false,
      code: "FORMAT",
      error: "That doesn't look like a valid 15-character GSTIN.",
    };
  }

  if (!gstConfigured()) {
    return {
      ok: false,
      code: "UNCONFIGURED",
      error:
        "GST verification isn't set up yet. You can save the GSTIN and we'll verify it later.",
    };
  }

  const token = await authenticate();
  if (!token) {
    return {
      ok: false,
      code: "PROVIDER",
      error: "Couldn't reach the GST service just now. Please try again.",
    };
  }

  try {
    const res = await fetch(
      `${env.gst.baseUrl}/gst/compliance/public/gstin/${gstin}`,
      {
        method: "GET",
        headers: {
          Authorization: token,
          "x-api-key": env.gst.apiKey,
          "x-api-version": env.gst.apiVersion,
        },
        cache: "no-store",
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      data?: GstnTaxpayer & { data?: GstnTaxpayer };
    };
    // Defensive: Sandbox nests the GSTN object under `data`, occasionally
    // double-nested as `data.data`.
    const tp: GstnTaxpayer = body.data?.data ?? body.data ?? {};

    const legalName = tp.lgnm?.trim();
    if (!res.ok || !legalName) {
      // 404 / empty payload -> the GSTIN isn't registered.
      return {
        ok: false,
        code: "NOT_FOUND",
        error: "No business found for that GSTIN. Please check the number.",
      };
    }

    return {
      ok: true,
      gstin,
      legalName,
      tradeName: tp.tradeNam?.trim() || null,
      status: tp.sts?.trim() || "Unknown",
      address: flattenAddress(tp.pradr?.adr),
    };
  } catch (e) {
    reportError("gst.verifyGstin", e, { gstin });
    return {
      ok: false,
      code: "PROVIDER",
      error: "Couldn't reach the GST service just now. Please try again.",
    };
  }
}
