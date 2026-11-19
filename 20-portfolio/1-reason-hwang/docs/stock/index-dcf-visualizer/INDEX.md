# Index DCF Visualizer

`/index-dcf-visualizer` estimates an index's fair value from manually entered EPS, payout, and discount-rate assumptions. The host shows forecast cash payouts, terminal value, fair value composition, and a comparison with the user-entered current index level. The calculation runs in the browser against the input state.

## Assumptions and calculations

The forecast uses five annual periods. In year `t`, `EPS[t] = EPS[t-1] × (1 + growth[t])` and the cash payout is EPS multiplied by the sum of the dividend and net buyback payout rates. Discount each forecast cash payout by `(1 + risk-free rate + implied ERP)^t`.

Year 6 EPS is year 5 EPS grown at the perpetual rate `g`. The long-run payout ratio is `1 − g / normalized ROE`. Terminal value at year 5 is year 6 cash payout divided by `long-run discount rate − g`. Discount the terminal value to today using the forecast discount rate over five periods. Fair value is the sum of the five forecast present values and terminal present value. The comparison reports the point gap, `(fair / current − 1) × 100` upside/downside and `(current / fair − 1) × 100` premium/discount. Upside/downside within ±0.005 percentage points, excluding the endpoints, is classified as fair.

The long-run discount rate can be linked to the forecast discount rate or entered independently. Unlinking uses the most recent valid linked rate, rounded to two decimal places in the input. The demo uses EPS 350, a current level of 5,000, and a linked 8.50% discount rate. Its calculated fair value is about 5,577.33 and upside is 11.55%.

## Input and warning behavior

| Input | Inclusive range |
| --- | --- |
| Actual EPS, current index | 1–10,000 points and 1–100,000 points, respectively |
| Annual EPS growth | −20% to 20% |
| Annual dividend payout | 0% to 100% |
| Annual net buyback payout | −50% to 100% |
| Risk-free rate and implied ERP | 0% to 10% each |
| Perpetual growth, normalized ROE | 0% to 5% and 5% to 40%, respectively |
| Independent long-run discount rate | 1% to 20% |

The index name allows up to 80 characters and the valuation date must be a valid ISO calendar date. Missing or invalid numbers block dependent results. Unrelated results stay visible. Perpetual growth must be below normalized ROE and the long-run discount rate. Nonpositive fair value blocks market comparison and the terminal share. Total payout outside 0–100%, a positive discount-growth spread below one percentage point, and terminal value exceeding 80% of fair value produce warnings while the affected values remain available.

## Implementation and verification

- [Host FSD slice](../../../1-fe-host/src/_pages/index-dcf-visualizer/) owns the inputs, validation, calculation and charts. [Demo and bounds](../../../1-fe-host/src/_pages/index-dcf-visualizer/config/defaults.ts).
- Run `pnpm -C 1-fe-host test:e2e:calculation` for numeric scenarios and `pnpm -C 1-fe-host test:e2e tests/e2e/index-dcf-visualizer.spec.ts` for browser interactions. [Calculation tests](../../../1-fe-host/tests/e2e/index-dcf-calculation.spec.ts) · [Browser tests](../../../1-fe-host/tests/e2e/index-dcf-visualizer.spec.ts).
