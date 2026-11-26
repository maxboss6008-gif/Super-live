// হালকা ফেক Repository<User> — আসল TypeORM/Postgres ছাড়া AuthService পরীক্ষার জন্য।
import { randomUUID } from "crypto";

export class FakeUsersRepo {
  rows = new Map<string, any>();
  create(data: any) { return { id: undefined, failedCount: 0, knownDevices: [], lockedUntil: null, lastLockAt: null, withdrawalBlockedUntil: null, ...data }; }
  async save(row: any) { if (!row.id) row.id = randomUUID(); this.rows.set(row.id, row); return row; }
  async findOne(opts: { where: any }) {
    const rows = [...this.rows.values()];
    return rows.find((r) => Object.entries(opts.where).every(([k, v]) => r[k] === v)) || null;
  }
  async update(id: string, patch: any) { const r = this.rows.get(id); if (r) Object.assign(r, patch); return r; }
}

export class FakeRedis {
  store = new Map<string, string>();
  async set(k: string, v: string, ..._opts: any[]) { this.store.set(k, v); return "OK"; }
  async get(k: string) { return this.store.get(k) ?? null; }
  async del(k: string) { this.store.delete(k); }
}
