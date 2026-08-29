export function mermaidFence(chart: string) {
  return ["```mermaid", chart.trim(), "```"].join("\n");
}

export const DEMO_DIAGRAMS = {
  planGantt: `gantt
    title Partner rollout
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    section Messaging
    Draft one-pager           :a1, 2026-09-01, 8d
    Partner review            :a2, after a1, 4d
    section Launch
    First-wave invites       :a3, 2026-09-15, 10d
    Webinar                  :a4, 2026-09-18, 1d
    section Follow-up
    Direct sales enablement  :after a4, 14d`,

  campaignFlow: `flowchart TB
    subgraph Reach["Reach"]
      Ads["Partner ads"]
      Webinar["Webinar"]
      Email["Customer email"]
    end
    subgraph Convert["Convert"]
      OnePager["One-pager"]
      Trial["Trial"]
    end
    subgraph Expand["Expand"]
      Seat["More seats"]
      Direct["Direct sales"]
    end
    Ads --> Webinar
    Email --> OnePager
    Webinar --> Trial
    OnePager --> Trial
    Trial -->|wins| Seat
    Trial -->|later wave| Direct`,

  meetingJourney: `journey
    title Weekly GTM standup
    section Review
      Pipeline by region: 5: Alex
      Launch blockers: 3: Alex, Trace
    section Decide
      Keep webinar date: 5: Alex
      Hold second region: 4: Alex`,

  incidentSequence: `sequenceDiagram
    autonumber
    participant Checkout
    participant Cache
    participant DB
    Checkout->>Cache: get cart
    Cache-->>Checkout: miss
    Checkout->>DB: load cart
    DB-->>Checkout: cart
    Checkout->>Cache: set cart
    Note over Cache: miss rate 3.4x after 214
    Checkout-->>Checkout: request errors`,

  bugSequence: `sequenceDiagram
    autonumber
    actor User
    participant UI
    participant API
    User->>UI: go to page 2
    UI->>API: offset = page
    API-->>UI: rows 1 to 10
    UI-->>User: same results as page 1
    Note over API: offset should be page minus one, times size`,

  featureStates: `stateDiagram-v2
    [*] --> InThisBrowser
    InThisBrowser --> File: Export JSON
    File --> OtherBrowser: Copy the file
    OtherBrowser --> InThisBrowser: Import
    InThisBrowser --> [*]: Delete`,
} as const;
