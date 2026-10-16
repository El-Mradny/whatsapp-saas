import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { BulkDeleteDto, ContactDto, ContactsService, ImportDto, UpdateContactDto } from './contacts.service';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private svc: ContactsService) {}

  @Get() list(@CurrentUser() u: AuthUser, @Query('search') search?: string, @Query('tag') tag?: string) {
    return this.svc.list(u.id, search, tag);
  }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: ContactDto) {
    return this.svc.create(u.id, dto);
  }
  @Post('import') import(@CurrentUser() u: AuthUser, @Body() dto: ImportDto) {
    return this.svc.importCsv(u.id, dto.csv);
  }
  @Post('bulk-delete') bulk(@CurrentUser() u: AuthUser, @Body() dto: BulkDeleteDto) {
    return this.svc.bulkRemove(u.id, dto.ids);
  }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.svc.update(u.id, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }
}
