import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { CampaignsService, CreateCampaignDto, ScheduleDto } from './campaigns.service';

@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private svc: CampaignsService) {}

  @Get() list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateCampaignDto) {
    return this.svc.create(u.id, dto);
  }
  @Get(':id') detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.detail(u.id, id);
  }
  @Post(':id/start') start(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.start(u.id, id);
  }
  @Post(':id/schedule') schedule(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ScheduleDto) {
    return this.svc.schedule(u.id, id, dto);
  }
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.cancel(u.id, id);
  }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }
}
