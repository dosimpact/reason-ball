---
name: apb-ollama-onboarding
description: |
  Guide for onboarding Ollama as a local LLM runtime, from installation and
  model setup through native API checks, OpenAI-compatible endpoint checks,
  runtime options, and speed benchmarking.
  Phases: Install -> Model Setup -> Native API Check -> OpenAI Compatibility -> Runtime Options -> Benchmark.
  Triggers: ollama, ollama onboarding, local llm, ollama api, openai compatible endpoint,
  Ollama 설치, Ollama 온보딩, 로컬 LLM, Ollama API, 올라마, オラマ, ローカルLLM,
  本地 LLM, Ollama 接口, ollama local.
  Do NOT use for: non-Ollama LLM providers, generic OpenAI API documentation,
  production model evaluation.
---

# Ollama Onboarding

> Local Ollama setup and verification guide for installing, running, calling,
> tuning, and benchmarking models on `http://127.0.0.1:11434`.

## Usage

```
$ollama-onboarding install          Check, install, and start Ollama locally
$ollama-onboarding model {name}     Pull, inspect, and run a local Ollama model
$ollama-onboarding api              Verify Ollama native /api endpoints
$ollama-onboarding openai           Verify OpenAI-compatible /v1 endpoints
$ollama-onboarding benchmark        Measure generation speed in tokens/sec
```

## Phase Flow

```
[Install] -> [Model Setup] -> [Native API Check] -> [OpenAI Compatibility] -> [Runtime Options] -> [Benchmark]
```

## Phase Progress Visualization

```
[Install] -> [Model Setup] -> [Native API Check] -> [OpenAI Compatibility] -> [Runtime Options] -> [Benchmark]

Status:
  [Phase] done     -> phase completed
  [Phase] active   -> currently working
  [Phase] pending  -> not yet started
```

---

## Phase:Install

Install Ollama, confirm the CLI is available, and start the local server.

### Prerequisites

- macOS with Homebrew available, or access to the Ollama direct installer.
- Local port `11434` is available.
- Network access is available for installation and model downloads.

### Steps

1. Install Ollama with Homebrew:

   ```
   brew install ollama
   ```

2. If not using Homebrew, install from:

   ```
   https://ollama.com/download
   ```

3. Confirm the CLI is installed:

   ```
   ollama --version
   which ollama
   ```

4. If Homebrew installation fails, check PATH, permissions, and network state:

   ```
   brew update
   brew reinstall ollama
   ```

5. Start, stop, or restart the service with Homebrew:

   ```
   brew services
   brew services start ollama
   brew services stop ollama
   brew services restart ollama
   ```

6. For a one-time foreground server run:

   ```
   ollama serve
   ```

7. Confirm the local server responds:

   ```
   curl -s http://127.0.0.1:11434
   ```

### Output Path

```
http://127.0.0.1:11434
```

---

## Phase:Model Setup

Pull, inspect, list, and run local models before API verification.

### Prerequisites

- Ollama server is running on `http://127.0.0.1:11434`.
- At least one generation model and, when embeddings are needed, one embedding model are selected.

### Steps

1. List installed models and running model processes:

   ```
   ollama list
   ollama ps
   ```

2. Pull or remove models as needed:

   ```
   ollama pull <model>
   ollama rm <model>
   ollama pull gemma4:12b-mlx
   ollama pull gemma4:e2b-mlx
   ollama pull nomic-embed-text-v2-moe
   ```

3. Inspect model metadata:

   ```
   ollama show gemma4:12b-mlx
   ```

4. Start an interactive terminal chat:

   ```
   ollama run gemma4:12b-mlx
   ```

5. Run one-shot prompts against candidate generation models:

   ```
   ollama run gemma4:12b-mlx "한국어로 한 문장 자기소개해줘."
   ollama run gemma4:e2b-mlx "한국어로 한 문장 자기소개해줘."
   ```

6. Confirm the same models work through `/api/generate`:

   ```
   curl -s http://127.0.0.1:11434/api/generate -d '{
     "model": "gemma4:12b-mlx",
     "prompt": "한국어로 한 문장 자기소개해줘.",
     "stream": false
   }'

   curl -s http://127.0.0.1:11434/api/generate -d '{
     "model": "gemma4:e2b-mlx",
     "prompt": "한국어로 한 문장 자기소개해줘.",
     "stream": false
   }'
   ```

### Output Path

```
ollama list
```

---

## Phase:Native API Check

Verify Ollama native API endpoints for generation, chat, and embeddings.

### Prerequisites

- Ollama server is running.
- `gemma4:12b-mlx` or another generation model is installed.
- `nomic-embed-text-v2-moe` or another embedding model is installed for embedding checks.

### Steps

1. Check text generation:

   ```
   curl -s http://127.0.0.1:11434/api/generate -d '{
     "model": "gemma4:12b-mlx",
     "prompt": "한국어로 자기소개해줘.",
     "stream": false
   }'
   ```

2. Check message-based chat:

   ```
   curl -s http://127.0.0.1:11434/api/chat -d '{
     "model": "gemma4:12b-mlx",
     "messages": [
       {"role": "system", "content": "답변은 짧고 정확하게 해."},
       {"role": "user", "content": "Ollama가 뭐야?"}
     ],
     "stream": false
   }'
   ```

3. Check single-input embeddings:

   ```
   curl -s http://127.0.0.1:11434/api/embed -d '{
     "model": "nomic-embed-text-v2-moe",
     "input": "Hello world"
   }'
   ```

4. Check multi-input embeddings:

   ```
   curl -s http://127.0.0.1:11434/api/embed -d '{
     "model": "nomic-embed-text-v2-moe",
     "input": ["첫 번째 문장", "두 번째 문장"]
   }'
   ```

5. Use this native API reference when choosing endpoints:

   ```
   POST   /api/generate          Text generation
   POST   /api/chat              Message-based response
   POST   /api/create            Create a model from a Modelfile
   GET    /api/tags              Local model list
   POST   /api/show              Model metadata
   POST   /api/copy              Copy model name
   DELETE /api/delete            Delete model
   POST   /api/pull              Pull model
   POST   /api/push              Push model
   POST   /api/embed             Generate embeddings
   POST   /api/embeddings        Legacy embeddings
   GET    /api/ps                Running models
   GET    /api/version           Server version
   HEAD   /api/blobs/:digest     Check blob existence
   POST   /api/blobs/:digest     Upload blob
   ```

### Output Path

```
http://127.0.0.1:11434/api
```

---

## Phase:OpenAI Compatibility

Verify Ollama's OpenAI-compatible `/v1` endpoints for SDK and tool integration.

### Prerequisites

- Ollama server is running.
- Target models are installed locally.
- Tools or SDKs are configured to use `http://127.0.0.1:11434/v1`.

### Steps

1. Treat the OpenAI-compatible base URL as:

   ```
   http://127.0.0.1:11434/v1
   ```

2. Check chat completions:

   ```
   curl -s http://127.0.0.1:11434/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma4:12b-mlx",
       "messages": [
         {"role": "user", "content": "한국어로 자기소개해줘."}
       ],
       "stream": false
     }'
   ```

3. Check OpenAI SDK compatibility in Python:

   ```
   from openai import OpenAI

   client = OpenAI(
       base_url="http://127.0.0.1:11434/v1",
       api_key="ollama",
   )
   response = client.chat.completions.create(
       model="gemma4:12b-mlx",
       messages=[{"role": "user", "content": "한국어로 자기소개해줘."}],
   )

   print(response.choices[0].message.content)
   ```

4. Check text completions:

   ```
   curl -s http://127.0.0.1:11434/v1/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma4:12b-mlx",
       "prompt": "한국어로 자기소개해줘.",
       "stream": false
     }'
   ```

5. Check embeddings:

   ```
   curl -s http://127.0.0.1:11434/v1/embeddings \
     -H "Content-Type: application/json" \
     -d '{
       "model": "nomic-embed-text-v2-moe",
       "input": "Hello world"
     }'
   ```

6. List models through the OpenAI-compatible API:

   ```
   curl -s http://127.0.0.1:11434/v1/models
   ```

7. Use this OpenAI-compatible API reference when configuring clients:

   ```
   POST /v1/chat/completions     Chat completions
   POST /v1/completions          Text completions
   POST /v1/embeddings           Embeddings
   GET  /v1/models               Model list
   ```

### Output Path

```
http://127.0.0.1:11434/v1
```

---

## Phase:Runtime Options

Tune generation behavior with Ollama runtime options and confirm option handling through API calls.

### Prerequisites

- Ollama server is running.
- A generation model is installed.
- The user has chosen the desired balance between determinism, diversity, context length, and output length.

### Steps

1. Send options with a generate request:

   ```
   curl -s http://127.0.0.1:11434/api/generate -d '{
     "model": "gemma4:e2b-mlx",
     "prompt": "짧게 요약해줘: 오늘 할 일 정리",
     "stream": false,
     "options": {
       "temperature": 0.1,
       "top_k": 40,
       "top_p": 0.9,
       "num_predict": 300
     }
   }'
   ```

2. Use the main runtime options as follows:

   ```
   temperature    Lower values are more deterministic
   top_p          Probability-mass cutoff
   top_k          Candidate token count limit
   num_ctx        Context length
   num_predict    Maximum output tokens
   seed           Reproducibility control
   keep_alive     Model residency time
   ```

3. Prefer low `temperature` and a fixed `seed` when comparing outputs.
4. Set `num_predict` explicitly when benchmarking or limiting response length.
5. Set `keep_alive` when repeated calls should avoid model reload overhead.

### Output Path

```
http://127.0.0.1:11434/api/generate
```

---

## Phase:Benchmark

Measure local generation speed and compare generation models with a consistent prompt and token limit.

### Prerequisites

- Ollama server is running.
- Candidate generation models are installed.
- The same prompt and `num_predict` value will be used for each generation model.
- Embedding models are excluded from generation-token benchmark comparisons.

### Steps

1. Run a non-streaming generate request:

   ```
   curl -s http://127.0.0.1:11434/api/generate -d '{
     "model": "gemma4:12b-mlx",
     "prompt": "한국어로 300자 정도로 로컬 LLM의 장단점을 설명해줘.",
     "stream": false
   }'
   ```

2. Read these response fields:

   ```
   total_duration
   load_duration
   prompt_eval_count
   prompt_eval_duration
   eval_count
   eval_duration
   ```

3. Calculate generation speed:

   ```
   tokens/sec = eval_count / (eval_duration / 1_000_000_000)
   ```

4. Example calculation:

   ```
   eval_count: 4222
   eval_duration: 141872191666 ns
   speed: 4222 / 141.87 = 29.8 tokens/sec
   ```

5. Benchmark with a fixed prompt and `num_predict`:

   ```
   Prompt: 1문장 자기소개해줘.
   Option: num_predict: 128
   Formula: tokens/sec = eval_count / (eval_duration / 1_000_000_000)
   ```

6. Record results in this shape:

   ```
   MODEL                                      EVAL_COUNT        EVAL_MS   TOKENS_SEC       STATUS
   ----                                       ----------     ----------   ----------       ------
   nomic-embed-text-v2-moe:latest                      -              -            -         FAIL
   gemma4:e2b-mlx                                    128        1800.23        71.10           OK
   gemma4:12b-mlx                                    128        4036.09        31.71           OK
   ```

7. Interpret embedding models separately because `/api/generate` generation fields are not the right comparison metric for embedding workloads.

### Output Path

```
benchmark-results.md
```
