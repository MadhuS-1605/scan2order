# Scan2Order — Sales & Presentation Kit

Everything you need to present the product to restaurant, café and hotel owners.
All content is accurate to the **shipping product** (kept separate from the
internal platform-operator console, which owners never see).

## What's here

| File | Use it for |
|---|---|
| **[pitch-deck.md](./pitch-deck.md)** | The slide deck for live pitches (Marp → PDF/PPTX) |
| **[proposal.md](./proposal.md)** | A leave-behind proposal / quote for the owner |
| **[flows.md](./flows.md)** | Visual journeys & architecture (Mermaid diagrams) |
| **[feature-catalog.md](./feature-catalog.md)** | The complete, no-gaps feature checklist |

## Present the deck

`pitch-deck.md` is written in **[Marp](https://marp.app/)**. Options:

- **VS Code:** install the *Marp for VS Code* extension → open the file →
  "Open Preview" → export to **PDF / PPTX / HTML** from the command palette.
- **CLI:**
  ```bash
  npx @marp-team/marp-cli@latest docs/pitch-deck.md --pdf
  npx @marp-team/marp-cli@latest docs/pitch-deck.md --pptx
  ```
- Replace the `[your phone] / [your email] / [your domain]` placeholders before
  presenting.

## View the flows

`flows.md` and the diagrams in the proposal use **Mermaid** — they render
automatically on GitHub, in VS Code (Markdown Preview Mermaid Support), Obsidian,
and most Markdown tools. Export individual diagrams as images at
[mermaid.live](https://mermaid.live) if you want them inside slides.

## Tips for the room

- Lead with the **30-second how-it-works** and a live QR demo on a phone.
- Tailor the **"why it fits your venue"** section to who's across the table
  (restaurant vs café vs hotel).
- Hand over `proposal.md` (as PDF) with the plan and price filled in.
- Close on the **14-day free trial, no card**.
