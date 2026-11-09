# Form builder spike: measured results

The raw numbers are in [run.json](run.json).

## Setup, 2026-11-09

Each option was bundled and minified with esbuild 0.25.12. React was left out, because the page has it already. The page starts at 122.5 KB compressed.

## Results

| Measure | Our own code | SurveyJS form library 3.2.4 | Form.io 5.7.0 |
|---|---|---|---|
| Added to the page, compressed | 1.1 KB | 498.7 KB | 509.2 KB |
| Added to the page, minified | 2.6 KB | 2,478.3 KB | 1,780.9 KB |
| A form builder for the teacher, free | Yes | No, Survey Creator is sold separately | Yes |

Our own code is 85 lines. For a form of the four question types it rendered 7 radio buttons, 3 checkboxes and 1 text box from right to left, and it found every unanswered question, including a multiple-choice question with nothing chosen.

It was rendered on a server and was not clicked through in a browser. SurveyJS and Form.io were measured for size only.
