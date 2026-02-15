declare module "node:async_hooks" {
  export class AsyncLocalStorage<T = unknown> {
    getStore(): T | undefined;
    run<R>(store: T, callback: () => R): R;
    exit<R>(callback: () => R): R;
    enterWith(store: T): void;
    disable(): void;
  }
}
