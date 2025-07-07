import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { PointHistory, UserPoint } from './point.model';
import { PointBody as PointDto } from './point.dto';
import { PointFacade } from './point.facade';

@Controller('/point')
export class PointController {
  constructor(private readonly pointFacade: PointFacade) {}

  @Get(':id')
  async point(@Param('id') id): Promise<UserPoint> {
    return this.pointFacade.getPoint(parseInt(id));
  }

  @Get(':id/histories')
  async history(@Param('id') id): Promise<PointHistory[]> {
    const userId = Number.parseInt(id);
    return await this.pointFacade.getPointHistory(userId);
  }

  @Patch(':id/charge')
  async charge(
    @Param('id') id,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    return await this.pointFacade.chargePoint(id, pointDto.amount);
  }

  @Patch(':id/use')
  async use(
    @Param('id') id,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    const userId = parseInt(id);
    const amount = pointDto.amount;
    return await this.pointFacade.usePoint(userId, amount);
  }
}
