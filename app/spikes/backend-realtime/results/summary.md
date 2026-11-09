# Database and live updates spike: measured results

The raw numbers are in [run-50-clients.json](run-50-clients.json).

## Setup, 2026-11-09

- A free Supabase project in Frankfurt, used through `supabase-js` 2.119.0 on Node 22.
- 50 clients with a connection each, all running on one laptop, so the sender and the receivers share one clock.
- The test table lets every client read it, so the time does not include a real access rule.
- One delivery is one message reaching one client. All 50 clients connected in every test, in under 1 s.

## Live updates

"95% within" is the time within which 95% of the deliveries arrived. The target is 2 s (NFR-02).

| Pace | Deliveries per method | Database changes: 95% within | Database changes: slowest | Direct broadcast: 95% within | Direct broadcast: slowest |
|---|---|---|---|---|---|
| One message every 2 s | 1,500 | 650 ms | 1,154 ms | 93 ms | 368 ms |
| One message every second | 1,000 | 753 ms | 1,049 ms | 81 ms | 360 ms |
| The whole class sends within 10 s | 2,500 | 615 ms | 713 ms | 79 ms | 306 ms |
| The whole class sends within 1 s | 2,500 | 708 ms | 1,130 ms | 89 ms | 182 ms |

In every row, all the deliveries arrived within 2 s, no send failed and no connection was lost.

## Sign-in and files

| Measure | Result |
|---|---|
| Sign-in, 5 attempts | Median 220 ms, slowest 286 ms |
| Upload of a 5 MB file | 2,446 ms |
| Download of the same file | 2,002 ms, identical to the original |

## First run

[first-run-50-clients.json](first-run-50-clients.json) comes from an earlier version of the script, with one separate sender at one message every 2 s. All 3,000 deliveries arrived. 95% arrived within 677 ms with database changes and within 87 ms with direct broadcast. All 50 clients connected within 1.9 s.
