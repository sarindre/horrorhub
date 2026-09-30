// In-memory stand-ins for the browser's folder and IndexedDB APIs, for tests.

// A directory handle like the File System Access API's: files by name,
// getFileHandle / createWritable / values / removeEntry, and permission calls.
export function fakeDirectory({ name = "Backups", permission = "granted", files = {} } = {}) {
  const store = new Map(Object.entries(files));
  const calls = { queried: 0, requested: 0, writes: [] };
  const dir = {
    kind: "directory",
    name,
    store,
    calls,
    permission,
    async queryPermission() {
      calls.queried++;
      return dir.permission;
    },
    async requestPermission() {
      calls.requested++;
      if (dir.permission === "prompt") dir.permission = dir.grantOnRequest === false ? "denied" : "granted";
      return dir.permission;
    },
    async getFileHandle(fileName, { create } = {}) {
      if (dir.permission !== "granted") throw new DOMException("not allowed", "NotAllowedError");
      if (!store.has(fileName) && !create) throw new DOMException("missing", "NotFoundError");
      if (!store.has(fileName)) store.set(fileName, "");
      return {
        async createWritable() {
          let text = "";
          return {
            async write(chunk) {
              text += chunk;
            },
            async close() {
              store.set(fileName, text);
              calls.writes.push(fileName);
            },
          };
        },
      };
    },
    async *values() {
      for (const fileName of [...store.keys()]) yield { kind: "file", name: fileName };
    },
    async removeEntry(fileName) {
      store.delete(fileName);
    },
  };
  return dir;
}

// Just enough of indexedDB for one object store of key/value pairs.
export function fakeIndexedDB() {
  const data = new Map();
  const done = (result) => {
    const req = { result };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  };
  const store = {
    put: (value, key) => (data.set(key, value), done(undefined)),
    get: (key) => done(data.get(key)),
    delete: (key) => (data.delete(key), done(undefined)),
  };
  return {
    data,
    open() {
      const req = { result: { createObjectStore() {}, transaction: () => ({ objectStore: () => store }), close() {} } };
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}
