import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService, ChangePasswordDto, LoginDto, RegisterDto, UpdateProfileDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login') login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser() u: AuthUser) {
    return this.auth.me(u.id);
  }

  @UseGuards(JwtAuthGuard) @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.auth.update(u.id, dto);
  }

  @UseGuards(JwtAuthGuard) @Post('password') password(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(u.id, dto);
  }
}
