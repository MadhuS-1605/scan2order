# Scan2Order — How It Works (Visual Flows)

Diagrams render automatically on GitHub and in any Mermaid-aware viewer
(VS Code, Obsidian, etc.). Use these in demos to show the journeys end-to-end.

---

## 1. The guest journey — scan to order to pay

```mermaid
flowchart LR
    A([Guest sits down]) --> B[Scans table QR]
    B --> C[Menu opens on phone<br/>no app install]
    C --> D[Browse · filter · add to cart]
    D --> E{Order}
    E --> F[[Kitchen receives ticket]]
    F -->|optional| G[Waiter confirms first]
    G --> F
    F --> H[Cook · mark Ready]
    H --> I[Served]
    I --> J{Pay}
    J --> K[Online · Razorpay]
    J --> L[UPI scan-to-pay on bill]
    J --> M[Pay at counter]
    K & L & M --> N[GST bill via WhatsApp / email / PDF]
    N --> O[Rate the experience ⭐]
```

## 2. Order lifecycle (what staff sees)

```mermaid
stateDiagram-v2
    [*] --> PLACED
    PLACED --> CONFIRMED: auto, or waiter approves
    CONFIRMED --> PREPARING: kitchen starts
    PREPARING --> READY: marked ready (KDS/Bar)
    READY --> SERVED
    SERVED --> COMPLETED: paid & closed
    PLACED --> CANCELLED
    CONFIRMED --> CANCELLED
```

## 3. Service models (one product, every format)

```mermaid
flowchart TD
    Q[Scan2Order] --> R[Dine-in<br/>per-table, shared bill]
    Q --> S[Self-service / QSR / counter<br/>pay-first, pick up by number]
    Q --> T[Cloud kitchen / takeaway<br/>pickup or delivery + address]
    R --> U[Restaurants · Cafés · Bars]
    S --> V[QSR · Food courts · Cafés]
    T --> W[Delivery-only brands]
```

## 4. Payment & settlement

```mermaid
sequenceDiagram
    participant G as Guest
    participant App as Scan2Order
    participant RZP as Razorpay
    participant K as Kitchen/Staff
    G->>App: Place order
    App->>K: Ticket (or hold for waiter)
    G->>App: Pay online
    App->>RZP: Create payment
    RZP-->>App: Captured (verified + webhook)
    App-->>G: GST bill (WhatsApp / email / PDF)
    Note over App,K: Table bill settles; table frees up
```

## 5. Owner onboarding (live in minutes)

```mermaid
flowchart LR
    O([Sign up]) --> P[Profile<br/>name · type · GSTIN · logo · subdomain]
    P --> M[Menu<br/>templates or CSV import]
    M --> S[Settings<br/>payments · GST · hours · features]
    S --> T[Tables & QR<br/>auto-generated]
    T --> Live([Open for orders 🎉])
    Live -.14-day full-feature trial.-> Live
```

## 6. Hotel / multi-property shape

```mermaid
flowchart TD
    Grp[Hotel group / owner login] --> P1[Property A · restaurant]
    Grp --> P2[Property B · café]
    Grp --> P3[Property C · banquet + rooms]
    P3 --> Rooms[Room charges → folio → checkout]
    P3 --> Banq[Banquet bookings → orders]
    P1 --> Menu1[Own menu · hours · branding]
```

## 7. Subscription, usage & billing

```mermaid
flowchart LR
    Trial[14-day trial] --> Plan{Choose plan}
    Plan --> Starter[Starter ₹999]
    Plan --> Pro[Pro ₹2,499]
    Plan --> Ent[Enterprise · custom]
    Starter & Pro --> Use[Use WhatsApp / email<br/>within monthly allowance]
    Use --> Over{Over allowance?}
    Over -->|no| OK[Included]
    Over -->|yes| Ovg[Overage metered · Settle now or bundle into renewal]
    Starter & Pro --> Inv[GST tax invoice per payment]
```

## 8. System at a glance (architecture)

```mermaid
flowchart TB
    subgraph Guests
      Phone[Guest phone · PWA]
    end
    subgraph Staff
      Admin[Admin · KDS · Floor · Reports]
    end
    Phone --> App[Scan2Order<br/>Next.js app]
    Admin --> App
    App --> DB[(PostgreSQL)]
    App --> RZP[Razorpay]
    App --> WA[WhatsApp · Meta Cloud API]
    App --> Mail[Email · Resend]
    App --> R2[(Cloudflare R2<br/>images/CDN)]
    App --> CF[Cloudflare DNS<br/>per-venue subdomain]
    subgraph Operator
      Super[Platform console<br/>revenue · health · support]
    end
    Super --> App
```
