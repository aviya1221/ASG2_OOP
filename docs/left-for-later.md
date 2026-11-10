# Left for later

Work we set aside on purpose so that the next documents can go ahead. The planned steps are in [TODO.md](../TODO.md), and this file lists only what would otherwise be forgotten. When an item is done, set its status to Done and record the result where the table says.

Last updated: 2026-11-09.

## Waiting for a result

| # | Task | Why it matters | What it needs | Result goes to | Status |
|---|------|----------------|---------------|----------------|--------|
| 1 | Compare `gemini-3.6-flash` with `gemini-3.5-flash-lite` for the homework review, then choose the model | `gemini-3.6-flash` allows 20 requests a day on the free plan, and a class of 50 can need 150 for one homework | The comparison run set for 2026-11-10 at 10:05 | [Tools report](02-tools-report.md) sections 2.6 and 3, the comparison table, a new ADR and the risks | Waiting |
| 2 | Commit the homework review spike | It is the evidence for item 1 | Item 1 | [app/spikes/homework-review/](../app/spikes/homework-review/) | Done |
| 3 | Update the homework review decisions | Gemini 3.6 and later ignore the temperature, a retry needs another seed, an answered section that got 0 is lifted to 1, and the median of 3 reviews may be dropped | Item 1 | [F5 decisions](features/F5-homework-review-strategy.md) | Waiting |
| 4 | Decide whether NFR-01 limits only a rise in the score | In the spike the only move above 10 points was a drop | Item 1 | [SRS](04-SRS.md) | Waiting |

## Needs real phones

| # | Task | Why it matters | What it needs | Result goes to | Status |
|---|------|----------------|---------------|----------------|--------|
| 5 | Check phone notifications on Android Chrome and iPhone Safari (REQ-11) | Safari is expected to notify only a site added to the home screen, which would clash with having nothing to install. If so, a message inside the site is the alternative | One Android phone and one iPhone | Tools report, and the SRS interfaces if the design changes | Open |
| 6 | Run the PollPosition code and answer a poll from 3 phones | It decides whether we reuse its code for quick polls | 3 phones | Not needed: the poll is our own code ([EDD-Polls](07-EDD/polls-and-forms.md)) | Done |
| 7 | Check the face tools on camera originals with registration photos, and time them on phones (R1, R2, R4, R5, NFR-04) | So far we used compressed copies and a laptop | Volunteers, phones and a lecture hall | The face tools spike in the tools report | Open |
| 8 | Time the page and the live updates on real phones, with real access rules (R13, R14, NFR-02) | The spikes used a laptop and emulated phones | The first build, and phones | [STP / STD](08-STP-STD.md) | Open |

## No device needed

| # | Task | Why it matters | What it needs | Result goes to | Status |
|---|------|----------------|---------------|----------------|--------|
| 9 | Look for existing code for the form builder | We agreed to reuse code if something suitable exists, and otherwise to write it | Nothing | Tools report and the [forum decisions](features/F2-lesson-forum-strategy.md) | Done |
| 10 | Test and record the AI development tools | Section 2.8 of the tools report is empty | Nothing | Tools report section 2.8 | Done |
| 11 | Decide the build order of the features | It is still open in the homework review decisions | The design documents | [SDD](06-SDD.md) | Open |

## To check during the build

| # | Task | Why it matters | What it needs | Result goes to | Status |
|---|------|----------------|---------------|----------------|--------|
| 12 | Pass a recording from the free server on to Gemini | The hosting spike stopped at the server's disk | The first build | STP / STD | Open |
| 13 | Measure an attendance response that also saves to the database (NFR-03) | The hosting spike only compared face-prints | The first build | STP / STD | Open |
| 14 | Choose a second model for the lesson summary (R7) | Gemini was overloaded in the spike, and the decisions call for a fallback | Item 1 may answer it | [F4 decisions](features/F4-lesson-summary-strategy.md) | Open |
| 15 | Test a full lesson, longer than 10 minutes (R9) | Only a 10-minute clip was tested | A full recording | The lesson summary spike in the tools report | Open |
| 16 | Stay above 100 events per second for longer than 10 s (R11) | The spike covered short bursts only | The first build | STP / STD | Open |
| 17 | Open the attendance sheet in Google Sheets and on a phone, and write it in a browser (R17) | Only Excel on Windows and a server were checked | The first build | STP / STD | Open |
| 23 | Check the database job on the free Supabase plan (EDD-Attendance) | Deleting class face-prints and closing polls depend on it, and only a community answer says that the free plan includes it | The first build | STP / STD | Open |

## Housekeeping

| # | Task | Why it matters | What it needs | Result goes to | Status |
|---|------|----------------|---------------|----------------|--------|
| 18 | Push the newer commits to GitHub | GitHub holds the work only up to the first version of this list, and everything newer is on one computer | The owner's decision | GitHub | Open |
| 19 | Delete the Render test service and the `render-test` repository | The hosting spike is over | The account owner | Nothing to record | Open |
| 20 | Keep the Supabase project awake (R12) | It pauses after 1 week without activity | Opening it before any use | Nothing to record | Ongoing |
| 21 | Add the ID number to the interactive attendance mock | The sheet in the mock has no ID column, unlike REQ-19 | Nothing | [The mock](assets/F1-attendance-flow-demo.html) and its published copy | Open |
| 22 | Remove "Step N" from the document titles | They should read as product documents | Done as each document is written | Demo plan and conclusion | Open |
