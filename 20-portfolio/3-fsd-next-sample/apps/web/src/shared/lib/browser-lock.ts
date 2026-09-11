function runSynchronous<T>(operation: () => T): T {
  const result = operation();
  if (result !== null && (typeof result === "object" || typeof result === "function") && "then" in result) {
    throw new Error("Browser storage lock operations must be synchronous.");
  }
  return result;
}

/** Cross-tab exclusion for synchronous storage read/compare/write operations. */
export function withBrowserStorageLock<T>(name: string, operation: () => T): Promise<T> {
  if (globalThis.navigator?.locks) {
    return navigator.locks.request(name, () => runSynchronous(operation));
  }
  if (!globalThis.indexedDB) return Promise.reject(new Error("이 브라우저에서는 안전한 전송 기록 잠금을 사용할 수 없어요."));

  // HTTP supports IndexedDB. Readwrite transactions on this store serialize
  // across tabs; all fallback lock names intentionally share the same scope.
  return new Promise<T>((resolve, reject) => {
    const request = indexedDB.open("lingua-browser-storage-locks-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("locks");
    request.onerror = () => reject(request.error ?? new Error("전송 기록 잠금을 열지 못했어요."));
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      let transaction: IDBTransaction;
      try { transaction = database.transaction("locks", "readwrite"); }
      catch (error) { database.close(); reject(error); return; }
      let result: T;
      let operationError: unknown;
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onabort = () => { database.close(); reject(operationError ?? transaction.error ?? new Error("전송 기록 잠금이 중단됐어요.")); };
      // Run only after the request succeeds: the transaction then owns the
      // cross-tab write lock. No awaits are allowed inside this critical section.
      transaction.objectStore("locks").get(name).onsuccess = () => {
        try { result = runSynchronous(operation); }
        catch (error) { operationError = error; transaction.abort(); }
      };
    };
  });
}
