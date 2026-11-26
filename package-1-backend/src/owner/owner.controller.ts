import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuthGuard, Roles } from "../auth/auth.guard";
import { SystemService } from "./system.service";
import { SettingsService } from "./settings.service";
import { LevelService } from "./level.service";
import { Banner } from "./owner.entities";

@Controller()
@UseGuards(AuthGuard)
export class OwnerController {
  constructor(private sys: SystemService, private cfg: SettingsService, private levels: LevelService, @InjectRepository(Banner) private banners: Repository<Banner>) {}

  // ---- Owner: card, master switch, coin limits ----
  @Get("owner/state") @Roles("owner") state() { return this.sys.state(); }
  @Post("owner/kill") @Roles("owner") kill(@Req() r: any) { return this.sys.kill(r.user.sub); }
  @Post("owner/resume") @Roles("owner") resume(@Req() r: any) { return this.sys.resume(r.user.sub); }
  @Post("owner/card") @Roles("owner") card(@Req() r: any, @Body() b: { enabled: boolean }) { return this.sys.setCard(!!b.enabled, r.user.sub); }
  @Get("owner/settings") @Roles("owner") settings() { return this.cfg.all(); }
  @Put("owner/settings/:key") @Roles("owner") setting(@Req() r: any, @Param("key") k: string, @Body() b: { value: number }) { return this.cfg.set(k, b.value, r.user.sub); }

  // ---- Levels ----
  @Get("levels/me") myLevel(@Req() r: any) { return this.levels.levelOf(r.user.sub); }
  @Put("admin/levels/rules") @Roles("owner", "super_admin") rules(@Body() b: { level: number; name: string; minGiftedCoins: number }[]) { return this.levels.setRules(b as any); }
  @Post("admin/levels/:userId") @Roles("owner", "super_admin") override(@Req() r: any, @Param("userId") id: string, @Body() b: { level: number | null }) { return this.levels.setOverride(id, b.level, r.user.sub); }

  // ---- Banners ----
  @Get("banners") async active() {
    const now = new Date();
    return (await this.banners.find({ where: { active: true }, order: { createdAt: "DESC" } })).filter((b) => (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt >= now));
  }
  @Post("admin/banners") @Roles("owner", "super_admin")
  addBanner(@Req() r: any, @Body() b: { title: string; imageUrl: string; linkUrl?: string; startsAt?: string; endsAt?: string }) {
    return this.banners.save(this.banners.create({ title: b.title, imageUrl: b.imageUrl, linkUrl: b.linkUrl ?? null, startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null, createdBy: r.user.sub }));
  }
  @Put("admin/banners/:id") @Roles("owner", "super_admin") async toggle(@Param("id") id: string, @Body() b: { active: boolean }) { await this.banners.update(id, { active: !!b.active }); return { id, active: !!b.active }; }
  @Delete("admin/banners/:id") @Roles("owner", "super_admin") async del(@Param("id") id: string) { await this.banners.delete(id); return { deleted: id }; }
}
