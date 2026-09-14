import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { storeSchema, TodoError, type TodoStore } from "../../shared/todo";
import { emptyStore } from "../core/transitions";
import type { TodoRepository } from "../core/todo-repository";
export type SaveStore = (path: string, store: TodoStore) => Promise<void>;
export async function atomicSave(path: string, store: TodoStore) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify(store, null, 2), { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
export class JsonRepository implements TodoRepository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private path: string,
    private save: SaveStore = atomicSave,
  ) {}
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next;
  }
  private async load(): Promise<TodoStore> {
    try {
      const contents = await readFile(this.path, "utf8");
      try {
        return storeSchema.parse(JSON.parse(contents));
      } catch {
        throw new TodoError(
          "Stored JSON is invalid; original file preserved",
          500,
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const store = emptyStore();
      await this.save(this.path, store);
      return store;
    }
  }
  read() {
    return this.enqueue(() => this.load());
  }
  mutate(
    transform: (store: TodoStore) => TodoStore,
    committed: (store: TodoStore) => void,
  ) {
    return this.enqueue(async () => {
      const next = transform(await this.load());
      await this.save(this.path, next);
      committed(next);
      return next;
    });
  }
}
