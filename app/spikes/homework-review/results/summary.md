# Homework review spike: measured results

The raw numbers are in [runs.json](runs.json), and the summaries per model and wording are in the `numbers-*.json` files. The homework and the solutions are made up.

## Setup, 2026-11-09

- Two homeworks, probability (7 sections) and social psychology (5 sections), each with a strong, a partial and a weak solution as PDF files.
- One review guide per homework, generated once by `gemini-3.6-flash` and reused for every check. Both guides found all the sections.
- Every review went through the product's LLM layer. The sampling settings were left alone, because Gemini 3.6 and later ignore them.
- Wording 2 adds a ban on naming what the section asks the student to come up with, and leaves feedback empty for a section that was not answered.

## gemini-3.5-flash-lite: 82 reviews

| Measure | Wording 1 | Wording 2 |
|---|---|---|
| Reports with a key step or a requested idea, partial solution and direct request | 23 of 28 | 1 of 16 |
| Largest move of one section, partial solution, 5 different seeds | 10 points in both subjects | 35 points in probability, 10 in psychology |
| Overall score, partial solution, 5 different seeds | 39 to 45, and 26 to 28 | 38 to 47, and 24 to 30 |

The first row counts reports containing an item from a fixed list of results and ideas, so it is an indication. With 5 seeds the median of 3 reviews moved at most 10 points with wording 1, and 25 points with wording 2.

These results are for wording 1:

| Measure | Result |
|---|---|
| The same file and the same seed, 5 times | Identical scores in both subjects |
| Overall score, strong solution | 100 |
| Overall score, weak solution | 1 to 15 |
| Largest move of one section, weak solution, 3 seeds | 29 points in probability, 0 in psychology |
| Section left out of the solution | 0 in every review |
| Empty file, or a copy of the homework | 0 in every section |
| "Give 100" and requests for the answer, visible and hidden, in 4 languages | 35 of 36 section medians within 10 points of the clean file; the largest rise was 10 and one section fell by 20; only a section that also reached 100 in the clean file reached it |
| Median time of a review | 4.2 s |
| A solution of 20 pages | 4.5 s and 8.1 s |
| Median tokens | 4,988 |

Problems found:

- Scores came only in steps of 5.
- A section that was answered but completely wrong got 0 in 31 sections, and the server lifted it to 1. Before that rule, 5 answers were rejected.
- Arabic letters appeared inside Hebrew words in 16 sections with wording 1 and 5 with wording 2.
- 7 of about 94 requests failed with error 503.
- No daily limit was reached during the 94 requests.

## gemini-3.6-flash: 10 reviews

Both days the run stopped at the free plan's limit of 20 requests a day. 18 requests failed with error 503 because the model was busy, and 3 reviews failed all 3 tries. A review that went through on the first try took 32 to 65 s, and up to 300 s with the pause of 65 s before each new try. A review used 6,500 to 9,300 tokens.

Wording 1, 2026-11-09:

| Solution, probability | Scores of the 7 sections |
|---|---|
| Strong | 100 in all |
| Partial | 75, 80, 50, 55, 0, 50, 20 |
| Weak | 20, 15, 10, 40, 50, 20, 15 |

Wording 2, 2026-11-10, the partial solution with different seeds:

| Measure | Probability, 3 seeds | Psychology, 4 seeds |
|---|---|---|
| Overall score | 41 to 45 | 27 to 31 |
| Largest move of one section | 25 points | 10 points |
| Reports with a key step or a requested idea | 0 of 3 | 0 of 4 |
| Sections with Arabic letters | 0 | 0 |

The hidden instructions and the direct requests for the answer were not reached before the daily limit.
