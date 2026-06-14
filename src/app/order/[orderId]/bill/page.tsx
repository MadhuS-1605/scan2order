import { redirect } from "next/navigation";

// The bill/payment screen moved to /payment?order=<id>. Keep this route as a
// redirect so existing links and QR deep-links (/t/<token>/order/<id>/bill,
// resolved by proxy.ts) still land on the payment page.
export default async function BillRedirect({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  redirect(`/payment?order=${orderId}`);
}
