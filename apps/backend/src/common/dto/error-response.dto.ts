export class ErrorResponseDto {
  statusCode!: number;
  message!: string;
  error!: string;
  timestamp!: string;
  path!: string;
  requestId?: string;
}

