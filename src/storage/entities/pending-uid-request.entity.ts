import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('pending_uid_requests')
export class PendingUidRequest {
  @PrimaryGeneratedColumn()
  id: number;

  /** Telegram user id we asked for UID. One pending per user (replaced on new request). */
  @Column({ type: 'varchar', length: 32 })
  @Index('IDX_pending_uid_requests_telegram_id', { unique: true })
  telegramId: string;

  @CreateDateColumn({ name: 'asked_at' })
  askedAt: Date;

  /** When we sent the 24h reminder (null = not yet). */
  @Column({ type: 'timestamp', nullable: true, name: 'reminder_sent_at' })
  reminderSentAt: Date | null;
}
