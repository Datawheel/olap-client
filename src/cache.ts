export class CacheManager<T> {
  private store: Map<string, T> = new Map();
  private keygen: (item: T) => string;
  private filled = false;

  constructor(keygen: (item: T) => string) {
    this.keygen = keygen;
  }

  declareFilled(): void {
    this.filled = true;
  }

  getAllItems(fallback: () => T[] | Promise<T[]>): Promise<T[]> {
    const items = this.filled ? [...this.store.values()] : fallback();
    return Promise.resolve(items).then((items) => {
      const keygen = this.keygen;
      this.filled = true;
      this.store = new Map(items.map((item) => [keygen(item), item]));
      return items;
    });
  }

  getItem(key: string, fallback: () => T | Promise<T>): Promise<T> {
    const item = this.store.get(key) || fallback();
    return Promise.resolve(item).then((item) => {
      this.store.set(this.keygen(item), item);
      return item;
    });
  }

  getKeygen(): (item: T) => string {
    return this.keygen;
  }
}
