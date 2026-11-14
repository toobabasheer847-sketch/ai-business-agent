import { IsUUID } from 'class-validator';

export class ConfirmOrchestrationDto {
  @IsUUID()
  conversationId!: string;

  @IsUUID()
  orchestrationId!: string;
}
