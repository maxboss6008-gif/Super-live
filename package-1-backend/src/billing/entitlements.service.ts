import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Entitlement } from "./billing.entities";
import { Feature } from "./pricing";

@Injectable()
export class EntitlementsService {
  constructor(@InjectRepository(Entitlement) private repo: Repository<Entitlement>) {}
  async isUnlimited(userId: string, feature: Feature) {
    return !!(await this.repo.findOne({ where: { userId, feature, unlimited: true } }));
  }
  async set(userId: string, feature: Feature, unlimited: boolean, adminId: string) {
    const e = (await this.repo.findOne({ where: { userId, feature } })) || this.repo.create({ userId, feature });
    e.unlimited = unlimited; e.setBy = adminId;
    return this.repo.save(e);
  }
}
