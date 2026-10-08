import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resendClient: Resend;

  constructor(private readonly config: ConfigService) {
    this.resendClient = new Resend(this.config.getOrThrow<string>('RESEND_API_KEY'));
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const { error } = await this.resendClient.emails.send({
      from: this.config.getOrThrow<string>('EMAIL_FROM'),
      to: email,
      subject: 'Reset Your Password',
      html: `
        <p>You requested to reset your password.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
    });

    if (error) {
      throw new InternalServerErrorException('Failed to send password reset email');
    }
  }
}
