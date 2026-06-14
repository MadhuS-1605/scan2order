// Prints the machine's LAN URLs before the dev server starts, so the address
// is easy to open on other devices. Usage: node scripts/lan-url.mjs [http|https]
import os from "node:os";

const scheme = process.argv[2] === "https" ? "https" : "http";
const port = process.env.PORT || process.argv[3] || 3000;

const ips = [];
for (const iface of Object.values(os.networkInterfaces())) {
  for (const net of iface ?? []) {
    if (net.family === "IPv4" && !net.internal) ips.push(net.address);
  }
}

console.log("\n  [1mScan to Order[0m — reachable at:");
console.log(`  → ${scheme}://localhost:${port}  (this machine)`);
for (const ip of ips) {
  console.log(`  → ${scheme}://${ip}:${port}  (other devices on your network)`);
}
if (scheme === "https") {
  console.log("  [2m(accept the self-signed certificate warning on each device)[0m");
}
console.log("");
