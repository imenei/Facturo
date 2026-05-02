import { Controller, Post, Get, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send-reminder/:invoiceId')
  sendReminder(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { channels?: { email?: boolean; whatsapp?: boolean; sms?: boolean } },
  ) {
    const channels = body.channels || { email: true };
    return this.notificationsService.sendAllReminders(invoiceId, channels);
  }

  @Post('send-reminder/:invoiceId/email')
  sendEmail(@Param('invoiceId') invoiceId: string) {
    return this.notificationsService.sendEmailReminder(invoiceId);
  }

  @Post('send-reminder/:invoiceId/whatsapp')
  sendWhatsApp(@Param('invoiceId') invoiceId: string) {
    return this.notificationsService.sendWhatsAppReminder(invoiceId);
  }

  @Post('send-reminder/:invoiceId/sms')
  sendSms(@Param('invoiceId') invoiceId: string) {
    return this.notificationsService.sendSmsReminder(invoiceId);
  }

  // MOD 8b: Get current email template
  @Get('email-template')
  getEmailTemplate() {
    return this.notificationsService.getEmailTemplate();
  }

  // MOD 8b: Save custom email template
  @Put('email-template')
  saveEmailTemplate(@Body() body: { subject: string; body: string }) {
    this.notificationsService.saveEmailTemplate(body.subject, body.body);
    return { success: true, message: 'Modèle enregistré' };
  }

  // MOD 8b: Reset email template to default
  @Delete('email-template')
  @Roles(UserRole.ADMIN)
  resetEmailTemplate() {
    this.notificationsService.resetEmailTemplate();
    return { success: true, message: 'Modèle réinitialisé au défaut' };
  }
}
