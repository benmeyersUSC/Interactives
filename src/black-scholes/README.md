# Pricing a particle — source

The exhibit is `black-scholes.html` at the repository root. It is one self-contained file: Chart.js, its annotation plugin, the typeset equations and their fonts are all embedded, and the page makes no network requests. This folder is only needed to rebuild it.

| File | Role |
|---|---|
| `page.template.html` | Source of truth: markup, styles and the page's JavaScript. Equations are written as `data-tex="…"` attributes. |
| `build.cjs` | Typesets every `data-tex` element with KaTeX, embeds KaTeX's CSS and woff2 fonts, and inlines the two chart libraries into `../../black-scholes.html`. |
| `check.cjs` | Browser check with Playwright and Google Chrome. It compares the page's numbers with reference values computed in Python (`math.erfc`) and drives the sliders, the strike drag, the efficient-market switch and the walkers. Screenshots go to `shots/`, which git ignores. |
| `vendor/` | Chart.js 4.5.1, chartjs-plugin-annotation 3.1.0 (MIT), and the KaTeX build and fonts it uses (MIT, license included). |

Rebuild, then check, from the repository root:

```bash
node src/black-scholes/build.cjs
node src/black-scholes/check.cjs
```

## What the page shows

1. **01 · Outcome at the horizon.** The lognormal density of X = S_Δt/S₀ under geometric Brownian motion with drift μ and volatility σ. It marks the median e^M, the mean e^(μΔt) and the probability below the mean, Φ(S/2).
2. **02 · Standardized.** The same probability on the standard normal scale.
3. **03 · Present value.** The discount map Y = e^(−rΔt)·X. The curve slides left and grows taller; probabilities do not change.
4. **04 · Value-weighted.** y·g(y). Its areas are sums of discounted value, cut at a draggable strike K. With the efficient-market switch on (μ = r), the areas split today's price, 1. The call is the sliver between y·g(y) and the dashed strike leg K·D·g(y): C = Φ(d₁) − K·e^(−rΔt)·Φ(d₂). It is replicated by holding Φ(d₁) shares and borrowing K·e^(−rΔt)·Φ(d₂).
5. **05 · Walkers.** N coin-flip random walks on the same parameters, drawn as accumulating pigment, with a sideways histogram of where they end. Three step rules show Itô's correction: price steps (it appears on its own), log steps with μ − σ²/2 (built in), and log steps with μ (forgotten: the median drifts off).

The page's own "Inside the model" section lists the equations and the assumptions: constant μ, σ and r, no dividends, continuous discounting, and the strike paid at the horizon.
