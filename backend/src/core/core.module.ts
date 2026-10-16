import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_ENTITIES } from '../entities';
import { AiService } from './ai.service';
import { MessagesService } from './messages.service';
import { OpenWaService } from './openwa.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature(ALL_ENTITIES)],
  providers: [OpenWaService, AiService, MessagesService],
  exports: [TypeOrmModule, OpenWaService, AiService, MessagesService],
})
export class CoreModule {}
