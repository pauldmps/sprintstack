import { Module } from '@nestjs/common';
import { StorageService } from '@/storage/storage.service';
import { TeamResolver } from './team.resolver.js';
import { TeamService } from './team.service.js';

/** A project's team: members, holidays, time off and sprint capacity. */
@Module({
  providers: [TeamService, TeamResolver, StorageService],
})
export class TeamModule {}
