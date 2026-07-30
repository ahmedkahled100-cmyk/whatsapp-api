import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from '@/lib/supabase';
import { SETTINGS } from '@/lib/db/constants';
import { fromDB } from '@/lib/db/supabase/dbUtils';
import type { Settings } from '@/types';

function extractSettingsExtras(data: any): Settings | null {
  if (!data) return null;
  const settings = fromDB<Settings>(data);
  if (settings.paymentMethods && settings.paymentMethods.includes('|SET:')) {
    try {
      const match = settings.paymentMethods.match(/\|SET:(.*?)\|/);
      if (match && match[1]) {
        const extras = JSON.parse(match[1]);
        Object.assign(settings, extras);
        settings.paymentMethods = settings.paymentMethods.replace(/\|SET:.*?\|/, '').trim();
      }
    } catch (e) {
      console.error('Failed to parse settings extras', e);
    }
  }
  return settings;
}

async function getAdminEmailSettings() {
  try {
    // Query all settings rows from SETTINGS table
    const { data: allRows } = await supabase
      .from(SETTINGS)
      .select('*');

    if (allRows && allRows.length > 0) {
      // Find the settings record that contains SMTP/Email configuration
      for (const row of allRows) {
        const dbSettings = extractSettingsExtras(row);
        if (
          dbSettings &&
          (dbSettings.smtpHost ||
            dbSettings.adminNotificationEmail ||
            dbSettings.smtpUser ||
            dbSettings.emailNotificationsEnabled !== undefined)
        ) {
          return {
            enabled: dbSettings.emailNotificationsEnabled ?? true,
            adminEmail: dbSettings.adminNotificationEmail || process.env.ADMIN_NOTIFICATION_EMAIL || '',
            smtpHost: dbSettings.smtpHost || process.env.SMTP_HOST || '',
            smtpPort: Number(dbSettings.smtpPort) || Number(process.env.SMTP_PORT) || 587,
            smtpUser: dbSettings.smtpUser || process.env.SMTP_USER || '',
            smtpPass: dbSettings.smtpPass || process.env.SMTP_PASS || '',
            smtpSenderName: dbSettings.smtpSenderName || process.env.SMTP_SENDER_NAME || 'أكاديمية AN Academy',
            notifyOnTeacherJoin: dbSettings.notifyOnTeacherJoin ?? true,
            notifyOnAssistantJoin: dbSettings.notifyOnAssistantJoin ?? true,
            notifyOnTeacherMessage: dbSettings.notifyOnTeacherMessage ?? true,
          };
        }
      }
    }
  } catch (e) {
    console.error('Error fetching admin email settings:', e);
  }

  // Fallback to environment variables
  return {
    enabled: true,
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || '',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSenderName: process.env.SMTP_SENDER_NAME || 'أكاديمية AN Academy',
    notifyOnTeacherJoin: true,
    notifyOnAssistantJoin: true,
    notifyOnTeacherMessage: true,
  };
}

function generateEmailHTML(action: string, data: any, senderName: string) {
  const currentYear = new Date().getFullYear();
  const dateFormatted = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });

  if (action === 'test_email') {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; text-align: right; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 6px 16px; background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); border-radius: 20px; font-weight: bold; font-size: 14px; }
          .title { font-size: 22px; font-weight: 800; color: #38bdf8; margin-top: 12px; }
          .content { font-size: 15px; line-height: 1.7; color: #cbd5e1; }
          .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">اختبار الاتصال ناجح ✅</span>
            <div class="title">${senderName}</div>
          </div>
          <div class="content">
            <p>مرحباً بك، عزيزي المدير!</p>
            <p>هذه الرسالة تم إرسالها لااختبار نجاح إعدادات البريد الإلكتروني (SMTP). جميع الإعدادات الحالية تعمل بنجاح وبشكل سليم 100%.</p>
            <p>تاريخ الاختبار: <strong>${dateFormatted}</strong></p>
          </div>
          <div class="footer">
            جميع الحقوق محفوظة © ${currentYear} ${senderName}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  if (action === 'teacher_message') {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; text-align: right; }
          .container { max-width: 620px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); }
          .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
          .badge { display: inline-block; padding: 8px 18px; background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3); border-radius: 20px; font-weight: bold; font-size: 14px; }
          .title { font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 12px; }
          .subtitle { font-size: 14px; color: #94a3b8; margin-top: 4px; }
          .info-card { background: #0f172a; border-radius: 12px; border: 1px solid #334155; padding: 20px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e293b; }
          .info-row:last-child { border-bottom: none; }
          .info-label { font-weight: bold; color: #94a3b8; font-size: 14px; }
          .info-value { color: #f8fafc; font-weight: 600; font-size: 14px; }
          .msg-box { background: #1e293b; border-radius: 12px; border: 1px solid #3b82f640; padding: 16px; margin-top: 10px; color: #f8fafc; font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
          .btn-action { display: block; width: 100%; text-align: center; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 0; border-radius: 12px; font-weight: bold; font-size: 16px; margin-top: 24px; box-shadow: 0 4px 15px rgba(59,130,246,0.4); }
          .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">💬 رسالة جديدة من معلم</span>
            <div class="title">${senderName}</div>
            <div class="subtitle">تنبيه محادثة جديدة في نظام مراسلة المنصة</div>
          </div>

          <p style="font-size: 16px; color: #e2e8f0;">مرحباً بك يا أدمن، أرسل معلم رسالة جديدة تفاصيلها كالتالي:</p>

          <div class="info-card">
            <div class="info-row">
              <span class="info-label">👨‍🏫 اسم المعلم:</span>
              <span class="info-value">${data.teacherName || data.senderName || 'غير محدد'}</span>
            </div>
            ${data.teacherPhone ? `
            <div class="info-row">
              <span class="info-label">📱 رقم الهاتف:</span>
              <span class="info-value" dir="ltr">${data.teacherPhone}</span>
            </div>
            ` : ''}
            ${data.subjectName ? `
            <div class="info-row">
              <span class="info-label">📚 المادة الدراسية:</span>
              <span class="info-value">${data.subjectName}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">🕒 وقت الرسالة:</span>
              <span class="info-value">${dateFormatted}</span>
            </div>

            <div style="margin-top: 16px;">
              <span class="info-label">✉️ نص الرسالة:</span>
              <div class="msg-box">${data.messageContent || '(مرفق ملف أو صورة)'}</div>
            </div>

            ${data.fileUrl ? `
            <div style="margin-top: 14px; text-align: center;">
              <a href="${data.fileUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline; font-size: 14px; font-weight: bold;">
                📎 معاينة الملف / الصورة المرفقة
              </a>
            </div>
            ` : ''}
          </div>

          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://an-academy.vercel.app'}/admin/messages" class="btn-action">
            الانتقال لنظام الرسائل للرد 🚀
          </a>

          <div class="footer">
            تم إرسال هذا البريد التلقائي بواسطة نظام إشعارات ${senderName} © ${currentYear}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  const isTeacher = action === 'teacher_request';
  const roleTitleName = isTeacher ? 'معلم جديد 👨‍🏫' : 'مساعد مادة جديد 💼';
  const accentColor = isTeacher ? '#a855f7' : '#f59e0b';
  const badgeBg = isTeacher ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.15)';

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; text-align: right; }
        .container { max-width: 620px; margin: 0 auto; background: #1e293b; border-radius: 20px; border: 1px solid #334155; padding: 32px; box-shadow: 0 15px 35px rgba(0,0,0,0.5); }
        .header { text-align: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; }
        .badge { display: inline-block; padding: 8px 18px; background: ${badgeBg}; color: ${accentColor}; border: 1px solid ${accentColor}40; border-radius: 20px; font-weight: bold; font-size: 14px; }
        .title { font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 12px; }
        .subtitle { font-size: 14px; color: #94a3b8; margin-top: 4px; }
        .info-card { background: #0f172a; border-radius: 12px; border: 1px solid #334155; padding: 20px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e293b; }
        .info-row:last-child { border-bottom: none; }
        .info-label { font-weight: bold; color: #94a3b8; font-size: 14px; }
        .info-value { color: #f8fafc; font-weight: 600; font-size: 14px; }
        .btn-action { display: block; width: 100%; text-align: center; background: ${accentColor}; color: #ffffff; text-decoration: none; padding: 14px 0; border-radius: 12px; font-weight: bold; font-size: 16px; margin-top: 24px; box-shadow: 0 4px 15px ${accentColor}40; }
        .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="badge">طلب انضمام ${roleTitleName}</span>
          <div class="title">${senderName}</div>
          <div class="subtitle">تنبيه إشعار جديد للوحة تحكم الإدارة</div>
        </div>

        <p style="font-size: 16px; color: #e2e8f0;">مرحباً بك يا أدمن، تم تلقي طلب انضمام جديد للتسجيل بالمنصة وفيما يلي التفاصيل الكاملة:</p>

        <div class="info-card">
          <div class="info-row">
            <span class="info-label">👤 اسم المتقدم:</span>
            <span class="info-value">${data.name || 'غير محدد'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">📱 رقم الهاتف (واتساب):</span>
            <span class="info-value" dir="ltr">${data.phone || 'غير محدد'}</span>
          </div>
          ${isTeacher ? `
          <div class="info-row">
            <span class="info-label">📚 المادة الدراسية:</span>
            <span class="info-value">${data.subject || 'غير محدد'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">💳 باقة الاشتراك:</span>
            <span class="info-value">${data.subType === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'} (${data.subPrice || 0} ج.م)</span>
          </div>
          ` : `
          <div class="info-row">
            <span class="info-label">💼 الدور / التخصص:</span>
            <span class="info-value">${data.roleTitle || 'غير محدد'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">💰 طريقة دفع الراتب المفضلة:</span>
            <span class="info-value">${data.salaryPaymentMethod || 'ثابت'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">🔑 اسم المستخدم المقترح:</span>
            <span class="info-value" dir="ltr">${data.username || 'غير محدد'}</span>
          </div>
          `}
          ${data.promoCode ? `
          <div class="info-row">
            <span class="info-label">🎟️ كود الخصم المستخدم:</span>
            <span class="info-value" style="color: #4ade80;">${data.promoCode}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">🕒 تاريخ وساعة الطلب:</span>
            <span class="info-value">${dateFormatted}</span>
          </div>
        </div>

        <p style="font-size: 14px; color: #94a3b8; text-align: center;">يمكنك الذهاب إلى لوحة تحكم الإدارة لمراجعة وسداد/تفعيل الحساب.</p>

        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://an-academy.vercel.app'}${isTeacher ? '/admin/teachers' : '/admin/assistants'}" class="btn-action">
          الانتقال للوحة التحكم لمراجعة الطلب 🚀
        </a>

        <div class="footer">
          تم إرسال هذا البريد التلقائي بواسطة نظام إشعارات ${senderName} © ${currentYear}
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, data, customConfig } = body;

    let config = await getAdminEmailSettings();

    // Override config if customConfig is passed (e.g. from Admin Settings test button)
    if (customConfig) {
      config = {
        ...config,
        ...customConfig,
        smtpPort: Number(customConfig.smtpPort) || 587,
      };
    }

    if (!config.enabled && action !== 'test_email') {
      return NextResponse.json({ success: true, skipped: true, message: 'إشعارات البريد معطلة من الإعدادات' });
    }

    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
      return NextResponse.json({
        success: false,
        error: 'لم يتم ضبط إعدادات سيرفر SMTP (Host, User, Pass) في المنصة حتى الآن.'
      }, { status: 400 });
    }

    const targetEmail = (action === 'test_email' && data?.targetEmail)
      ? data.targetEmail
      : (config.adminEmail || config.smtpUser);

    if (!targetEmail) {
      return NextResponse.json({
        success: false,
        error: 'لم يتم تحديد البريد الإلكتروني المستقبل للإشعارات (Admin Email).'
      }, { status: 400 });
    }

    if (action === 'teacher_request' && !config.notifyOnTeacherJoin) {
      return NextResponse.json({ success: true, skipped: true, message: 'إشعارات المعلمين معطلة من الإعدادات' });
    }

    if (action === 'assistant_request' && !config.notifyOnAssistantJoin) {
      return NextResponse.json({ success: true, skipped: true, message: 'إشعارات المساعدين معطلة من الإعدادات' });
    }

    if (action === 'teacher_message' && !config.notifyOnTeacherMessage) {
      return NextResponse.json({ success: true, skipped: true, message: 'إشعارات رسائل المعلمين معطلة من الإعدادات' });
    }

    // Create Transporter
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465, // True for 465, false for 587/25
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const subject = action === 'test_email'
      ? `✅ رسالة تجريبية من ${config.smtpSenderName}`
      : action === 'teacher_request'
      ? `👨‍🏫 طلب انضمام معلم جديد: ${data?.name || ''}`
      : action === 'assistant_request'
      ? `💼 طلب انضمام مساعد مادة جديد: ${data?.name || ''}`
      : `💬 رسالة جديدة من المعلم: ${data?.teacherName || data?.senderName || 'معلم'}`;

    const html = generateEmailHTML(action, data || {}, config.smtpSenderName);

    const mailOptions = {
      from: `"${config.smtpSenderName}" <${config.smtpUser}>`,
      to: targetEmail,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: 'تم إرسال بريد الإشعار بنجاح',
    });

  } catch (error: any) {
    console.error('Email Dispatch Route Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'فشل إرسال البريد الإلكتروني',
    }, { status: 500 });
  }
}
