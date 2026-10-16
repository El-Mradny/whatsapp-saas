import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('overview') overview(@CurrentUser() u: AuthUser, @Query('days') days?: string) {
    const n = Math.min(90, Math.max(1, Number(days) || 14));
    return this.svc.overview(u.id, n);
  }
}
