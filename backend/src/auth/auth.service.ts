import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { Repository } from 'typeorm';
import { User } from '../entities';

export class RegisterDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsString() company?: string;
}
export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() timezone?: string;
}
export class ChangePasswordDto {
  @IsString() currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
}

@Injectable()
export class AuthService {
  constructor(@InjectRepository(User) private users: Repository<User>, private jwt: JwtService) {}

  private publicUser(u: User) {
    const { passwordHash, ...rest } = u;
    return rest;
  }

  private issue(u: User) {
    return { token: this.jwt.sign({ sub: u.id, email: u.email }), user: this.publicUser(u) };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findOne({ where: { email } })) throw new ConflictException('Email already registered');
    const user = await this.users.save(
      this.users.create({
        email,
        name: dto.name.trim(),
        company: dto.company,
        passwordHash: await bcrypt.hash(dto.password, 10),
      }),
    );
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issue(user);
  }

  async me(id: string) {
    return this.publicUser(await this.users.findOneOrFail({ where: { id } }));
  }

  async update(id: string, dto: UpdateProfileDto) {
    const user = await this.users.findOneOrFail({ where: { id } });
    Object.assign(user, dto);
    return this.publicUser(await this.users.save(user));
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    const user = await this.users.findOneOrFail({ where: { id } });
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
    return { ok: true };
  }
}
