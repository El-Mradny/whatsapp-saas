import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { InboxService, ReplyDto, SuggestDto } from './inbox.service';

@UseGuards(JwtAuthGuard)
@Controller('inbox')
export class InboxController {
  constructor(private svc: InboxService) {}

  @Get('conversations') conversations(@CurrentUser() u: AuthUser, @Query('numberId') numberId?: string) {
    return this.svc.conversations(u.id, numberId);
  }


  @Get('thread/:numberId/:chatId') thread(
    @CurrentUser() u: AuthUser,
    @Param('numberId') numberId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.svc.thread(u.id, numberId, chatId);
  }
  @Post('reply') reply(@CurrentUser() u: AuthUser, @Body() dto: ReplyDto) {
    return this.svc.reply(u.id, dto);
  }
  @Post('suggest') suggest(@CurrentUser() u: AuthUser, @Body() dto: SuggestDto) {
    return this.svc.suggest(u.id, dto);
  }
}
