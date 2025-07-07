import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { DatabaseModule } from 'src/database/database.module';
import { PointService } from './point.service';
import { PointFacade } from './point.facade';
import { PointHistoryService } from './point-history.service';

@Module({
  imports: [DatabaseModule],
  providers: [PointFacade, PointService, PointHistoryService],
  controllers: [PointController],
})
export class PointModule {}
