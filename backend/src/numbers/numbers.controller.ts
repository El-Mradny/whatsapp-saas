import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { CreateNumberDto, NumbersService, UpdateNumberDto } from './numbers.service';

@UseGuards(JwtAuthGuard)
@Controller('numbers')
export class NumbersController {
  constructor(private svc: NumbersService) {}

  @Get() list(@CurrentUser() u: AuthUser) {
    return this.svc.list(u.id);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateNumberDto) {
    return this.svc.create(u.id, dto);
  }
  @Get(':id/qr') qr(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.qr(u.id, id);
  }
  @Post(':id/sync') sync(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.sync(u.id, id);
  }
  @Post(':id/restart') restart(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.restart(u.id, id);
  }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateNumberDto) {
    return this.svc.update(u.id, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }
}
