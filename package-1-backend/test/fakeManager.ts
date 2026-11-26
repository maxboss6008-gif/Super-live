// হালকা ফেক EntityManager: আসল Postgres ছাড়া WalletService-এর ট্রানজ্যাকশন লজিক পরীক্ষার জন্য।
// শুধু ঐ মেথডগুলো বাস্তবায়ন করে যা WalletService ব্যবহার করে — পূর্ণাঙ্গ TypeORM নকল নয়।
import { randomUUID } from "crypto";

export class FakeManager {
  tables = new Map<string, Map<string, any>>();
  queryRunner = {}; // সত্যি থাকলে ধরে নেয় ট্রানজ্যাকশনের ভেতরে আছি (lock প্রযোজ্য কিনা বোঝাতে)

  private table(entity: any) {
    const name = entity.name || entity;
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  async findOne(entity: any, opts: { where: any }) {
    const rows = [...this.table(entity).values()];
    return rows.find((r) => Object.entries(opts.where).every(([k, v]) => r[k] === v)) || null;
  }
  async findOneOrFail(entity: any, opts: any) {
    const r = await this.findOne(entity, opts); if (!r) throw new Error("not found"); return r;
  }
  async save(entity: any, row: any) {
    if (!row.id) row.id = randomUUID();
    this.table(entity).set(row.id, row); return row;
  }
  async insert(entity: any, row: any) {
    const id = randomUUID(); this.table(entity).set(id, { id, ...row }); return { identifiers: [{ id }] };
  }
  createQueryBuilder() {
    let target: any;
    const qb: any = {
      insert: () => qb, into: (e: any) => { target = e; return qb; }, values: (v: any) => { qb._v = v; return qb; },
      orIgnore: () => qb,
      execute: async () => {
        const exists = await this.findOne(target, { where: qb._v });
        if (!exists) await this.save(target, { ...qb._v });
        return {};
      },
    };
    return qb;
  }
}

export class FakeDataSource {
  manager = new FakeManager();
  async transaction(fn: (m: FakeManager) => any) { return fn(this.manager); }
}
