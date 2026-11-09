# Spike: hosting our server on a free plan (Render)

Hands-on test for the tools report: can a free Render web service (0.1 CPU, 512 MB of memory) run our server?

It measures waking up after sleep, a long wait (the lesson summary), large uploads (a recording) and a class of attendance responses (NFR-03).

## Run

1. Put [server/](server/) in a public Git repository. It has no dependencies and holds no keys.
2. In Render: New, Web Service, Public Git Repository. Language Node, build command `npm install`, start command `node server.mjs`, the free plan.
3. Run:

```sh
node measure.mjs https://your-service.onrender.com now
node measure.mjs https://your-service.onrender.com wake
```

The `wake` run stays idle for 16 minutes before each of its 3 measurements, so nothing else may call the service meanwhile. The results are written to `results/`. Delete the service when you are done.
