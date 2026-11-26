import { BadRequestException } from "@nestjs/common";
import { CallsService } from "../src/billing/calls.service";
import { CALL_RATE_MAX, CALL_RATE_MIN } from "../src/billing/pricing";

describe("CallsService.setRate — কলের রেট সীমা", () => {
  it("সীমার বাইরের রেট প্রত্যাখ্যান করে", async () => {
    const cfg = { get: async (_k: string, def: number) => def } as any;
    const svc = new CallsService({} as any, {} as any, {} as any, {} as any, {} as any, cfg);
    await expect(svc.setRate("host1", CALL_RATE_MIN - 1)).rejects.toThrow(BadRequestException);
    await expect(svc.setRate("host1", CALL_RATE_MAX + 1)).rejects.toThrow(BadRequestException);
  });
});
