import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KycSubmission } from "./kyc.entities";

/**
 * This is manual review only for now (an admin looks at the documents and
 * approves/rejects) — there is no real connection to a KYC vendor (Jumio/Sumsub/Onfido
 * etc.) yet, because the final vendor has not been decided and I don't have confirmed
 * field names for their API. This service still works (withdrawals can depend on manual
 * KYC), and once a vendor is chosen only the logic inside submit()/approve() will change
 * to a vendor call — the outside interface will stay the same.
 */
@Injectable()
export class KycService {
  constructor(@InjectRepository(KycSubmission) private repo: Repository<KycSubmission>) {}

  async submit(userId: string, documents: { type: string; url: string }[]) {
    if (!documents?.length) throw new BadRequestException("কমপক্ষে একটি ডকুমেন্ট দিতে হবে");
    const existing = await this.repo.findOne({ where: { userId, status: "pending" } });
    if (existing) return existing; // prevents submitting twice at the same time
    return this.repo.save(this.repo.create({ userId, documents }));
  }

  statusOf(userId: string) { return this.repo.findOne({ where: { userId }, order: { createdAt: "DESC" } }); }
  async isApproved(userId: string) { return !!(await this.repo.findOne({ where: { userId, status: "approved" } })); }
  listPending() { return this.repo.find({ where: { status: "pending" }, order: { createdAt: "ASC" } }); }

  async review(id: string, adminId: string, status: "approved" | "rejected", note: string) {
    await this.repo.update(id, { status, reviewedBy: adminId, note, reviewedAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }
}
