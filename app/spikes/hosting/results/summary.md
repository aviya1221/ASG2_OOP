# Hosting spike: measured results

The raw numbers are in [now.json](now.json) and [wake.json](wake.json).

## Setup, 2026-11-09

- A free Render web service in Frankfurt (0.1 CPU, 512 MB of memory), running [server/](../server/) on Node 22.
- All requests came from one laptop, each on its own connection.

## Attendance responses

Each response compares one face-print of 128 numbers with the 50 face-prints of a class. The target is 2 s in 95% of cases (NFR-03). The test does not include saving the result to the database.

| Pace | Answered | Within 2 s | 95% within | Slowest |
|---|---|---|---|---|
| 50 responses within 60 s | 50 of 50 | 100% | 182 ms | 413 ms |
| 50 responses within 1 s | 50 of 50 | 100% | 249 ms | 295 ms |

## Large uploads

The server wrote each file to its temporary disk as it arrived, checked it and deleted it.

| File | Time | Identical | Server memory |
|---|---|---|---|
| 40 MB | 11.8 s | Yes | 72 MB |
| 200 MB | 60.3 s | Yes | 74 MB |

## A long wait

A request that got no reply for 330 s was answered normally after 330.1 s.

## Waking up

Each try came after 16 minutes with no requests, and in each the server had really restarted.

| Try | Time to the first reply | Reply once awake |
|---|---|---|
| 1 | 92.3 s | 170 ms |
| 2 | 22.3 s | 129 ms |
| 3 | 12.3 s | 135 ms |

A request that did not ask for a web page was held open until the server was awake, and then got a normal reply.
