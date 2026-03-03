import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import * as puppeteer from 'puppeteer';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ApplicationsService {
  private razorpay: any;

  constructor(private readonly prisma: PrismaService) {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_QGdFrCgX1jtz7u',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'BiZV5oB2iNz4k2YcgGdMGjEe',
    });
  }

  async create(createApplicationDto: CreateApplicationDto) {
    if (createApplicationDto.amount && createApplicationDto.currency) {
      const numericAmount = parseFloat(
        createApplicationDto.amount.replace(/[^0-9.]/g, ''),
      );
      if (!isNaN(numericAmount) && numericAmount > 0) {
        const amountInSmallestUnit = Math.round(numericAmount * 100);

        try {
          const order = await this.razorpay.orders.create({
            amount: amountInSmallestUnit,
            currency: createApplicationDto.currency,
            receipt: `rcpt_${Date.now()}`,
          });

          // Return only the order ID for the frontend to initialize Checkout.
          // DO NOT SAVE to the database yet.
          return { razorpayOrderId: order.id };
        } catch (error: any) {
          throw new BadRequestException(
            error?.error?.description || 'Failed to create payment order',
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
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      applicationData,
    } = body;

    const secret =
      process.env.RAZORPAY_KEY_SECRET || 'BiZV5oB2iNz4k2YcgGdMGjEe';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new BadRequestException('Invalid signature verification failed');
    }

    if (!applicationData) {
      throw new BadRequestException(
        'Missing application data for finalized recording.',
      );
    }

    const newApplication = await this.prisma.application.create({
      data: {
        ...applicationData,
        paymentStatus: 'SUCCESS',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    // Fire off async email/invoice generation
    this.generateAndSendInvoice(newApplication).catch(() => {});

    return { success: true, application: newApplication };
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
                  <td>${application.razorpayOrderId || 'N/A'}</td>
                </tr>
                <tr>
                  <th>Payment ID</th>
                  <td>${application.razorpayPaymentId || 'N/A'}</td>
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

  private async generateAndSendInvoice(application: any) {
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
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        // check if SMTP is configured to avoid crashes, fallback or warn if not
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          await transporter.sendMail({
            from: '"Healthstur" <no-reply@healthstur.com>',
            to: application.email,
            subject: 'Your Payment Invoice - Healthstur',
            text: 'Please find attached your payment invoice for your recent purchase.',
            html: '<p>Hi,</p><p>Thank you for your purchase. Please find your invoice attached.</p><br/><p>Best regards,<br/>Healthstur Team</p>',
            attachments: [
              {
                filename: `invoice_${application.razorpayOrderId || application.id}.pdf`,
                content: Buffer.from(pdfBuffer),
              },
            ],
          });
        }
      }
    } catch (err) {
      // Ignore
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
    if (!application.razorpayPaymentId) {
      throw new BadRequestException('No payment record found to refund');
    }

    try {
      // 1. Trigger full refund with Razorpay
      const refundResponse = await this.razorpay.payments.refund(
        application.razorpayPaymentId,
      );

      // 2. Update status in database with the refund details
      const updatedApp = await this.prisma.application.update({
        where: { id },
        data: {
          paymentStatus: 'REFUNDED',
          razorpayRefundId: refundResponse.id,
          refundDetails: refundResponse,
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
