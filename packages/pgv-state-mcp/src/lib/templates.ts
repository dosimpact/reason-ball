// @ts-nocheck
'use strict';

function planTemplate(feature) {
  return `# ${feature} Plan

## Goal

Describe the user-visible outcome this feature must deliver.

## Scope

- In scope:
- Out of scope:

## Verification

- Implementation scope:
- Public interfaces:
- External dependencies:
- Internal dependencies:
- Risky areas:

## Validation

- Core behavior works as designed.

### E2E 시나리오

- Given the feature is available, When the primary workflow is executed, Then the expected result is visible and persistent.

## Skills

### Gradate 단계

- TBD

### Validate 단계

- TBD
`;
}

function gradateTemplate(feature) {
  return `# ${feature} Gradate

## Design

Describe the implementation design that satisfies the plan.

## Implementation Draft

### Architecture Overview

TBD

### Modules

TBD

### Interfaces

TBD

### Dependencies

TBD

### Data Flow

TBD

## Gap Analysis (Pre-Validate)

| Design Item | Implementation Evidence | Status |
| --- | --- | --- |
| TBD | TBD | Pending |

## Implementation Notes

- TBD
`;
}

function validateTemplate(feature) {
  return `# ${feature} Validate

## Scope

Validation report for the PGV feature.

## Validation Checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Plan scenarios executed | SKIP | Pending execution |
| Design implementation gap reviewed | SKIP | Pending gap analysis |

## Gap Table

| Plan/Design Item | Implementation Evidence | Result |
| --- | --- | --- |
| TBD | TBD | SKIP |

## E2E Results

- SKIP: No E2E result recorded yet.

## Skill Usage Log

- TBD

## Action Items

- TBD

## Verdict

SKIP
`;
}

module.exports = {
  planTemplate,
  gradateTemplate,
  validateTemplate
};

export {};
