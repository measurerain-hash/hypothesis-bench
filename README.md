# Hypothesis Bench

[![Made with pollinations.ai](https://raw.githubusercontent.com/pollinations/pollinations/main/packages/ui/src/brand/badge-made-with.svg)](https://pollinations.ai/?ref=badge)

Turn a science topic into a small model you can steer. Type a topic; a Pollinations text
model writes a bench: the variables that matter, a formula for the quantity you care
about, a plot you sweep with sliders, and a plain-language briefing with the cautions and
the references.

**Live:** https://measurerain-hash.github.io/hypothesis-bench/

## Why it is different

Most "science explainer with AI" apps ask the model to write a whole interactive page.
That breaks the moment the model writes one bad line, and the visitor gets a blank frame.
Hypothesis Bench asks the model for a **structured spec** instead — variables, ranges, one
formula — and renders it with code that cannot fail. The model supplies the science; the
page supplies the chart. When a reply is malformed the app degrades to a labelled
placeholder and offers a retry, so the bench is never a blank page.

Every constraint is written out: each slider shows the value a real system has (`real`),
and the cautions say where the simple model stops being true.

## What runs in code, not in the model

The model never touches the page. Everything the visitor sees is computed locally:

- the plot: 240 sampled points evaluated from the validated formula, with axis ticks,
  autoscaling and the current-value marker all drawn by `js/chart.js`;
- the formula: checked against a whitelist (only the declared variable symbols and
  `Math.*`), then compiled with `new Function`; anything else is refused and the bench
  falls back to a labelled placeholder;
- every input is bounded: ranges are ordered, defaults are clamped, and non-finite
  samples are dropped from the curve.

So the model supplies the science and the code supplies the measurement — a malformed
reply degrades to a placeholder, never to a blank or broken page.

## How it works

- `js/prompt.js` — the single instruction that returns a flat JSON spec.
- `js/pollinations-client.js` — one `chat/completions` call to `gen.pollinations.ai`.
- `js/validate.js` — parses the reply, bounds every number, and compiles the formula
  against a whitelist (only the variable symbols and `Math.*`), with a placeholder bench
  as the fallback.
- `js/chart.js` — a dependency-free canvas plot of the swept variable.
- `js/app.js` — wiring and sliders.

## Bring your own Pollen

The visitor approves a scoped key with the official `<polli-connect>` widget, so every
call bills their own Pollen and no key is ever pasted into the page. See
[BRING_YOUR_OWN_POLLEN.md](https://github.com/pollinations/pollinations/blob/main/BRING_YOUR_OWN_POLLEN.md).

## Run locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Static site, no build step.

## Models

Default: `deepseek/deepseek-v4-flash` with `reasoning_effort: "none"` (a "low" effort is
rejected by that model, and its default reasoning consumes the whole output budget).