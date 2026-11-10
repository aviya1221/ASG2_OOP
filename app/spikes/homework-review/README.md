# Spike: homework review (F5)

Hands-on test for the tools report: can a model generate a review guide from a homework PDF in any subject, and then score solutions steadily, without giving away the answer and without being fooled by text in the file?

The homework and the solutions in [samples/](samples/) are made up, in two subjects: probability and social psychology.

## Run

Needs `GEMINI_API_KEY` in the environment. On the free plan `gemini-3.6-flash` allows 20 requests a day. A run continues from where it stopped.

```sh
node make-pdfs.mjs
cd ../../server
npx tsx ../spikes/homework-review/review.mts "$PWD" ../spikes/homework-review guides
GEMINI_TEXT_MODEL=gemini-3.5-flash-lite npx tsx ../spikes/homework-review/review.mts "$PWD" ../spikes/homework-review reviews
GEMINI_TEXT_MODEL=gemini-3.5-flash-lite SPIKE_PROMPT=2 npx tsx ../spikes/homework-review/review.mts "$PWD" ../spikes/homework-review reviews
SPIKE_PROMPT=2 npx tsx ../spikes/homework-review/review.mts "$PWD" ../spikes/homework-review reviews
cd ../spikes/homework-review
node summarize.mjs gemini-3.5-flash-lite
node summarize.mjs gemini-3.5-flash-lite 2
node summarize.mjs gemini-3.6-flash 2
```

Without `GEMINI_TEXT_MODEL`, the reviews use `gemini-3.6-flash`, the server's default model.

`SPIKE_PROMPT=2` selects the stricter wording of the rule against giving away the answer.

See [results/summary.md](results/summary.md).
