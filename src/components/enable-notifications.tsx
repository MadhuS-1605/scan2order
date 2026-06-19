"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, BellOff } from "lucide-react";
import {
  subscribeRestaurantPushAction,
  subscribeOrderPushAction,
} from "@/lib/notifications/actions";

type Props =
  | { scope: "restaurant" }
  | { scope: "order"; orderId: string; qrToken: string };

type State =
  | "idle"
  | "unsupported"
  | "ios" // iOS Safari: push needs the app installed to the Home Screen
  | "enabling"
  | "enabled"
  | "denied"
  | "error";

function urlB64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function EnableNotifications(props: Props) {
  const [state, setState] = useState<State>("idle");
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window) ||
      !vapid
    ) {
      // iOS Safari only supports web push when installed to the Home Screen
      // (standalone). Nudge the diner to add it rather than showing nothing.
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      setState(isIOS && !standalone ? "ios" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setState("enabled");
      })
      .catch(() => {});
  }, [vapid]);

  async function enable() {
    if (!vapid) return;
    try {
      setState("enabling");
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(vapid),
        });
      }
      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const payload = {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      };
      const res =
        props.scope === "restaurant"
          ? await subscribeRestaurantPushAction(payload)
          : await subscribeOrderPushAction({
              orderId: props.orderId,
              qrToken: props.qrToken,
              sub: payload,
            });
      setState(res.ok ? "enabled" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "unsupported") return null;

  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

  if (state === "ios") {
    return (
      <span
        className={`${base} text-ink/45`}
        title="On iPhone, tap Share → Add to Home Screen, then open it from there to get order alerts"
      >
        <Bell className="h-4 w-4" />
        Add to Home Screen for alerts
      </span>
    );
  }

  if (state === "enabled") {
    return (
      <span className={`${base} bg-olive-500/10 text-olive-600`}>
        <BellRing className="h-4 w-4" />
        Alerts on
      </span>
    );
  }
  if (state === "denied") {
    return (
      <span
        className={`${base} text-ink/40`}
        title="Notifications are blocked in your browser settings"
      >
        <BellOff className="h-4 w-4" />
        Alerts blocked
      </span>
    );
  }
  return (
    <button
      onClick={enable}
      disabled={state === "enabling"}
      className={`${base} border border-sand-300 bg-surface text-ink/70 hover:border-brand-300 hover:bg-sand-100 disabled:opacity-60`}
    >
      <Bell className="h-4 w-4" />
      {state === "enabling"
        ? "Enabling…"
        : state === "error"
          ? "Try again"
          : "Enable alerts"}
    </button>
  );
}
