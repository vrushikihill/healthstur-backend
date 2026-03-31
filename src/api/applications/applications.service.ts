import {
  Injectable,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Cashfree, CFEnvironment } from 'cashfree-pg';
import * as puppeteer from 'puppeteer';
import * as nodemailer from 'nodemailer';
import * as path from 'path';

@Injectable()
export class ApplicationsService {
  private cashfree: Cashfree;

  constructor(private readonly prisma: PrismaService) {
    this.cashfree = new Cashfree(
      CFEnvironment.PRODUCTION,
      process.env.CASHFREE_CLIENT_ID || '',
      process.env.CASHFREE_CLIENT_SECRET || '',
    );
    this.cashfree.XApiVersion = '2023-08-01';
  }

  async create(createApplicationDto: CreateApplicationDto) {
    if (createApplicationDto.amount && createApplicationDto.currency) {
      const numericAmount = parseFloat(
        createApplicationDto.amount.replace(/[^0-9.]/g, ''),
      );
      if (!isNaN(numericAmount) && numericAmount > 0) {
        const cleanPhone =
          createApplicationDto.mobileNumber?.replace(/\D/g, '').slice(-10) ||
          '9999999999';

        try {
          const request = {
            order_id: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            order_amount: numericAmount,
            order_currency: createApplicationDto.currency,
            customer_details: {
              customer_id:
                `cust${Date.now()}${Math.random().toString(36).substring(7)}`.replace(
                  /[^a-zA-Z0-9]/g,
                  '',
                ),
              customer_email:
                createApplicationDto.email || 'no-email@healthstur.com',
              customer_phone: cleanPhone,
              customer_name: createApplicationDto.fullName || 'Guest',
            },
          };

          const response = await this.cashfree.PGCreateOrder(request);

          // Return the payment session ID for Cashfree Checkout.
          return {
            paymentSessionId: response.data.payment_session_id,
            cashfreeOrderId: response.data.order_id,
          };
        } catch (error: any) {
          console.error(
            'Cashfree Order Creation Error:',
            JSON.stringify(error?.response?.data || error, null, 2),
          );
          throw new BadRequestException(
            error?.response?.data?.message ||
              error?.error?.description ||
              'Failed to create payment order',
          );
        }
      }
    }

    // For free programs or zero amount requests, save immediately.
    const application = await this.prisma.application.create({
      data: {
        ...createApplicationDto,
        paymentStatus: 'SUCCESS',
      },
    });

    return { application };
  }

  async verifyPayment(body: any) {
    const { order_id, applicationData } = body;

    try {
      if (!applicationData) {
        throw new BadRequestException(
          'Missing application data for finalized recording.',
        );
      }

      const response = await this.cashfree.PGOrderFetchPayments(order_id);

      const successfulPayment = response.data?.filter(
        (payment: any) => payment.payment_status === 'SUCCESS',
      );

      if (!successfulPayment || successfulPayment.length === 0) {
        throw new BadRequestException('Invalid payment verification failed');
      }

      const payment = successfulPayment[0];

      const newApplication = await this.prisma.application.create({
        data: {
          ...applicationData,
          paymentStatus: 'SUCCESS',
          cashfreeOrderId: order_id,
          cashfreePaymentId: payment.cf_payment_id?.toString() || '',
        },
      });

      // Fire off async email/invoice generation
      this.generateAndSendInvoice(newApplication).catch(() => {});

      return { success: true, application: newApplication };
    } catch (error: any) {
      throw new BadRequestException(error.message || 'Verification failed');
    }
  }

  async handleWebhook(req: any, headers: any) {
    try {
      const signature = headers['x-webhook-signature'];
      const timestamp = headers['x-webhook-timestamp'];
      // NestJS rawBody is typically a Buffer when enabled via NestFactory options
      const rawBody = req.rawBody
        ? req.rawBody.toString('utf8')
        : JSON.stringify(req.body);

      this.cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);

      const payload = req.body;
      console.log(
        'Webhook Received:',
        payload.type,
        JSON.stringify(payload, null, 2),
      );

      if (payload.type === 'PAYMENT_SUCCESS_WEBHOOK') {
        const orderId = payload.data.order.order_id;
        const application = await this.prisma.application.findFirst({
          where: { cashfreeOrderId: orderId },
        });

        if (application && application.paymentStatus !== 'SUCCESS') {
          await this.prisma.application.update({
            where: { id: application.id },
            data: {
              paymentStatus: 'SUCCESS',
            },
          });
        }
      } else if (payload.type === 'REFUND_STATUS_WEBHOOK') {
        const orderId = payload.data.refund.order_id;
        const refundStatus = payload.data.refund.refund_status;
        const application = await this.prisma.application.findFirst({
          where: { cashfreeOrderId: orderId },
        });
        if (application) {
          console.log(
            `Updating Application ${application.id} to ${refundStatus} from Webhook`,
          );
          await this.prisma.application.update({
            where: { id: application.id },
            data: {
              paymentStatus:
                refundStatus?.toUpperCase() === 'SUCCESS'
                  ? 'REFUNDED'
                  : 'REFUND_PENDING',
              cashfreeRefundId: payload.data.refund.refund_id,
              refundDetails: payload.data.refund,
            },
          });
        }
      }

      return { status: 'OK' };
    } catch (err) {
      throw new HttpException(
        'Invalid Webhook Signature',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private getInvoiceHtml(application: any) {
    return `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 40px; }
            .container { max-width: 800px; margin: auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #023051; }
            .title { font-size: 24px; color: #374151; margin-top: 10px; }
            .details { margin-bottom: 30px; }
            .details table { width: 100%; border-collapse: collapse; }
            .details th, .details td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .details th { color: #6b7280; font-weight: 600; width: 40%; }
            .details td { color: #111827; font-weight: 500; }
            .footer { text-align: center; margin-top: 40px; color: #9ca3af; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">Healthstur</div>
              <div class="title">Payment Receipt & Invoice</div>
            </div>
            
            <div class="details">
              <table>
                <tr>
                  <th>Date</th>
                  <td>${new Date(application.createdAt).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <th>Order ID</th>
                  <td>${application.cashfreeOrderId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Payment ID</th>
                  <td>${application.cashfreePaymentId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Customer Name</th>
                  <td>${application.fullName}</td>
                </tr>
                <tr>
                  <th>Email Address</th>
                  <td>${application.email || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Program Purchased</th>
                  <td>${application.selectedProgram || 'General Application'}</td>
                </tr>
                <tr>
                  <th>Amount Paid</th>
                  <td>${application.currency || ''} ${application.amount || '0.00'}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td><span style="color: #10b981; font-weight:bold;">${application.paymentStatus}</span></td>
                </tr>
              </table>
            </div>

            <div class="footer">
              <p>Thank you for choosing Healthstur!</p>
              <p>If you have any questions concerning this invoice, contact our support.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPaymentEmailHtml(application: any, companyInfo: any) {
    const firstName = application.fullName
      ? application.fullName.split(' ')[0]
      : 'there';
    const instagramUrl =
      companyInfo?.instagramUrl ||
      'https://www.instagram.com/healthstur_fitness/';
    const youtubeUrl =
      companyInfo?.youtubeUrl || 'https://www.youtube.com/@healthstur-fitness';
    const contactEmail = companyInfo?.email || 'sales@healthstur.com';
    const contactPhone = companyInfo?.phone || '+91 99133 37971';
    const contactAddress =
      companyInfo?.address ||
      '1234 Wellness St, Suite 100, Springfield, CA 98765';
    const currentYear = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payment Success - Healthstur</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7f6; color: #333; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; overflow: hidden; }
    .header-top { background: #023051; padding: 15px 20px; text-align: right; }
    .header-top table { width: 100%; border-collapse: collapse; }
    .header-top td { font-size: 14px; font-weight: bold; color: #023051; }
    .header-top a { text-decoration: none; color: #023051; }
    .logo-container { text-align: center; padding: 0; }
    .logo { height: 100px; }
    .content { padding: 0 40px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
    .title { font-size: 18px; font-weight: bold; color: #023051; margin-bottom: 30px; }
    .success-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .success-box table { width: 100%; border-collapse: collapse; }
    .success-box td { vertical-align: middle; }
    .icon-td { width: 60px; }
    .success-icon { width: 45px; height: 45px; }
    .success-text { margin: 0; color: #334155; font-size: 15px; font-weight: 600; }
    .success-subtext { margin: 5px 0 0 0; color: #64748b; font-size: 14px; }
    .divider { text-align: center; margin: 30px 0; }
    .divider hr { border: none; border-top: 2px solid #e2e8f0; width: 60px; margin: 0 auto; }
    .team-section { text-align: center; margin-bottom: 30px; }
    .team-text { font-size: 16px; color: #023051; margin-bottom: 20px; font-weight: bold; line-height: 1.5; }
    .team-img { max-width: 100%; height: auto; max-width: 350px; }
    .contact-info { color: #475569; font-size: 15px; margin-bottom: 20px; }
    .contact-link { color: #0284c7; text-decoration: none; font-weight: bold; }
    .contact-phone { color: #16a34a; text-decoration: none; font-weight: bold; }
    .sign-off { margin-bottom: 40px; color: #475569; font-size: 15px; }
    .footer {padding: 24px 20px; text-align: center; background-color: #f8fafc; }
    .social-icons { margin-bottom: 0; }
    .social-icons img { width: 30px; height: 30px; margin: 0 8px; }
    .footer p { margin: 0 0 6px 0; color: #64748b; font-size: 13px; }
    .unsubscribe { color: #0284c7; font-size: 13px; text-decoration: underline; }
    .footer-divider { border: none; border-top: 1px solid #e2e8f0; width: 100%; margin: 16px auto; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="header-top">
      <table>
        <tr>
          <td style="text-align: left; color: #fff;"><a href="https://healthstur.com" style="color: #fff;">Visit Our Website</a></td>
          <td style="text-align: right; color: #fff;"><a href="https://healthstur.com/contact" style="color: #fff;">Contact Us</a></td>
        </tr>
      </table>
    </div>
    <div class="logo-container">
    <img src="cid:healthstur_logo" alt="Healthstur" class="logo" onerror="this.onerror=null; this.src='https://placehold.co/400x100/ffffff/023051?text=Healthstur&font=lora';" />
    </div>
    
    <hr class="footer-divider" style="margin-top: 5px;"/>
    <div class="content">
      <p class="greeting">Hi ${firstName},</p>
      
      <p class="title">Thank you for your purchase with Healthstur.</p>
      
      <div class="success-box">
        <table>
          <tr>
            <td class="icon-td">
              <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" alt="Success" class="success-icon" />
            </td>
            <td>
              <p class="success-text">Your payment has been successfully processed.</p>
              <p class="success-subtext">Please find your invoice attached for your reference.</p>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="divider">
        <hr />
      </div>
      
      <div class="team-section">
        <p class="team-text">Our team will contact you within 24 hours to create<br/>a <span style="color: #64748b;">personalized</span> plan tailored to your needs.</p>
        <img src="cid:support_team" alt="Support Team" class="team-img" style="max-width: 350px; margin-top: 15px;" />
      </div>

      <p class="contact-info">If you have any questions, feel free to contact our support team at:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="width: 40px; text-align: center; padding-bottom: 10px;">
            <img src="https://cdn-icons-png.flaticon.com/512/732/732200.png" alt="Email" style="width: 24px; vertical-align: middle;" />
          </td>
          <td style="padding-bottom: 10px;"><a href="mailto:${contactEmail}" class="contact-link">${contactEmail}</a></td>
        </tr>
        <tr>
          <td style="width: 40px; text-align: center;">
             <img src="https://cdn-icons-png.flaticon.com/512/724/724664.png" alt="Phone" style="width: 24px; vertical-align: middle;" />
          </td>
          <td>Call us: <a href="tel:${contactPhone?.replace(/\s/g, '')}" class="contact-phone">${contactPhone}</a></td>
        </tr>
      </table>

      <div class="sign-off">
        <p style="margin: 0;">Best regards,</p>
        <p style="margin: 5px 0 0 0; font-weight: bold;">Healthstur Team</p>
      </div>
    </div>

    <div class="footer">
      <div class="social-icons">
        <a href="${instagramUrl}"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384063.png" alt="Instagram" /></a>
        <a href="${youtubeUrl}"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YouTube" /></a>
      </div>
      <hr class="footer-divider" />
      <p>© ${currentYear} Healthstur. All rights reserved.</p>
      <p style="margin-bottom: 0;">${contactAddress}</p>
    </div>
  </div>
 
  <div style="display:none; color:transparent; opacity:0; font-size:0px; line-height:0;">
    ${Date.now()}-${application.id || application.cashfreeOrderId || Math.random()}
  </div>
</body>
</html>
    `;
  }

  async generateInvoicePdf(id: string): Promise<Buffer> {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!application) {
      throw new NotFoundException('Application not found');
    }

    try {
      const htmlContent = this.getInvoiceHtml(application);

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      return Buffer.from(pdfBuffer);
    } catch (err: any) {
      throw new BadRequestException('PDF Generation failed: ' + err.message);
    }
  }

  async testEmail(email: string, name?: string) {
    const mockApplication = {
      id: 'test-id-123',
      createdAt: new Date(),
      cashfreeOrderId: 'order_test_123',
      cashfreePaymentId: 'payment_test_123',
      fullName: name || 'John Doe',
      email: email,
      selectedProgram: 'Test Configuration Program',
      currency: 'INR',
      amount: '1.00',
      paymentStatus: 'SUCCESS',
    };
    // Call the invoice generation directly
    try {
      await this.generateAndSendInvoice(mockApplication);
      return {
        success: true,
        message: `Test email dispatched to ${email}. Please check your inbox/spam.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Email sending failed`,
        error: err.message || JSON.stringify(err),
      };
    }
  }

  async generateAndSendInvoice(application: any) {
    const htmlContent = this.getInvoiceHtml(application);

    try {
      // 1. Generate PDF
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      // 2. Send Email
      if (application.email) {
        const smtpUser = process.env.SMTP_NOREPLY_USER || process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_NOREPLY_PASS || process.env.SMTP_PASS;

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        // check if SMTP is Configured to avoid crashes, fallback or warn if not
        if (smtpUser && smtpPass) {
          const companyInfo = await this.prisma.companyInfo.findFirst();
          const fromEmail = smtpUser.includes('@')
            ? smtpUser
            : 'no-reply@healthstur.com';
          await transporter.sendMail({
            from: `"Healthstur" <${fromEmail}>`,
            to: application.email,
            subject: 'Your Payment Invoice - Healthstur',
            text: 'Please find attached your payment invoice for your recent purchase.',
            html: this.getPaymentEmailHtml(application, companyInfo),
            attachments: [
              {
                filename: `invoice_${application.cashfreeOrderId || application.id}.pdf`,
                content: Buffer.from(pdfBuffer),
              },
              {
                filename: 'Healthstur.png',
                path: path.join(process.cwd(), 'public', 'Healthstur.png'),
                cid: 'healthstur_logo',
              },
              {
                filename: 'support_team.jpg',
                path: path.join(process.cwd(), 'public', 'support_team.jpg'),
                cid: 'support_team',
              },
            ],
          });
        } else {
          throw new Error(
            'SMTP user and pass not fully configured in environment variables',
          );
        }
      } else {
        throw new Error('No email found in application data to dispatch to');
      }
    } catch (err) {
      console.error('generateAndSendInvoice Error:', err);
      throw err;
    }
  }

  async findAll() {
    return this.prisma.application.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');
    return application;
  }

  async refund(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
    });
    if (!application) throw new NotFoundException('Application not found');

    if (application.paymentStatus !== 'SUCCESS') {
      throw new BadRequestException('Only successful payments can be refunded');
    }
    if (!application.cashfreeOrderId) {
      throw new BadRequestException('No payment record found to refund');
    }

    try {
      // 1. Trigger full refund with Cashfree
      const numericAmount = parseFloat(
        (application.amount || '0').replace(/[^0-9.]/g, ''),
      );

      const refundRequest = {
        refund_amount: numericAmount,
        refund_id: `refund_${Date.now()}`,
        refund_note: 'Requested by Admin',
      };

      const refundResponse = await this.cashfree.PGOrderCreateRefund(
        application.cashfreeOrderId,
        refundRequest,
      );

      // 2. Update status in database with the refund details
      console.log(
        'Initial Refund Response:',
        JSON.stringify(refundResponse.data, null, 2),
      );
      const updatedApp = await this.prisma.application.update({
        where: { id },
        data: {
          paymentStatus:
            refundResponse.data.refund_status?.toUpperCase() === 'SUCCESS'
              ? 'REFUNDED'
              : 'REFUND_PENDING',
          cashfreeRefundId: refundResponse.data.refund_id,
          refundDetails: refundResponse.data as any,
        },
      });

      return { success: true, application: updatedApp };
    } catch (err: any) {
      throw new BadRequestException(
        `Refund Failed: ${err?.error?.description || err.message || 'Unknown error'}`,
      );
    }
  }

  async remove(id: string) {
    return this.prisma.application.delete({
      where: { id },
    });
  }
}
