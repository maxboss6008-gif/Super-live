import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SystemService } from "./owner/system.service";
(async () => {
  const app = await NestFactory.create(AppModule, { rawBody: true }); // needed for webhook signature verification
  app.setGlobalPrefix("api");
  const sys = app.get(SystemService);
  // While the master kill switch is on (max 24 hours), only owner routes and the payment webhook stay open
  app.use(async (req: any, res: any, next: any) => {
    const open = ["/api/owner", "/api/payments/webhook", "/api/auth/admin/login"].some((p) => req.path.startsWith(p));
    if (open || (await sys.state()).serverEnabled) return next();
    res.status(503).json({ message: "অ্যাপ সাময়িকভাবে বন্ধ আছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" });
  });
  // Explicitly bind to 0.0.0.0 — Render (and most PaaS) route external traffic to the
  // container's public interface, not just localhost; binding with no host can fail to
  // receive traffic on some platforms even though the process itself starts fine.
  await app.listen(process.env.PORT || 3000, "0.0.0.0");
})();
