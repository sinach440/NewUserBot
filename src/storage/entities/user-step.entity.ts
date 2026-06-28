import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

/** User progress steps for reminder targeting. */
export type Step =
  | 'start'
  | 'awaiting_uid'
  | 'after_signup'
  | 'not_registered'
  | 'account_too_old'
  | 'insufficient_funds'
  | 'verified';

@Entity('user_steps')
export class UserStep {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  @Index('IDX_user_steps_telegram_id', { unique: true })
  telegramId: string;

  @Column({ type: 'varchar', length: 32 })
  step: Step;

  @Column({ name: 'step_updated_at', type: 'timestamp' })
  stepUpdatedAt: Date;

  /** When we last sent a reminder for this step (null = not yet). */
  @Column({ type: 'timestamp', nullable: true, name: 'reminder_sent_at' })
  reminderSentAt: Date | null;
}
