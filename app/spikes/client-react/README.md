# Spike: React client

Hands-on test for the tools report: can React with Vite build the lesson page, in Hebrew and from right to left, on every screen size, with live updates from Supabase?

The page has the black band, the three tabs and a sample of each tab. The script measures:

- the weight of the page;
- eight screen sizes, from a 320 px phone to a 1920 px screen, on all three tabs: no sideways scroll of the page, nothing past the edge, controls of at least 44 px, and right-to-left order;
- the time to first content on an emulated slow phone;
- how fast a message from Supabase appears on the page, without reloading it.

The phones are emulated in Edge on a laptop. Direct broadcast needs no table. Database changes need the test table.

## Run

1. Copy `.env.example` to `.env` and fill in the project URL and the public key. Never put the secret key here.
2. For database changes, paste and run [../backend-realtime/setup.sql](../backend-realtime/setup.sql) in the Supabase SQL Editor.
3. Run:

```sh
npm install
npm run build
npm run measure
```

The results are written to `results/`. When you are done, run [../backend-realtime/cleanup.sql](../backend-realtime/cleanup.sql) in the SQL Editor.
