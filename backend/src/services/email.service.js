// Import the Nodemailer library used to configure mail transports and transmit emails
const nodemailer = require('nodemailer');
// Load and initialize application-wide environment variables from the central configuration module
require('../config/env');

// Define the EmailService class encapsulating mailer transport configuration and transactional email dispatch methods
class EmailService {
  // Construct and initialize the EmailService instance
  constructor() {
    // Reference to the active Nodemailer transport instance (null until initialized)
    this.transporter = null;
    // In-memory array storing dispatched email records for testing and logging inspections
    this.sentEmails = [];
    // Boolean indicator determining whether the execution environment is running automated test suites
    this.isTestMode = Boolean(
      // Check if NODE_ENV is set to 'test'
      process.env.NODE_ENV === 'test' ||
      // Check if node runtime arguments include the '--test' runner flag
      process.execArgv.some((arg) => arg.startsWith('--test')) ||
      // Check if the executing script path matches test directory conventions or test filename patterns
      (process.argv[1] && (process.argv[1].includes('/test/') || process.argv[1].endsWith('.test.js')))
    );
    // Boolean flag indicating if in-memory JSON fallback transport is being used instead of external SMTP
    this.isFallbackMode = false;
    // Trigger initialization of the Nodemailer transporter based on current environment settings
    this.initTransporter();
  // Close the constructor definition
  }

  // Configure and instantiate the Nodemailer transporter for live SMTP or test fallback
  initTransporter() {
    // Read the SMTP host hostname or service designation from environment variables
    const host = process.env.SMTP_HOST;
    // Parse the SMTP port number as an integer with base 10, defaulting to standard submission port 587
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    // Determine if TLS/SSL encryption is mandatory based on environment flag or explicit port 465 usage
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    // Retrieve the authenticated SMTP username or sending email address
    const user = process.env.SMTP_USER;
    // Retrieve the authenticated SMTP password or Google App Password from either environment key
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    // Check if running in automated test mode or without valid live SMTP host configuration
    if (this.isTestMode || !host || host === 'test') {
      // In-memory JSON/Stream transport for isolated and deterministic automated tests
      // Instantiate an in-memory transport that captures message structures without opening network sockets
      this.transporter = nodemailer.createTransport({
        // Configure transport to record emails in memory as structured JSON
        jsonTransport: true,
      // Complete transport configuration object
      });
      // Set fallback mode flag to true indicating external delivery is bypassed
      this.isFallbackMode = true;
      // Emit a console warning if fallback mode was engaged outside of automated testing
      if (!this.isTestMode) {
        // Log diagnostic warning alerting administrators that outbound emails will not reach external mailboxes
        console.warn('[EmailService] SMTP_HOST not configured. Transporter initialized in in-memory fallback mode (emails will not be delivered to external mailboxes).');
      // End conditional check for non-test mode warning
      }
    // Branch taken when live SMTP parameters are provided and system is not in automated test mode
    } else {
      // Production / Live SMTP Transporter (supports Google SMTP / smtp.gmail.com, etc.)
      // Assemble transport configuration options for the live SMTP relay
      const transportConfig = {
        // SMTP server hostname or IP address
        host,
        // Destination port for SMTP connection
        port,
        // Boolean indicating whether to establish an SSL/TLS connection immediately
        secure,
        // Supply credentials object if both username and password are provided, otherwise omit
        auth: (user && pass) ? { user, pass } : undefined,
      // Complete transportConfig object declaration
      };

      // Only use service: 'gmail' shortcut if host is specifically 'gmail' or if port 465 SSL is selected,
      // avoiding forced port 465 override when port 587 with STARTTLS (secure: false) is configured.
      // Check whether to apply Gmail preset service configuration
      if (host === 'gmail' || (host.includes('gmail') && port === 465 && secure)) {
        // Designate 'gmail' service profile on transport configuration
        transportConfig.service = 'gmail';
      // End conditional check for Gmail preset
      }

      // Instantiate live Nodemailer SMTP transporter using the resolved configuration
      this.transporter = nodemailer.createTransport(transportConfig);
      // Mark fallback mode as false since live transport is active
      this.isFallbackMode = false;
      // Log operational info describing the initialized SMTP transport settings (redacting passwords)
      console.info(`[EmailService] SMTP configuration detected (Host: ${host}, Port: ${port}, Secure: ${secure}, Auth: ${user && pass ? 'CONFIGURED' : 'MISSING'}). Live transporter initialized.`);
    // End live transport conditional branch
    }
  // End initTransporter method
  }

  // Check whether complete SMTP credentials and live host settings are configured in environment
  isSmtpConfigured() {
    // Read the SMTP host environment variable
    const host = process.env.SMTP_HOST;
    // Read the SMTP username environment variable
    const user = process.env.SMTP_USER;
    // Read the SMTP password from available environment variables
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
    // Return true only if host is present and non-test, and both user and password are defined
    return Boolean(host && host !== 'test' && user && pass);
  // End isSmtpConfigured method
  }

  // Redact passwords, secrets, and auth tokens from error strings to prevent credential exposure in logs
  sanitizeError(message) {
    // Return empty string if the incoming error message is undefined or empty
    if (!message) return '';
    // Replace credential values following sensitive keywords with masked asterisks using regular expressions
    return String(message).replace(/(password|pass|secret|token)\s*[:=]?\s*([^\s]+)/gi, '$1=***');
  // End sanitizeError method
  }

  // Verify socket connectivity and credential authentication with the configured SMTP server
  async verifyConnection() {
    // Return early with successful mock verification if running in test environment or test fallback mode
    if (this.isTestMode || !process.env.SMTP_HOST || process.env.SMTP_HOST === 'test') {
      // Return verification result object indicating test fallback status
      return { verified: true, mode: 'test_fallback' };
    // End test mode check
    }
    // Retrieve configured SMTP username
    const user = process.env.SMTP_USER;
    // Retrieve configured SMTP password
    const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

    // Detect misconfiguration where username is present but password is missing
    if (user && !pass) {
      // Define explanatory error message regarding missing password in environment
      const msg = 'SMTP_USER is configured, but SMTP_PASS is missing in backend/.env. Google App Password is required for Gmail SMTP delivery.';
      // Log warning to application console with diagnostic guidance
      console.warn(`[EmailService] SMTP verification note: ${msg}`);
      // Return unverified status object containing the diagnostic message
      return { verified: false, mode: 'smtp_live', error: msg };
    // End missing password check
    }

    // Execute network handshake verification inside try-catch block
    try {
      // Call Nodemailer verify method to test server connection and authentication handshake
      await this.transporter.verify();
      // Return successful verification confirmation for live SMTP mode
      return { verified: true, mode: 'smtp_live' };
    // Catch connection timeouts, authentication failures, or TLS negotiation errors
    } catch (err) {
      // Sanitize the raw error message to mask any accidental credential leaks
      const sanitized = this.sanitizeError(err.message || 'Verification failed');
      // Log failure details to standard warning stream
      console.warn(`[EmailService] SMTP connection verification failed: ${sanitized}`);
      // Return unverified status with sanitized error description
      return { verified: false, mode: 'smtp_live', error: sanitized };
    // End try-catch block
    }
  // End verifyConnection method
  }

  // Generate standardized, responsive HTML email layout with header branding, body message, and call-to-action button
  buildHtmlTemplate({ title, recipientName, messageHtml, actionUrl, actionText }) {
    // Determine frontend web application URL from environment, defaulting to standard Vite dev port 5173
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Resolve absolute destination URL for action button, prefixing relative paths with clientUrl
    const targetUrl = actionUrl ? (actionUrl.startsWith('http') ? actionUrl : `${clientUrl}${actionUrl}`) : null;

    // Return interpolated HTML document template string with brand styles and responsive viewport
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
  // End buildHtmlTemplate method
  }

  // Core email dispatch method accepting destination, subject, and message content
  async sendMail({ to, subject, text, html }) {
    // Resolve sender address from EMAIL_FROM environment variable or default system no-reply identity
    const from = process.env.EMAIL_FROM || '"Unified Assessment Platform" <no-reply@uap.edu>';

    // Assemble Nodemailer email payload options
    const mailOptions = {
      // Set the sender name and email address header
      from,
      // Set the primary recipient email address
      to,
      // Set the email subject line
      subject,
      // Provide plain-text fallback content, stripping HTML tags if no dedicated text is supplied
      text: text || html.replace(/<[^>]*>?/gm, ''),
      // Provide the rendered HTML email body
      html,
    // Close mail options object definition
    };

    // Attempt email transmission and error handling
    try {
      // Dispatch email message using configured Nodemailer transporter
      const info = await this.transporter.sendMail(mailOptions);
      // Store dispatch metadata in sentEmails history array for inspection and unit testing
      this.sentEmails.push({
        // Recipient email address
        to,
        // Dispatched subject header
        subject,
        // Plain text version of email body
        text: mailOptions.text,
        // Rendered HTML content
        html,
        // Nodemailer dispatch return object containing message ID and response info
        info,
        // Timestamp recording when message was dispatched
        sentAt: new Date(),
      // Close recorded entry object
      });
      // Determine delivery mode label for logging output
      const mode = (this.isTestMode || !process.env.SMTP_HOST || process.env.SMTP_HOST === 'test')
        // In-memory mode active during unit tests or missing SMTP host
        ? 'in-memory fallback'
        // Live SMTP mode active when communicating with actual mail server
        : 'live SMTP';
      // Log successful email dispatch event with recipient, mode, subject, and unique message ID
      console.info(`[EmailService] Email dispatched to ${to} [${mode}] — Subject: "${subject}" (MessageId: ${info.messageId || 'mock-id'})`);
      // Return standardized result object signaling success
      return { success: true, messageId: info.messageId || 'mock-id', mode };
    // Catch any transport delivery or socket exceptions
    } catch (err) {
      // Strip out passwords and sensitive tokens from error details before logging
      const sanitized = this.sanitizeError(err.message);
      // Log delivery error message to standard error stream
      console.error(`[EmailService] Failed to send email to ${to}:`, sanitized);
      // Return standardized result object signaling failure
      return { success: false, error: sanitized };
    // End try-catch block
    }
  // End sendMail method
  }

  // 1. Pending Registration Email to Applicant
  // Dispatch notification to a newly registered applicant confirming receipt of their account request
  async sendPendingRegistrationEmail(user) {
    // Generate styled HTML email notification tailored for pending applicant status
    const html = this.buildHtmlTemplate({
      // Email heading title
      title: 'Registration Application Received',
      // Recipient applicant full name
      recipientName: user.name,
      // Formatted HTML body content explaining pending administrative review
      messageHtml: `
        <p>Thank you for submitting your application to the <strong>Unified Assessment Platform</strong>.</p>
        <p>Your account (<strong>${user.email}</strong>) has been placed in the institutional verification queue with <strong>Pending Review</strong> status.</p>
        <p>An institutional administrator will evaluate your credentials shortly. You will receive an email confirmation as soon as your account is approved.</p>
      `,
      // Relative URL routing applicant to login page to review status
      actionUrl: '/auth/login',
      // Call-to-action button label
      actionText: 'Check Application Status',
    // Complete template options object
    });

    // Send the constructed transactional email to the applicant's registered address
    return this.sendMail({
      // Recipient email address
      to: user.email,
      // Standardized subject header
      subject: 'Application Received — Unified Assessment Platform',
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendPendingRegistrationEmail method
  }

  // 2. Alert to Administrators on New Applicant
  // Dispatch high-priority alert to platform administrators informing them of a pending applicant
  async sendAdminNewApplicantAlert(adminUsers, newApplicant) {
    // Normalize administrative recipients into a filtered list of valid email strings
    const emails = Array.isArray(adminUsers)
      // Map array of user objects or strings to email strings, filtering out falsy entries
      ? adminUsers.map((a) => (typeof a === 'string' ? a : a.email)).filter(Boolean)
      // Extract single email from user object or string argument
      : [adminUsers?.email || adminUsers].filter(Boolean);

    // If no valid admin email addresses were found, return failure status early
    if (emails.length === 0) return { success: false, error: 'No admin recipients' };

    // Build notification email highlighting applicant details for administrative evaluation
    const html = this.buildHtmlTemplate({
      // Notification title header
      title: 'New Account Pending Approval',
      // Generic greeting salutation for admin team
      recipientName: 'Administrator',
      // HTML body containing applicant summary, requested role, and optional institution code
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
      // Direct navigation link to administrator pending accounts dashboard
      actionUrl: '/admin/dashboard',
      // Call-to-action button label
      actionText: 'Review Pending Accounts',
    // Complete template options
    });

    // Send notification to all administrators via comma-delimited recipient header
    return this.sendMail({
      // Comma-joined list of admin email addresses
      to: emails.join(', '),
      // Dynamic subject line incorporating applicant full name
      subject: `New Applicant Pending Review: ${newApplicant.name}`,
      // Rendered HTML content
      html,
    // Complete dispatch options
    });
  // End sendAdminNewApplicantAlert method
  }

  // 3. Account Approved Email
  // Dispatch celebratory confirmation notification to user whose registration was approved by an administrator
  async sendAccountApprovedEmail(user) {
    // Base URL for frontend application from environment with fallback
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Construct direct URL to platform login page
    const loginUrl = `${clientUrl}/auth/login`;

    // Build welcome email HTML template outlining active account privileges
    const html = this.buildHtmlTemplate({
      // Email heading title
      title: 'Account Approved — Welcome!',
      // Recipient full name
      recipientName: user.name,
      // HTML message body providing role information and access links
      messageHtml: `
        <p>Congratulations! Your account application has been approved by the institutional administrator.</p>
        <p>Your account is now <strong>Active</strong> with the role of <strong>${user.role}</strong>.</p>
        <p>You can now sign in using your registered email address to access examinations, assessments, and workspaces.</p>
        <p style="margin-top: 16px;"><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      `,
      // Login route for button click
      actionUrl: '/auth/login',
      // Call-to-action button label
      actionText: 'Sign In to Platform',
    // Complete template options
    });

    // Provide clean plain-text alternative version for text-only mail clients
    const text = `
Hello ${user.name || 'there'},

Your Unified Assessment Platform account has been approved.

You can now sign in using your registered email address.

Login:
${loginUrl}

Regards,
Unified Assessment Platform
    `.trim();

    // Transmit email with both HTML and plain-text alternatives
    return this.sendMail({
      // Recipient email address
      to: user.email,
      // Subject line
      subject: 'Account Approved — Your UAP Account Has Been Approved',
      // Plain text content
      text,
      // HTML styled content
      html,
    // Complete mail options
    });
  // End sendAccountApprovedEmail method
  }

  // 3b. Student Account Created Welcome Email
  // Dispatch onboarding welcome email to a student whose profile was provisioned by an administrator
  async sendStudentAccountCreatedEmail(user) {
    // Base URL for frontend application from environment with fallback
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Construct direct URL to authentication login screen
    const loginUrl = `${clientUrl}/auth/login`;

    // Construct styled HTML welcoming student with assigned academic identifiers
    const html = this.buildHtmlTemplate({
      // Email heading title
      title: 'Welcome to Unified Assessment Platform',
      // Student recipient name
      recipientName: user.name,
      // HTML message body displaying student ID, registered email, and portal instructions
      messageHtml: `
        <p>Your student account has been created by the institutional administrator.</p>
        <div style="padding: 14px; background-color: #f0fdf4; border-left: 4px solid #3D8A78; border-radius: 8px; margin: 16px 0;">
          <strong>Student ID:</strong> ${user.studentId || 'Assigned'}<br />
          <strong>Registered Email:</strong> ${user.email}<br />
          <strong>Role:</strong> Student<br />
          <strong>Account Status:</strong> Active
        </div>
        <p>You can now sign in using your registered email address to access assessments, examinations, and results.</p>
        <p style="margin-top: 16px;"><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      `,
      // Login route URL
      actionUrl: '/auth/login',
      // Button call-to-action label
      actionText: 'Sign In to Student Portal',
    // Complete template parameters
    });

    // Construct plain-text alternative for student welcome message
    const text = `
Hello ${user.name || 'there'},

Your student account for the Unified Assessment Platform has been created.

Student ID: ${user.studentId || 'Assigned'}
Email: ${user.email}
Role: Student
Status: Active

You can sign in using your registered email address:
${loginUrl}

Regards,
Unified Assessment Platform
    `.trim();

    // Dispatch email to student recipient
    return this.sendMail({
      // Target student email address
      to: user.email,
      // Subject line
      subject: 'Welcome to UAP — Student Account Created',
      // Plain text fallback
      text,
      // HTML formatted email body
      html,
    // Complete options
    });
  // End sendStudentAccountCreatedEmail method
  }

  // 3c. Faculty Account Created Welcome Email
  // Dispatch onboarding welcome email to a faculty member or instructor created by an administrator
  async sendFacultyAccountCreatedEmail(user) {
    // Base URL for frontend application from environment with fallback
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Construct direct login portal URL
    const loginUrl = `${clientUrl}/auth/login`;

    // Construct styled HTML welcoming faculty with assigned institutional credentials
    const html = this.buildHtmlTemplate({
      // Heading banner title
      title: 'Welcome to Unified Assessment Platform — Faculty Access',
      // Instructor recipient name
      recipientName: user.name,
      // HTML message content displaying faculty ID, role credentials, and authoring capabilities
      messageHtml: `
        <p>Your faculty / instructor account has been created by the institutional administrator.</p>
        <div style="padding: 14px; background-color: #f0fdf4; border-left: 4px solid #3D8A78; border-radius: 8px; margin: 16px 0;">
          <strong>Faculty ID:</strong> ${user.facultyId || 'Assigned'}<br />
          <strong>Registered Email:</strong> ${user.email}<br />
          <strong>Role:</strong> Instructor / Faculty<br />
          <strong>Account Status:</strong> Active
        </div>
        <p>You can now sign in using your registered email address to author examinations, curate question banks, and evaluate student submissions.</p>
        <p style="margin-top: 16px;"><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      `,
      // Login route URL
      actionUrl: '/auth/login',
      // Button call-to-action label
      actionText: 'Sign In to Instructor Studio',
    // Complete template parameters
    });

    // Construct plain-text alternative for faculty welcome message
    const text = `
Hello ${user.name || 'there'},

Your faculty account for the Unified Assessment Platform has been created.

Faculty ID: ${user.facultyId || 'Assigned'}
Email: ${user.email}
Role: Instructor
Status: Active

You can sign in using your registered email address:
${loginUrl}

Regards,
Unified Assessment Platform
    `.trim();

    // Dispatch email to faculty recipient
    return this.sendMail({
      // Target faculty email address
      to: user.email,
      // Subject line
      subject: 'Welcome to UAP — Faculty Account Created',
      // Plain text fallback
      text,
      // HTML formatted email body
      html,
    // Complete options
    });
  // End sendFacultyAccountCreatedEmail method
  }

  // Controlled test email method for delivery verification
  // Send simple diagnostic probe email to verify SMTP delivery pipeline
  async sendTestEmail(to = 'test@uap.edu') {
    // Invoke generic sendMail with test parameters
    return this.sendMail({
      // Recipient target email address
      to,
      // Test subject header
      subject: 'UAP Test Email',
      // Plain text test message
      text: 'This is a UAP SMTP delivery test.',
      // HTML formatted test message
      html: '<p>This is a UAP SMTP delivery test.</p>',
    // Complete mail options
    });
  // End sendTestEmail method
  }

  // 4. Account Rejected Email
  // Dispatch notification to applicant when their registration application cannot be approved
  async sendAccountRejectedEmail(user, reason) {
    // Generate rejection notification HTML with explanation details
    const html = this.buildHtmlTemplate({
      // Header title
      title: 'Account Application Status',
      // Recipient applicant name
      recipientName: user.name,
      // Formatted HTML body with rejected status reason and next steps
      messageHtml: `
        <p>We are writing to inform you that your registration application for the Unified Assessment Platform could not be approved at this time.</p>
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 16px 0;">
          <strong>Reason Provided:</strong><br />
          ${reason || 'Institutional verification criteria could not be verified.'}
        </div>
        <p>If you believe this decision was made in error, please contact your academic administrator.</p>
      `,
      // Signup URL to re-apply if necessary
      actionUrl: '/auth/signup',
      // Button call-to-action label
      actionText: 'Re-apply with Updated Information',
    // Complete template parameters
    });

    // Transmit rejection email to applicant
    return this.sendMail({
      // Recipient email address
      to: user.email,
      // Subject header
      subject: 'Account Application Status — Unified Assessment Platform',
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendAccountRejectedEmail method
  }

  // 5. Account Revoked Email
  // Dispatch notice to user when an administrator has revoked or deactivated their platform access
  async sendAccountRevokedEmail(user, reason) {
    // Construct HTML template informing user of account deactivation
    const html = this.buildHtmlTemplate({
      // Header banner title
      title: 'Account Access Revoked',
      // Recipient full name
      recipientName: user.name,
      // HTML body containing administrative revocation notice
      messageHtml: `
        <p>Your access to the Unified Assessment Platform has been revoked by an institutional administrator.</p>
        <div style="padding: 12px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; margin: 16px 0;">
          <strong>Notice:</strong><br />
          ${reason || 'Account deactivated by administrative policy.'}
        </div>
        <p>Please contact your department coordinator for further assistance.</p>
      `,
    // Complete template parameters
    });

    // Transmit revocation email to affected user
    return this.sendMail({
      // Recipient email address
      to: user.email,
      // Subject header
      subject: 'Account Status Notice — Unified Assessment Platform',
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendAccountRevokedEmail method
  }

  // 6. Assessment Published Notification
  // Dispatch announcement email to an enrolled student when an instructor publishes a new assessment
  async sendAssessmentPublishedEmail(studentUser, assessment) {
    // Build notification HTML highlighting exam title, duration, and passing threshold
    const html = this.buildHtmlTemplate({
      // Heading title
      title: 'New Assessment Published',
      // Student recipient name
      recipientName: studentUser.name,
      // HTML details describing assessment requirements and time limits
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
      // Direct path to assessment attempt console using assessment identifier
      actionUrl: `/student/attempt/${assessment._id || assessment.id}`,
      // Call-to-action button text
      actionText: 'Start Assessment Attempt',
    // Complete template parameters
    });

    // Transmit announcement email to student
    return this.sendMail({
      // Target student email address
      to: studentUser.email,
      // Subject line containing assessment title
      subject: `New Assessment Available: ${assessment.title}`,
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendAssessmentPublishedEmail method
  }

  // 7. Student Submission Notification to Instructor
  // Dispatch notification email to an instructor when a student submits an assessment attempt
  async sendSubmissionReceivedEmail(instructorUser, studentUser, assessment, submission) {
    // Build notification HTML displaying student details, submission score, and grading status
    const html = this.buildHtmlTemplate({
      // Heading title
      title: 'New Examination Submission',
      // Instructor recipient name
      recipientName: instructorUser.name,
      // HTML summary of student submission and auto-grading status
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
      // Direct link navigating instructor to the submission evaluation studio
      actionUrl: `/instructor/evaluate/${submission._id || submission.id}`,
      // Call-to-action button text
      actionText: 'Open Evaluation Studio',
    // Complete template parameters
    });

    // Transmit notification email to instructor
    return this.sendMail({
      // Recipient instructor email address
      to: instructorUser.email,
      // Dynamic subject line incorporating student name and assessment title
      subject: `Submission Received: ${studentUser.name} — ${assessment.title}`,
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendSubmissionReceivedEmail method
  }

  // 8. Grade Released Notification to Student
  // Dispatch results notification to student once their assessment evaluation is completed and grades are released
  async sendGradeReleasedEmail(studentUser, assessment, submission) {
    // Evaluate whether the submission met or exceeded passing criteria
    const isPassed = submission.passed || submission.resultStatus === 'passed';
    // Select green color scheme for passing scores or red for failing outcomes
    const outcomeColor = isPassed ? '#653416' : '#991b1b';
    // Select light green background for passing score card or light red for failure
    const outcomeBg = isPassed ? '#fdf5f0' : '#fef2f2';

    // Construct styled HTML displaying score breakdown, percentage, and instructor feedback
    const html = this.buildHtmlTemplate({
      // Heading banner title
      title: 'Evaluation Completed & Grade Released',
      // Student recipient name
      recipientName: studentUser.name,
      // HTML score card with outcome badges and feedback quotations
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
      // Direct navigation link to student dashboard
      actionUrl: `/student/dashboard`,
      // Call-to-action button text
      actionText: 'View Assessment Result',
    // Complete template parameters
    });

    // Transmit grade release email to student
    return this.sendMail({
      // Recipient student email address
      to: studentUser.email,
      // Dynamic subject line incorporating assessment title and final percentage
      subject: `Evaluation Completed: ${assessment.title} (${submission.percentage}%)`,
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendGradeReleasedEmail method
  }

  // 9. Password Reset Email
  // Dispatch secure password recovery link to user containing timed authorization token
  async sendPasswordResetEmail(user, resetToken) {
    // Base URL for client application from environment with fallback
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    // Formulate complete password reset link with authentication token query parameter
    const resetUrl = `${clientUrl}/auth/reset-password?token=${resetToken}`;

    // Construct styled HTML notification outlining token expiration and security instructions
    const html = this.buildHtmlTemplate({
      // Heading banner title
      title: 'Password Reset Request',
      // Recipient user name
      recipientName: user.name,
      // HTML body containing reset instructions, token expiration notice, and security precautions
      messageHtml: `
        <p>You recently requested to reset the password for your Unified Assessment Platform account.</p>
        <p>Click the button below to choose a new password. For security compliance, this link will expire in <strong>1 hour</strong>.</p>
        <p style="margin-top: 16px; padding: 12px; background-color: #f8fafc; border-left: 4px solid #94a3b8; border-radius: 6px; font-size: 13px; color: #475569;">
          <strong>Security Notice:</strong> If you did not request this password reset, you can safely ignore this email. Your account credentials remain secure and unchanged.
        </p>
      `,
      // Relative reset password link for button
      actionUrl: `/auth/reset-password?token=${resetToken}`,
      // Call-to-action button label
      actionText: 'Reset Password',
    // Complete template parameters
    });

    // Construct plain-text alternative version of the password reset email
    const text = `
Hello ${user.name || 'there'},

You recently requested to reset the password for your Unified Assessment Platform account.

To establish a new password, open the link below in your browser:
${resetUrl}

This link will expire in 1 hour.

Security Notice: If you did not make this request, you can safely ignore this email. Your credentials remain secure.

Regards,
Unified Assessment Platform
    `.trim();

    // Transmit password reset email to user's registered address
    return this.sendMail({
      // Recipient user email
      to: user.email,
      // Standardized subject header
      subject: 'Password Reset Request — Unified Assessment Platform',
      // Plain text fallback
      text,
      // Rendered HTML content
      html,
    // Complete mail options
    });
  // End sendPasswordResetEmail method
  }

  // 10. Multi-Factor Authentication Email OTP
  // Dispatches an ephemeral 6-digit verification code to user's registered email address for two-factor login
  async sendMfaEmailOtp({ to, name, code, expiryMinutes = 5 }) {
    // Generate styled HTML email notification with distinct verification code display card
    const html = this.buildHtmlTemplate({
      title: 'Your Verification Code',
      recipientName: name || 'there',
      messageHtml: `
        <p>A sign-in attempt requires your secondary verification code.</p>
        <p>Enter the 6-digit code below to complete your login to the <strong>Unified Assessment Platform</strong>:</p>
        <div style="margin: 24px 0; text-align: center;">
          <div style="display: inline-block; padding: 16px 32px; background-color: #f1f5f9; border: 2px dashed #3D8A78; border-radius: 12px; font-family: monospace, Courier, sans-serif; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">
            ${code}
          </div>
        </div>
        <p style="font-size: 13px; color: #64748b;">
          This code is single-use and will expire in <strong>${expiryMinutes} minutes</strong>.
        </p>
        <div style="margin-top: 20px; padding: 12px 16px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; font-size: 13px; color: #991b1b;">
          <strong>Security Warning:</strong> Never share this code with anyone. Platform administrators and instructors will never ask for your verification code. If you did not initiate this login request, please secure your account immediately.
        </div>
      `,
    });

    const text = `
Hello ${name || 'there'},

Your Unified Assessment Platform verification code is: ${code}

This code is valid for ${expiryMinutes} minutes and can only be used once.

Security Notice: Never share this code with anyone. If you did not attempt to sign in, please secure your account credentials immediately.

Regards,
Unified Assessment Platform
    `.trim();

    return this.sendMail({
      to,
      subject: 'Your Two-Factor Verification Code — Unified Assessment Platform',
      text,
      html,
    });
  // End sendMfaEmailOtp method
  }

  // Test Inspection Helpers
  // Retrieve list of all dispatched email records stored in memory
  getSentEmails() {
    // Return array of recorded sent email objects
    return this.sentEmails;
  // End getSentEmails method
  }

  // Retrieve the most recently dispatched email record from memory
  getLastEmail() {
    // Return the last item in sentEmails array or null if empty
    return this.sentEmails[this.sentEmails.length - 1] || null;
  // End getLastEmail method
  }

  // Clear in-memory history of dispatched emails
  clearSentEmails() {
    // Reset sentEmails array to empty list
    this.sentEmails = [];
  // End clearSentEmails method
  }
// Close EmailService class definition
}

// Instantiate singleton instance of EmailService for consumption across the application
const emailServiceInstance = new EmailService();

// Check if script is executed directly via command line interface (CLI) rather than imported
if (require.main === module) {
  // Self-executing asynchronous function to run SMTP connectivity diagnostics from CLI
  (async () => {
    // When invoked directly from the CLI (e.g., node src/services/email.service.js or npm run test:smtp),
    // force live test mode so it tests the actual SMTP configuration against the real mail server.
    // Override isTestMode flag to false to test live network settings
    emailServiceInstance.isTestMode = false;
    // Re-initialize transporter using live configuration parameters
    emailServiceInstance.initTransporter();

    // Print decorative header banner to console
    console.log('==================================================');
    // Print diagnostic title banner to console
    console.log('Unified Assessment Platform — SMTP Delivery Test');
    // Print decorative separator banner to console
    console.log('==================================================');
    // Print detected SMTP host configuration or placeholder if unset
    console.log(`SMTP Host:    ${process.env.SMTP_HOST || '(not set)'}`);
    // Print detected SMTP port configuration defaulting to 587
    console.log(`SMTP Port:    ${process.env.SMTP_PORT || 587}`);
    // Print detected SMTP secure SSL/TLS configuration
    console.log(`SMTP Secure:  ${process.env.SMTP_SECURE || 'false'}`);
    // Print detected SMTP username status (hidden to protect credentials)
    console.log(`SMTP User:    ${process.env.SMTP_USER ? '[CONFIGURED - HIDDEN]' : '[NOT CONFIGURED]'}`);
    // Print masked indicator if password is present, or not configured message
    console.log(`SMTP Pass:    ${(process.env.SMTP_PASSWORD || process.env.SMTP_PASS) ? '[CONFIGURED - HIDDEN]' : '[NOT CONFIGURED]'}`);
    // Print configured sender address or placeholder if unset
    console.log(`Email From:   ${process.env.EMAIL_FROM || process.env.SMTP_FROM || '(not set)'}`);
    // Print separator line to console
    console.log('--------------------------------------------------');

    // Print status message indicating SMTP connection verification has commenced
    console.log('Testing SMTP connection...');
    // Await execution of verifyConnection to test handshake with mail server
    const verifyResult = await emailServiceInstance.verifyConnection();
    // Log structured verification output object
    console.log('Verification Result:', verifyResult);

    // If connection verification succeeded and active mode is live SMTP, attempt test dispatch
    if (verifyResult.verified && verifyResult.mode === 'smtp_live') {
      // Determine destination recipient address from CLI arguments, SMTP_USER, or default test inbox
      const targetRecipient = process.argv[2] || process.env.SMTP_USER || 'test@uap.edu';
      // Log test dispatch notice without exposing credentials
      console.log('Attempting to dispatch controlled test email to verified destination...');
      // Await delivery test execution for the target recipient
      const sendResult = await emailServiceInstance.sendTestEmail(targetRecipient);
      // Log resulting status response from send operation
      console.log('Send Email Result:', sendResult);
      // Check whether dispatch reported success
      if (sendResult.success) {
        // Output confirmation message for successful test delivery
        console.log('SUCCESS: Test email dispatched successfully.');
      // Handle failed delivery
      } else {
        // Output failure message with sanitized error explanation
        console.error('FAILURE: Failed to dispatch test email:', sendResult.error);
        // Set Node process exit code to 1 indicating error
        process.exitCode = 1;
      // End success conditional check
      }
    // Handle fallback or unverified scenarios
    } else {
      // Output explanation regarding why live email dispatch was skipped
      console.log('Live SMTP verification note:', verifyResult.error || 'Fallback mode or unverified');
      // If verification explicitly failed, set process exit code to 1
      if (!verifyResult.verified) {
        // Set process exit code to 1 indicating diagnostic verification failure
        process.exitCode = 1;
      // End verification failure check
      }
    // End verification mode check
    }
  // Complete asynchronous CLI test execution wrapper
  })();
// End CLI conditional execution check
}

// Export singleton instance of EmailService for use across backend routes and controllers
module.exports = emailServiceInstance;
