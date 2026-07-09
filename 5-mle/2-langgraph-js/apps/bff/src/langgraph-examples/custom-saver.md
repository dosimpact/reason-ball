
## Memory Saver example 


```js
import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { buildReactGraph } from "./shared.js";

export interface CheckpointerGraphOptions {
  checkpointer?: BaseCheckpointSaver | boolean;
}

export function buildGraph(options: CheckpointerGraphOptions = {}) {
  return buildReactGraph({
    checkpointer: options.checkpointer
  });
}

export function buildStandaloneGraph() {
  return buildGraph({ checkpointer: new MemorySaver() });
}

export const graph = buildGraph();
export const checkpointerGraph = graph;
```

## Custom Saver - My SQL DB
  
  checkpoints = 상태 스냅샷의 뼈대 + 각 channel version 포인터
  checkpoint_blobs = 각 channel/version의 실제 값
  checkpoint_writes = 아직 checkpoint로 확정되기 전의 pending writes
  
MySQL로 checkpoint를 저장하려면 `MemorySaver`를 그대로 대체할 수 있는
`BaseCheckpointSaver` 구현체를 만들어서 graph compile 시점에 주입한다.

핵심 구조는 다음과 같다.

```ts
return buildGraph({
  checkpointer: new MysqlCheckpointSaver(mysqlPool),
});
```

LangGraph checkpointer는 `thread_id` 기준으로 실행 상태를 저장한다. 같은
`thread_id`로 다시 호출하면 마지막 checkpoint를 읽어서 이전 실행 상태를
이어갈 수 있다. 따라서 graph를 호출할 때는 반드시 `configurable.thread_id`를
전달해야 한다.

```ts
await graph.invoke(
  { messages: [{ role: "user", content: "hello" }] },
  {
    configurable: {
      thread_id: "user-123-session-001",
    },
  },
);
```

### Schema draft

LangGraph.js 공식 saver 기준으로 PostgresSaver는 checkpoint 본체, channel value
blob, pending writes를 분리해서 저장한다. 반면 SqliteSaver는 별도 blob 테이블을
두지 않고 `channel_values`를 serialized checkpoint 본문에 포함한다.

PostgresSaver를 Redis saver 기준으로 보면 다음 역할과 대응된다.

- `checkpoints`: Redis의 `cp` 키와 동일한 역할. checkpoint 본체, metadata,
  parent checkpoint id를 저장한다.
- `checkpoint_blobs`: Redis의 `blobs` 키와 동일한 역할. `channel_values`를
  채널별로 분리 저장한다. 큰 값을 checkpoint 본체에서 분리하고, 채널 단위 접근과
  버전 관리를 하기 위해 필요하다.
- `checkpoint_writes`: Redis의 `writes` 키와 동일한 역할. 특정 superstep에서
  일부 node만 성공하고 이후 node가 실패했을 때, 성공한 write를 재실행 없이
  복원하기 위한 pending writes를 저장한다.

MySQL custom saver를 운영 기준으로 구현한다면 PostgresSaver 구조를 따라
3-table 구조로 잡는 편이 낫다. 단순 개발용 구현은 SQLite처럼 checkpoint 본문에
`channel_values`를 포함하고 writes만 분리하는 2-table 구조도 가능하지만, 공식
Postgres 구조와는 다르다.

```sql
CREATE TABLE langgraph_checkpoints (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  checkpoint_id VARCHAR(255) NOT NULL,
  parent_checkpoint_id VARCHAR(255) NULL,
  checkpoint_json JSON NOT NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id),
  INDEX idx_langgraph_checkpoints_latest (
    thread_id,
    checkpoint_ns,
    created_at
  )
);

CREATE TABLE langgraph_checkpoint_blobs (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  channel VARCHAR(255) NOT NULL,
  version VARCHAR(255) NOT NULL,
  value_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (
    thread_id,
    checkpoint_ns,
    channel,
    version
  )
);

CREATE TABLE langgraph_checkpoint_writes (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  checkpoint_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  idx_num INT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  value_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (
    thread_id,
    checkpoint_ns,
    checkpoint_id,
    task_id,
    idx_num
  )
);
```

## Thread List Table

checkpoint 테이블은 LangGraph saver가 상태 복원을 위해 사용하는 필수 저장소다.
반면 thread list는 LangGraph의 필수 계약이 아니라 BFF에서 대화 목록, 사용자별
조회, 제목, 최근 메시지, 삭제 상태 등을 관리하기 위한 애플리케이션 테이블이다.

따라서 운영 환경에서는 checkpoint 저장소와 별도로 thread 목록용 테이블을 둔다.

```sql
CREATE TABLE langgraph_threads (
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  latest_checkpoint_id VARCHAR(255) NULL,
  latest_message_preview TEXT NULL,
  archived_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id),
  INDEX idx_langgraph_threads_user_updated (
    user_id,
    updated_at
  ),
  INDEX idx_langgraph_threads_user_deleted_updated (
    user_id,
    deleted_at,
    updated_at
  )
);
```

thread list 조회는 saver의 checkpoint `list()`와 분리해서 BFF repository에서
구현하는 편이 낫다. `list()`는 특정 thread의 checkpoint history 조회에 가깝고,
대화방 목록은 사용자 권한과 앱 메타데이터를 기준으로 정렬/필터링해야 하기 때문이다.

사용자와 thread의 관계가 항상 1명의 소유자라면 `langgraph_threads.user_id`만으로
충분하다. 이 경우 `user_id`는 thread owner를 의미한다.

```ts
export async function listThreadsByUser(userId: string, limit = 20) {
  return db.query(
    `
    SELECT
      thread_id,
      title,
      latest_checkpoint_id,
      latest_message_preview,
      created_at,
      updated_at
    FROM langgraph_threads
    WHERE user_id = ?
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT ?
    `,
    [userId, limit],
  );
}
```

하지만 하나의 thread를 여러 사용자가 공유하거나, owner/member/viewer 같은 역할이
필요하다면 thread table에 사용자 정보를 직접 많이 넣지 말고 mapping table을
분리한다.

```sql
CREATE TABLE langgraph_thread_users (
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'owner',
  last_read_checkpoint_id VARCHAR(255) NULL,
  archived_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, user_id),
  INDEX idx_langgraph_thread_users_user_updated (
    user_id,
    updated_at
  ),
  INDEX idx_langgraph_thread_users_user_deleted_updated (
    user_id,
    deleted_at,
    updated_at
  )
);
```

이 구조에서는 `langgraph_threads`는 thread 자체의 메타데이터를 갖고,
`langgraph_thread_users`는 사용자별 접근 권한과 사용자별 상태를 갖는다.
예를 들어 `title`, `latest_checkpoint_id`, `latest_message_preview`는 thread
공통 값이고, `role`, `last_read_checkpoint_id`, `archived_at`, `deleted_at`은
사용자별 값이다.

```ts
export async function listThreadsByMember(userId: string, limit = 20) {
  return db.query(
    `
    SELECT
      t.thread_id,
      t.title,
      t.latest_checkpoint_id,
      t.latest_message_preview,
      tu.role,
      tu.last_read_checkpoint_id,
      t.created_at,
      t.updated_at
    FROM langgraph_thread_users tu
    JOIN langgraph_threads t
      ON t.thread_id = tu.thread_id
    WHERE tu.user_id = ?
      AND tu.deleted_at IS NULL
      AND t.deleted_at IS NULL
    ORDER BY t.updated_at DESC
    LIMIT ?
    `,
    [userId, limit],
  );
}
```

graph 실행 시에는 `thread_id`와 함께 BFF가 관리할 `user_id`를 같이 넘기면
thread table upsert에 사용할 수 있다.

```ts
await graph.invoke(
  { messages: [{ role: "user", content: "hello" }] },
  {
    configurable: {
      thread_id: "conversation-001",
      user_id: "user-123",
    },
  },
);
```

checkpoint 저장은 saver가 담당하고, thread 목록 갱신은 BFF service/repository가
담당하게 분리하는 것을 기본으로 한다. 구현 편의상 saver의 `put()` 안에서
`langgraph_threads`를 upsert할 수도 있지만, 이 경우 LangGraph 저장소와 앱 도메인
저장소의 책임이 섞인다는 점을 고려해야 한다.

### Saver contract

`MysqlCheckpointSaver`는 LangGraph의 `BaseCheckpointSaver` 계약을 구현한다.

```ts
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  BaseCheckpointSaver,
  type Checkpoint,
  type CheckpointListOptions,
  type CheckpointMetadata,
  type CheckpointTuple,
} from "@langchain/langgraph-checkpoint";

export class MysqlCheckpointSaver extends BaseCheckpointSaver {
  constructor(private readonly pool: MySqlPool) {
    super();
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    // 1. configurable.thread_id 확인
    // 2. checkpoint_id가 있으면 특정 checkpoint 조회
    // 3. checkpoint_id가 없으면 해당 thread의 최신 checkpoint 조회
    // 4. checkpoint, metadata, parentConfig, pendingWrites를 복원
    return undefined;
  }

  async *list(
    config: RunnableConfig,
    options?: CheckpointListOptions,
  ): AsyncGenerator<CheckpointTuple> {
    // thread_id, checkpoint_ns, before, limit, filter 조건으로 checkpoint 목록 조회
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
  ): Promise<RunnableConfig> {
    // checkpoint.id를 checkpoint_id로 저장
    // parent checkpoint_id는 config.configurable.checkpoint_id에서 가져온다.
    return {
      ...config,
      configurable: {
        ...config.configurable,
        checkpoint_id: checkpoint.id,
      },
    };
  }

  async putWrites(
    config: RunnableConfig,
    writes: unknown[],
    taskId: string,
  ): Promise<void> {
    // checkpoint_id + taskId + write index 기준으로 pending writes 저장
  }

  async deleteThread(threadId: string): Promise<void> {
    // 해당 thread_id의 checkpoint와 writes를 함께 삭제
  }
}
```

### BFF integration draft

BFF에서는 saver를 graph 내부에 직접 고정하기보다 provider/factory로 주입하는
편이 낫다. 환경에 따라 `MemorySaver`, `MysqlCheckpointSaver`, 또는 LangGraph
공식 DB saver로 바꾸기 쉬워진다.

```ts
import mysql from "mysql2/promise";
import { MysqlCheckpointSaver } from "./checkpointers/mysql-checkpoint-saver.js";

const pool = mysql.createPool({
  uri: process.env.MYSQL_URL,
});

export function buildMysqlCheckpointerGraph() {
  return buildGraph({
    checkpointer: new MysqlCheckpointSaver(pool),
  });
}
```

운영 환경에서는 다음 항목을 추가로 고려한다.

- `MYSQL_URL`은 기존 `.env` 흐름에 맞춰 BFF에서 읽는다.
- checkpoint 저장은 graph 실행 경로에 포함되므로 connection pool을 사용한다.
- `put`과 `putWrites`는 같은 실행 흐름에서 호출되므로 idempotent하게 구현한다.
- `thread_id`는 사용자 ID가 아니라 conversation/session/run 단위 ID로 잡는다.
- LangSmith trace에는 checkpoint 저장 성공/실패와 thread_id를 metadata로 남긴다.

## SQL Table Summary

운영용 MySQL custom saver는 LangGraph.js `PostgresSaver` 구조를 기준으로 잡는다.
LangGraph checkpoint 저장용 테이블과 BFF의 thread list 테이블은 책임이 다르다.

### LangGraph saver tables

```sql
CREATE TABLE langgraph_checkpoints (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  checkpoint_id VARCHAR(255) NOT NULL,
  parent_checkpoint_id VARCHAR(255) NULL,
  checkpoint_json JSON NOT NULL,
  metadata_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id),
  INDEX idx_langgraph_checkpoints_latest (
    thread_id,
    checkpoint_ns,
    created_at
  )
);

CREATE TABLE langgraph_checkpoint_blobs (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  channel VARCHAR(255) NOT NULL,
  version VARCHAR(255) NOT NULL,
  value_type VARCHAR(255) NOT NULL,
  value_blob LONGBLOB NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (
    thread_id,
    checkpoint_ns,
    channel,
    version
  )
);

CREATE TABLE langgraph_checkpoint_writes (
  thread_id VARCHAR(255) NOT NULL,
  checkpoint_ns VARCHAR(255) NOT NULL DEFAULT '',
  checkpoint_id VARCHAR(255) NOT NULL,
  task_id VARCHAR(255) NOT NULL,
  idx_num INT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  value_type VARCHAR(255) NULL,
  value_blob LONGBLOB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (
    thread_id,
    checkpoint_ns,
    checkpoint_id,
    task_id,
    idx_num
  )
);
```

### BFF thread list tables

```sql
CREATE TABLE langgraph_threads (
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NULL,
  latest_checkpoint_id VARCHAR(255) NULL,
  latest_message_preview TEXT NULL,
  archived_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id),
  INDEX idx_langgraph_threads_user_updated (
    user_id,
    updated_at
  ),
  INDEX idx_langgraph_threads_user_deleted_updated (
    user_id,
    deleted_at,
    updated_at
  )
);

CREATE TABLE langgraph_thread_users (
  thread_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'owner',
  last_read_checkpoint_id VARCHAR(255) NULL,
  archived_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (thread_id, user_id),
  INDEX idx_langgraph_thread_users_user_updated (
    user_id,
    updated_at
  ),
  INDEX idx_langgraph_thread_users_user_deleted_updated (
    user_id,
    deleted_at,
    updated_at
  )
);
```

`langgraph_thread_users`는 공유 thread나 사용자별 상태가 필요할 때만 사용한다.
thread가 항상 단일 사용자 소유라면 `langgraph_threads.user_id`만으로도 충분하다.
