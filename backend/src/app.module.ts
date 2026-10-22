import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { requireEnv } from './common/env';
import { ContactsModule } from './contacts/contacts.module';
import { CoreModule } from './core/core.module';
import { ALL_ENTITIES } from './entities';
import { InboxModule } from './messages/inbox.module';
import { NumbersModule } from './numbers/numbers.module';
import { TemplatesModule } from './templates/templates.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Supabase Postgres. Supabase requires TLS, so SSL is on unless DB_SSL=false (local Postgres).
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: requireEnv('DATABASE_URL'),
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      entities: ALL_ENTITIES,
      // Creates/updates tables automatically. Handy for the first run; set DB_SYNCHRONIZE=false afterwards
      // and manage schema changes with migrations.
      synchronize: process.env.DB_SYNCHRONIZE !== 'false',
      extra: { max: Number(process.env.DB_POOL_MAX || 10) },
    }),
    CoreModule,
    AuthModule,
    NumbersModule,
    ContactsModule,
    CampaignsModule,
    TemplatesModule,
    InboxModule,
    WebhooksModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
