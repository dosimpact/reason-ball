---
name: apb-artillery
description: |
  Guide for teaching Artillery usage from the local playbook, initializing
  a performance-test workspace, authoring smoke/load/stress/soak/spike YAML
  scenarios, and running Artillery against a target server.
  Phases: Help -> Initialize -> Author -> Execute -> Review.
  Triggers: artillery, apb artillery, artillery help, artillery playbook,
  performance test, load test, stress test, soak test, smoke test, spike test,
  부하 테스트, 성능 테스트, 스모크 테스트, 스트레스 테스트, 스파이크 테스트.
  Do NOT use for: non-Artillery performance tools, generic unit/integration
  test authoring (use $apb-unit-test-write), UI E2E browser testing
  (use $apb-playwright-e2e), production incident response.
---

# APB Artillery

> Teach, initialize, author, run, and review Artillery performance tests using
> the local Artillery playbook.

## Usage

```
$apb-artillery help                         Show Artillery help from playbook/playbook-1.md.
$apb-artillery init                         Create ./test/performance and report folders.
$apb-artillery load                         Author ./test/performance/load.yml.
$apb-artillery stress                       Author ./test/performance/stress.yml.
$apb-artillery soak                         Author ./test/performance/soak.yml.
$apb-artillery smoke                        Author ./test/performance/smoke.yml.
$apb-artillery spike                        Author ./test/performance/spike.yml.
$apb-artillery run {target_server} {yml}    Run a target server URL against a test YAML file.
$apb-artillery review {json_report}         Generate HTML and summarize an Artillery JSON report.
```

## Phase Flow

```
[Help] -> [Initialize] -> [Author] -> [Execute] -> [Review]
```

## Phase Progress Visualization

```
[Help] -> [Initialize] -> [Author] -> [Execute] -> [Review]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Help

Explain Artillery concepts, commands, and test-type selection using the local
playbook as the source of truth.

### Prerequisites

- Read `playbook/playbook-1.md` before explaining Artillery behavior or test
  design.
- Confirm whether the user wants conceptual guidance, command help, or a file
  to be created.
- Prefer the user's project context over generic examples.

### Steps

1. Explain Artillery as a YAML/JS-based performance testing tool for HTTP,
   WebSocket, and Socket.IO.
2. Teach the core keys from the playbook:
   - `target`
   - `phases`
   - `arrivalRate`
   - `rampTo`
   - `scenarios`
   - `flow`
   - `think`
   - `expect`
   - `ensure`
3. Help the user choose the correct test type:
   - smoke: quick correctness check before heavier tests
   - load: expected traffic at steady volume
   - stress: gradually increasing traffic to find limits
   - soak: long-running stability and leak detection
   - spike: sudden traffic increase and recovery check
4. Show runnable command patterns:

```bash
npx artillery run ./test/performance/load.yml
TARGET_URL=http://localhost:3000 npx artillery run ./test/performance/load.yml --output reports/load.json
npx artillery report reports/load.json --output reports/load.html
```

### Output Path

```
playbook/playbook-1.md
```

---

## Phase:Initialize

Create the default Artillery workspace in the current project.

### Prerequisites

- Work from the target project's root directory.
- Do not overwrite existing scenario, payload, processor, or report files.
- Use `./test/performance` as the default scenario directory unless the user
  explicitly requests another path.

### Steps

1. Create the scenario directory:

```bash
mkdir -p ./test/performance
```

2. Create supporting directories:

```bash
mkdir -p ./test/performance/payloads ./reports
```

3. Add a `.gitkeep` file only when an empty directory needs to be preserved.
4. If the project uses Node.js and has no Artillery dependency, recommend:

```bash
npm install --save-dev artillery
```

5. Keep credentials and environment-specific values out of committed files.

### Output Path

```
./test/performance
```

---

## Phase:Author

Write one of the supported Artillery YAML scenarios: smoke, load, stress, soak,
or spike.

### Prerequisites

- The target server base URL is known or will be supplied with `TARGET_URL`.
- The endpoint flow, expected status codes, headers, and authentication needs
  are known.
- The user selected one test type: `smoke`, `load`, `stress`, `soak`, or
  `spike`.

### Steps

1. Put scenario YAML files in `./test/performance`.
2. Use environment interpolation for the target:

```yaml
config:
  target: "{{ $processEnvironment.TARGET_URL }}"
```

3. Include `expect` assertions on important requests.
4. Include `ensure` thresholds so the test can fail automatically.
5. Use these default phase patterns unless the user provides traffic numbers:

```yaml
# smoke.yml
phases:
  - name: smoke
    duration: 30
    arrivalRate: 1
```

```yaml
# load.yml
phases:
  - name: warmup
    duration: 60
    arrivalRate: 5
    rampTo: 20
  - name: load
    duration: 300
    arrivalRate: 20
```

```yaml
# stress.yml
phases:
  - name: warmup
    duration: 60
    arrivalRate: 5
    rampTo: 20
  - name: stress
    duration: 300
    arrivalRate: 20
    rampTo: 100
  - name: recovery
    duration: 120
    arrivalRate: 10
```

```yaml
# soak.yml
phases:
  - name: soak
    duration: 3600
    arrivalRate: 10
```

```yaml
# spike.yml
phases:
  - name: baseline
    duration: 120
    arrivalRate: 5
  - name: spike
    duration: 60
    arrivalRate: 100
  - name: recovery
    duration: 180
    arrivalRate: 10
```

6. Use this minimal scenario body when no project-specific flow is known:

```yaml
scenarios:
  - name: health-check
    flow:
      - get:
          url: /health
          expect:
            - statusCode: 200
```

7. For authenticated APIs, login first, capture the token, and reuse it:

```yaml
capture:
  - json: "$.accessToken"
    as: token
```

8. Add `./test/performance/processor.js` when dynamic data, request IDs, or
   hooks are needed.

### Output Path

```
./test/performance/smoke.yml
```

---

## Phase:Execute

Run a selected Artillery YAML file against a target server and produce a JSON
result.

### Prerequisites

- Required arguments are available:
  - target server URL, for example `http://localhost:3000`
  - test YAML path, for example `./test/performance/load.yml`
- The target server is running and reachable.
- Artillery is available through `npx artillery` or a project script.

### Steps

1. Use the required run command shape:

```bash
TARGET_URL=http://localhost:3000 npx artillery run ./test/performance/load.yml --output reports/load.json
```

2. Replace `TARGET_URL` with the supplied target server.
3. Replace the YAML path with the supplied test file.
4. Choose a report JSON name that matches the YAML file:
   - `smoke.yml` -> `reports/smoke.json`
   - `load.yml` -> `reports/load.json`
   - `stress.yml` -> `reports/stress.json`
   - `soak.yml` -> `reports/soak.json`
   - `spike.yml` -> `reports/spike.json`
5. For a quick syntax or connectivity check, run `smoke.yml` before heavier
   tests.
6. Do not run high-intensity stress, soak, or spike tests against shared or
   production systems without explicit user confirmation.

### Output Path

```
reports/load.json
```

---

## Phase:Review

Generate an HTML report when possible and summarize the performance result.

### Prerequisites

- A JSON result file exists under `reports/`.
- The Artillery run completed or failed with useful output.
- Any related server metrics or logs are available if the user wants
  correlation.

### Steps

1. Convert JSON output to HTML:

```bash
npx artillery report reports/load.json --output reports/load.html
```

2. Summarize the important Artillery metrics:
   - request rate
   - response time median
   - response time p95 and p99
   - HTTP status code distribution
   - error rate
   - named errors such as timeouts or connection resets
3. Compare results against `ensure` gates.
4. For failures, identify whether the likely cause is scenario syntax, target
   reachability, authentication, capacity, latency, or server errors.
5. When observability is available, correlate with CPU, memory, event-loop lag,
   GC, request duration, and logs.

### Output Path

```
reports/load.html
```
