import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AppSetting } from "./owner.entities";

export const SETTING_KEYS = ["FREE_MESSAGES_PER_DAY", "MESSAGE_COST_COINS", "CALL_RATE_MIN", "CALL_RATE_MAX"];

@Injectable()
export class SettingsService {
  private cache = new Map<string, { v: number; at: number }>();
  constructor(@InjectRepository(AppSetting) private repo: Repository<AppSetting>) {}
  async get(key: string, def: number) {
    const c = this.cache.get(key); if (c && Date.now() - c.at < 10_000) return c.v;
    const row = await this.repo.findOne({ where: { key } }); const v = row ? row.value : def;
    this.cache.set(key, { v, at: Date.now() }); return v;
  }
  async set(key: string, value: number, by: string) {
    if (!SETTING_KEYS.includes(key)) throw new BadRequestException("অজানা সেটিং"); // unknown setting
    if (!Number.isInteger(value) || value < 0) throw new BadRequestException("মান অবশ্যই ০ বা তার বেশি পূর্ণসংখ্যা"); // value must be an integer >= 0
    await this.repo.save({ key, value, changedBy: by }); this.cache.delete(key);
    return { key, value };
  }
  all() { return this.repo.find(); }
}
