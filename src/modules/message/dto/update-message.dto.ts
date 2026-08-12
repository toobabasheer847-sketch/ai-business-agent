import {
  IsInt,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * Messages are append-only (no updatedAt column in the schema).
 * The only permitted update is patching non-content metadata fields
 * such as tokenCount or metadata — never content or role.
 */
export class UpdateMessageDto {
  /**
   * Update the token count (e.g. after AI processing completes).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;

  /**
   * Update or add metadata (e.g. AI model details, latency).
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
