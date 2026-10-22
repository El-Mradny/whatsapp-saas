import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Explicit snake_case plural table names (avoids the reserved word "user" and keeps Supabase's table editor tidy).
// Timestamps are timestamptz so they are timezone-safe in Postgres.

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column() email: string;
  @Column() passwordHash: string;
  @Column() name: string;
  @Column({ nullable: true }) company: string;
  @Column({ nullable: true }) phone: string;
  @Column({ nullable: true }) timezone: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export type NumberStatus = 'created' | 'initializing' | 'qr_ready' | 'authenticating' | 'ready' | 'disconnected' | 'action_required' | 'failed';

@Entity('wa_numbers')
export class WaNumber {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() userId: string;
  @Column() label: string;
  /** OpenWA session id */
  @Column() sessionId: string;
  @Column({ nullable: true }) phone: string;
  @Column({ default: 'created' }) status: NumberStatus;
  @Column({ default: false }) aiEnabled: boolean;
  @Column({ type: 'text', nullable: true }) aiPrompt: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('contacts')
@Index(['userId', 'phone'], { unique: true })
export class Contact {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() name: string;
  @Column() phone: string;
  @Column('simple-array', { nullable: true }) tags: string[];
  @Column({ type: 'text', nullable: true }) notes: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() userId: string;
  @Column() name: string;
  @Column() numberId: string;
  @Column({ type: 'text' }) message: string;
  @Column({ default: 'draft' }) status: CampaignStatus;
  @Column({ type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ default: 8 }) delaySeconds: number;
  @Column({ default: 0 }) totalCount: number;
  @Column({ default: 0 }) sentCount: number;
  @Column({ default: 0 }) failedCount: number;
  @Column({ type: 'text', nullable: true }) mediaUrl: string | null;
  @Column({ type: 'text', nullable: true }) lastError: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('campaign_recipients')
export class CampaignRecipient {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() campaignId: string;
  @Column({ nullable: true }) contactId: string;
  @Column() name: string;
  @Column() phone: string;
  @Column({ default: 'pending' }) status: 'pending' | 'sent' | 'failed';
  @Column({ type: 'text', nullable: true }) error: string;
  @Column({ type: 'timestamptz', nullable: true }) sentAt: Date | null;
}

export type MessageSource = 'manual' | 'campaign' | 'ai' | 'contact';

@Entity('messages')
@Index(['userId', 'numberId', 'chatId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() userId: string;
  @Column() numberId: string;
  /** Contact phone number (digits only) */
  @Column() chatId: string;
  @Column() direction: 'in' | 'out';
  @Column({ default: 'manual' }) source: MessageSource;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'text', nullable: true }) mediaUrl: string | null;
  @Column({ nullable: true }) contactName: string;
  @Column({ nullable: true }) externalId: string;
  @Column({ nullable: true }) campaignId: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SUPPORT';
export type TemplateHeaderType = 'none' | 'text' | 'image';

export interface TemplateButton {
  type: 'quick_reply' | 'url' | 'phone';
  text: string;
  value?: string;
}

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() userId: string;
  @Column() name: string;
  @Column({ default: 'MARKETING' }) category: TemplateCategory;
  @Column({ default: 'en' }) language: string;
  @Column({ default: 'none' }) headerType: TemplateHeaderType;
  @Column({ type: 'text', nullable: true }) headerContent: string | null;
  @Column({ type: 'text' }) body: string;
  @Column({ type: 'text', nullable: true }) footer: string | null;
  @Column('simple-json', { nullable: true }) buttons: TemplateButton[];
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

export const ALL_ENTITIES = [User, WaNumber, Contact, Campaign, CampaignRecipient, Message, Template];

