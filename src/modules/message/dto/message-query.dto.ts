import {
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';

import { MessageRole } from './create-message.dto';

export class MessageQueryDto {
  /**
   * Required: filter messages by conversation.
   * Must belong to the authenticated tenant.
   */
  @IsUUID()
  conversationId!: string;

  /**
   * Optional: filter by role.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               
   */
  @IsOptional()
  @IsEnum(MessageRole)
  role?: MessageRole;
}
