import Script from "next/script";

// Google Analytics 4 — loaded only when NEXT_PUBLIC_GA_ID is set, so it's inert
// in dev / self-hosted setups and adds zero third-party JS until you opt in.
// (The CSP in next.config.ts allows the googletagmanager / google-analytics
// hosts so this isn't blocked.)
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
