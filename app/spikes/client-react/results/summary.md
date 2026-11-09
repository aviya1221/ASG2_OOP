# Results: React client spike

Run on 2026-11-09 in Edge on a laptop. Phones are emulated.

## Time to set up

| Step | Time |
|------|------|
| First install | 39 s |
| Type check | 4.5 s |
| Production build | 4.4 s |

## Page weight

| File | Size | Compressed |
|------|------|------------|
| assets/index-BbLcDnzY.js | 429.8 KB | 121.3 KB |
| assets/index-CK-zwdis.css | 2.1 KB | 0.8 KB |
| index.html | 0.4 KB | 0.3 KB |
| **Total** | | **122.5 KB** |

## Screen sizes

Each size was checked on all three tabs.

| Screen | Width × height | Sideways scroll of the page | Elements past the edge | Controls under 44 px | Right to left | Content width |
|--------|----------------|------------------|------------------------|----------------------|---------------|---------------|
| Small phone | 320 × 568 | 0 of 3 tabs | 0 | 0 | Yes | 320 px |
| Phone | 360 × 780 | 0 of 3 tabs | 0 | 0 | Yes | 360 px |
| Phone | 390 × 844 | 0 of 3 tabs | 0 | 0 | Yes | 390 px |
| Large phone | 430 × 932 | 0 of 3 tabs | 0 | 0 | Yes | 430 px |
| Phone on its side | 844 × 390 | 0 of 3 tabs | 0 | 0 | Yes | 844 px |
| Tablet | 768 × 1024 | 0 of 3 tabs | 0 | 0 | Yes | 768 px |
| Laptop | 1280 × 800 | 0 of 3 tabs | 0 | 0 | Yes | 1120 px |
| Large screen | 1920 × 1080 | 0 of 3 tabs | 0 | 0 | Yes | 1120 px |

Check of the check: a planted too-wide element and a planted too-small button were both caught.

## Loading on an emulated slow phone

Slow 4G (150 ms, 1.6 Mbit/s) and a CPU four times slower, with an empty cache.

First content on the screen: median 1388 ms over 5 runs (1388, 1416, 1424, 1360, 1372 ms).

## Live updates on the page

From sending a message to its appearing on the page, on one page with a CPU four times slower.

| Method | Pace | Sent | Arrived | 95% within | Slowest |
|--------|------|------|---------|------------|---------|
| broadcast | One message per second | 30 | 30 | 79 ms | 84 ms |
| broadcast | 50 messages within 1 s | 50 | 50 | 99 ms | 103 ms |
| database | One message per second | 30 | 30 | 605 ms | 615 ms |
| database | 50 messages within 1 s | 50 | 50 | 659 ms | 677 ms |

Page reloads during the broadcast test: 0.
Page reloads during the database test: 0.
