import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ReviewRequestDto {
  @ApiProperty({ enum: [RequestStatus.APPROVED, RequestStatus.REJECTED] })
  @IsEnum(RequestStatus)
  status!: 'APPROVED' | 'REJECTED';
}
