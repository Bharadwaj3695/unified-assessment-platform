const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.sentEmails = [];
    this.isTestMode = process.env.NODE_ENV === 'test';
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (this.isTestMode || !host || host === 'test') {
      // In-memory JSON/Stream transport for isolated and deterministic automated tests
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    } else {
      // Production / Live SMTP Transporter
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  async verifyConnection() {
    if (this.isTestMode || !process.env.SMTP_HOST || process.env.SMTP_HOST === 'test') {
      return { verified: true, mode: 'test_fallback' };
    }
    try {
      await this.transporter.verify();
      return { verified: true, mode: 'smtp_live' };
    } catch (err) {
      console.warn(`[EmailService] SMTP connection verification failed: ${err.message}`);
      return { verified: false, error: err.message };
    }
  }

  buildHtmlTemplate({ title, recipientName, messageHtml, actionUrl, actionText }) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const targetUrl = actionUrl ? (actionUrl.startsWith('http') ? actionUrl : `${clientUrl}${actionUrl}`) : null;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .wrapper { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 28px 32px; text-align: left; }
    .logo-container { display: flex; align-items: center; }
    .logo-badge { display: inline-block; width: 36px; height: 36px; background-color: #3D8A78; color: #ffffff; font-weight: bold; border-radius: 10px; line-height: 36px; text-align: center; font-size: 20px; }
    .logo-text { font-size: 20px; font-weight: 700; color: #ffffff; margin-left: 12px; vertical-align: middle; }
    .body { padding: 32px; }
    .title { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
    .greeting { font-size: 15px; color: #475569; margin-bottom: 16px; }
    .content { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 24px; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #3D8A78; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 10px; margin-top: 8px; margin-bottom: 8px; }
    .footer { padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo-container">
        <span class="logo-badge">U</span>
        <span class="logo-text">Unified Assessment Platform</span>
      </div>
    </div>
    <div class="body">
      <h1 class="title">${title}</h1>
      <p class="greeting">Hello ${recipientName || 'there'},</p>
      <div class="content">
        ${messageHtml}
      </div>
      ${targetUrl && actionText ? `<div style="text-align: left;"><a href="${targetUrl}" class="btn">${actionText}</a></div>` : ''}
    </div>
    <div class="footer">
      <p>This is an automated system notification from the Unified Assessment Platform.</p>
      <p>&copy; ${new Date().getFullYear()} Unified Assessment Platform (UAP). All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  async sendMail({ to, subject, text, html }) {
    const from = process.env.EMAIL_FROM || '"Unified Assessment Platform" <no-reply@uap.edu>';

    const mailOptions = {
      from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>?/gm, ''),
      html,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.sentEmails.push({
        to,
        subject,
        text: mailOptions.text,
        html,
        info,
        sentAt: new Date(),
      });
      return { success: true, messageId: info.messageId || 'mock-id' };
    } catch (err) {
      console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  // 1. Pending Registration Email to Applicant
  async sendPendingRegistrationEmail(user) {
    const html = this.buildHtmlTemplate({
      title: 'Registration Application Received',
      recipientName: user.name,
      messageHtml: `
        <p>Thank you for submitting your application to the <strong>Unified Assessment Platform</strong>.</p>
        <p>Your account (<strong>${user.email}</strong>) has been placed in the institutional verification queue with <strong>Pending Review</strong> status.</p>
        <p>An institutional administrator will evaluate your credentials shortly. You will receive an email confirmation as soon as your account is approved.</p>
      `,
      actionUrl: '/auth/login',
      actionText: 'Check Application Status',
    });

    return this.sendMail({
      to: user.email,
      subject: 'Application Received — Unified Assessment Platform',
      html,
    });
  }

  // 2. Alert to Administrators on New Applicant
  async sendAdminNewApplicantAlert(adminUsers, newApplicant) {
    const emails = Array.isArray(adminUsers)
      ? adminUsers.map((a) => (typeof a === 'string' ? a : a.email)).filter(Boolean)
      : [adminUsers?.email || adminUsers].filter(Boolean);

    if (emails.length === 0) return { success: false, error: 'No admin recipients' };

    const html = this.buildHtmlTemplate({
      title: 'New Account Pending Approval',
      recipientName: 'Administrator',
      messageHtml: `
        <p>A new applicant has registered on the platform and requires administrative approval:</p>
        <ul>
          <li><strong>Name:</strong> ${newApplicant.name}</li>
          <li><strong>Email:</strong> ${newApplicant.email}</li>
          <li><strong>Requested Role:</strong> ${newApplicant.role || 'student'}</li>
          ${newApplicant.instituteCode ? `<li><strong>Institutional Code:</strong> ${newApplicant.instituteCode}</li>` : ''}
        </ul>
        <p>Please review and verify their credentials in the Admin Approval Queue.</p>
      `,
      actionUrl: '/admin/dashboard',
      actionText: 'Review Pending Accounts',
    });

    return this.sendMail({
      to: emails.join(', '),
      subject: `New Applicant Pending Review: ${newApplicant.name}`,
      html,
    });
  }

  // 3. Account Approved Email
  async sendAccountApprovedEmail(user) {
    const html = this.buildHtmlTemplate({
      title: 'Account Approved — Welcome!',
      recipientName: user.name,
      messageHtml: `
        <p>Congratulations! Your account application has been approved by the institutional administrator.</p>
        <p>Your account is now <strong>Active</strong> with the role of <strong>${user.role}</strong>.</p>
        <p>You can now sign in with your email and password to access examinations, assessments, and workspaces.</p>
      `,
      actionUrl: '/auth/login',
      actionText: 'Sign In to Platform',
    });

    return this.sendMail({
      to: user.email,
      subject: 'Account Approved — Welcome to Unified Assessment Platform',
      html,
    });
  }

  // 4. Account Rejected Email
  async sendAccountRejectedEmail(user, reason) {
    const html = this.buildHtmlTemplate({
      title: 'Account Application Status',
      recipientName: user.name,
      messageHtml: `
        <p>We are writing to inform you that your registration application for the Unified Assessment Platform could not be approved at this time.</p>
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 16px 0;">
          <strong>Reason Provided:</strong><br />
          ${reason || 'Institutional verification criteria could not be verified.'}
        </div>
        <p>If you believe this decision was made in error, please contact your academic administrator.</p>
      `,
      actionUrl: '/auth/signup',
      actionText: 'Re-apply with Updated Information',
    });

    return this.sendMail({
      to: user.email,
      subject: 'Account Application Status — Unified Assessment Platform',
      html,
    });
  }

  // 5. Account Revoked Email
  async sendAccountRevokedEmail(user, reason) {
    const html = this.buildHtmlTemplate({
      title: 'Account Access Revoked',
      recipientName: user.name,
      messageHtml: `
        <p>Your access to the Unified Assessment Platform has been revoked by an institutional administrator.</p>
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 16px 0;">
          <strong>Notice:</strong><br />
          ${reason || 'Account deactivated by administrative policy.'}
        </div>
        <p>Please contact your department coordinator for further assistance.</p>
      `,
    });

    return this.sendMail({
      to: user.email,
      subject: 'Account Status Notice — Unified Assessment Platform',
      html,
    });
  }

  // 6. Assessment Published Notification
  async sendAssessmentPublishedEmail(studentUser, assessment) {
    const html = this.buildHtmlTemplate({
      title: 'New Assessment Published',
      recipientName: studentUser.name,
      messageHtml: `
        <p>A new examination has been published and is available for you:</p>
        <div style="padding: 14px; background-color: #f0fdf4; border-left: 4px solid #3D8A78; border-radius: 8px; margin: 16px 0;">
          <strong style="font-size: 16px; color: #166534;">${assessment.title}</strong><br />
          <span style="color: #4b5563;">Category: ${assessment.category || 'General'}</span><br />
          <span style="color: #4b5563;">Duration: ${assessment.durationMinutes} Minutes</span><br />
          <span style="color: #4b5563;">Passing Threshold: ${assessment.passingScore || 60}%</span>
        </div>
        <p>Please review the examination instructions and prepare your attempt before the scheduled deadline.</p>
      `,
      actionUrl: `/student/attempt/${assessment._id || assessment.id}`,
      actionText: 'Start Assessment Attempt',
    });

    return this.sendMail({
      to: studentUser.email,
      subject: `New Assessment Available: ${assessment.title}`,
      html,
    });
  }

  // 7. Student Submission Notification to Instructor
  async sendSubmissionReceivedEmail(instructorUser, studentUser, assessment, submission) {
    const html = this.buildHtmlTemplate({
      title: 'New Examination Submission',
      recipientName: instructorUser.name,
      messageHtml: `
        <p>A student has submitted an examination attempt for your course assessment:</p>
        <div style="padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
          <strong>Student:</strong> ${studentUser.name} (${studentUser.email})<br />
          <strong>Assessment:</strong> ${assessment.title}<br />
          <strong>Auto-Score (MCQ):</strong> ${submission.autoScore || 0} pts<br />
          <strong>Status:</strong> ${submission.status === 'evaluated' ? 'Fully Auto-Graded' : 'Awaiting Subjective Review'}
        </div>
        <p>Open the Evaluation Studio to review written responses and grade subjective questions.</p>
      `,
      actionUrl: `/instructor/evaluate/${submission._id || submission.id}`,
      actionText: 'Open Evaluation Studio',
    });

    return this.sendMail({
      to: instructorUser.email,
      subject: `Submission Received: ${studentUser.name} — ${assessment.title}`,
      html,
    });
  }

  // 8. Grade Released Notification to Student
  async sendGradeReleasedEmail(studentUser, assessment, submission) {
    const isPassed = submission.passed || submission.resultStatus === 'passed';
    const outcomeColor = isPassed ? '#166534' : '#991b1b';
    const outcomeBg = isPassed ? '#f0fdf4' : '#fef2f2';

    const html = this.buildHtmlTemplate({
      title: 'Evaluation Completed & Grade Released',
      recipientName: studentUser.name,
      messageHtml: `
        <p>Your submission for <strong>${assessment.title}</strong> has been evaluated and your final result has been published.</p>
        <div style="padding: 16px; background-color: ${outcomeBg}; border-radius: 12px; margin: 16px 0; border: 1px solid ${isPassed ? '#bbf7d0' : '#fecaca'};">
          <div style="font-size: 18px; font-weight: 700; color: ${outcomeColor}; margin-bottom: 6px;">
            Outcome: ${isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT'}
          </div>
          <div style="font-size: 14px; color: #374151;">
            <strong>Final Score:</strong> ${submission.finalScore || submission.score} / ${submission.totalPoints || assessment.totalPoints || 100} Points<br />
            <strong>Percentage:</strong> ${submission.percentage}%<br />
            <strong>Passing Threshold:</strong> ${assessment.passingScore || 60}%
          </div>
          ${submission.feedback ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #475569;"><em>"${submission.feedback}"</em></div>` : ''}
        </div>
        <p>You can review your detailed score breakdown on your student dashboard.</p>
      `,
      actionUrl: `/student/dashboard`,
      actionText: 'View Assessment Result',
    });

    return this.sendMail({
      to: studentUser.email,
      subject: `Evaluation Completed: ${assessment.title} (${submission.percentage}%)`,
      html,
    });
  }

  // Test Inspection Helpers
  getSentEmails() {
    return this.sentEmails;
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1] || null;
  }

  clearSentEmails() {
    this.sentEmails = [];
  }
}

module.exports = new EmailService();
