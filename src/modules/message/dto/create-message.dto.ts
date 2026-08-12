import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export class CreateMessageDto {
  /**
   * The conversation this message belongs to.
   */
  @IsUUID()
  @IsNotEmpty()
  conversationId: string | undefined;

  /**
   * Role of the message sender.
   */
  @IsEnum(MessageRole)
  role: MessageRole | undefined;

  /**
   * Message content.
   */
  @IsString()
  @IsNotEmpty()
  content: string | undefined;

  /**
   * Optional arbitrary JSON metadata.
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /**
   * Optional token count for AI billing/tracking.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;
}
