# Detailed Requirements

## 1. Limit Enforcement Implementation

### Platform Level

| # | Requirement | Details / Acceptance Criteria | Priority |
|---|---|---|---|
| 1 | Max USD Spend (per day/week) across all users | Set a maximum spend limit of `x` USD per day and `y` USD per week at the whole-platform level across all users. Trigger a warning at 80% usage and block usage at 100%. | P0 |
| 2 | Max Output Token Ceiling (per turn) | Set the API request parameter (`max_tokens` or equivalent model parameter) to a maximum ceiling of 500 output tokens per turn. Ensure system prompts instruct the model to favor dense, structured Amazon-style summary outputs over long-form prose. | P1 |

### User Level

| # | Requirement | Details / Acceptance Criteria | Priority |
|---|---|---|---|
| 3 | Tiered Usage Credits Limit | The system must map users to two distinct limit tiers: High Tier and Low Tier, each with different weekly usage limits of `x` and `y` USD per week. | P1 |
| 4 | Sliding-Window Rate Limiting | Implement an application-layer throttle restricting each user to a maximum of 10 queries per rolling 10-minute window to prevent abuse or overloading. If an AE exceeds this limit, temporary access is locked for the remainder of the window and a countdown message is displayed: `Too many requests. Please wait X minutes.` | P1 |

## 2. Monitoring / Alerting

| # | Requirement | Details / Acceptance Criteria | Priority |
|---|---|---|---|
| 5 | Real-Time Slack Telemetry Channel - Platform ceiling warning (80%) | Build a webhook integration pointing to the `#ads-ai-cost-guard` Slack channel. The system must instantly stream an alert notification whenever the platform reaches 80% of the daily or weekly ceiling. | P0 |
| 6 | Real-Time Slack Telemetry Channel - Platform ceiling hard cap (100%) | Build a webhook integration pointing to the `#ads-ai-cost-guard` Slack channel. The system must instantly stream an alert notification whenever the platform reaches 100% of the daily or weekly ceiling. | P0 |
| 7 | Real-Time Slack Telemetry Channel - AE soft cap warning | Send an alert notification whenever an AE triggers a soft-cap warning. | P1 |
| 8 | Real-Time Slack Telemetry Channel - AE hard ceiling | Send an alert notification whenever an AE triggers a hard ceiling. | P1 |
| 9 | Real-Time Slack Telemetry Channel - AE sliding-window throttle | Send an alert notification whenever an AE hits a sliding-window throttle. | P1 |

## 3. Limits Visibility, Warnings, and Extension Requests for Users

| # | Requirement | Details / Acceptance Criteria | Priority |
|---|---|---|---|
| 10 | In-App Credits UI Display | Add a visible, near real-time consumption indicator to the top or side banner of the AI Assistant UI. It must show the remaining weekly budget as a percentage or visual progress bar to encourage self-regulation. | P1 |
| 11 | High Usage (Soft Cap) Warning Notification | When a user reaches 80% of their assigned weekly credit limit, the system must trigger a non-blocking in-app toast or warning message. Message copy: `You've used 80% of your weekly AI credits`. Also send this message via email or Slack, whichever is easier. | P1 |
| 12 | Hard Ceiling (Hard Cap) Notification and Block | Upon reaching 100% of the weekly AI usage limit, the text input field must be programmatically disabled or grayed out. Users must be blocked from sending further requests, and the UI must display an overlay screen: `AI Budget Reached, new credits to be allocated next week`. This must apply to both user-level and platform-level ceilings. | P0 |
| 13 | Emergency "Instant Credits Extension" | On the hard-cap overlay screen, provide an `Instant Credits Extension` CTA button. Clicking this button must instantly inject a fixed `+20` query buffer, or `x` USD, to prevent live sales pitch interruptions. | P2 |

## 4. Limit Management by POs / Finance

| # | Requirement | Details / Acceptance Criteria | Priority |
|---|---|---|---|
| 14 | Credit Management Admin Console | Allow Product Owners to whitelist users, see user usage, and change usage tiers through an admin console without engaging engineering or redeploying code. | P2 |
