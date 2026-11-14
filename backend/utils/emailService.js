const nodemailer = require('nodemailer');

// Setup reusable transporter
let transporter = null;

if (process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends or simulates an email notification
 */
async function sendNotificationEmail({ to, subject, htmlContent, textFallback }) {
  const from = process.env.SMTP_FROM || 'SCMS Portal <scms-noreply@zeal.edu.in>';

  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: textFallback,
        html: htmlContent,
      });
      console.log(`📧 [EMAIL SENT] to=${to} subject="${subject}" messageId=${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.warn(`⚠️ [EMAIL FAILED] to=${to}: ${err.message}. Falling back to simulation.`);
    }
  }

  // Simulated Email Dispatch for local/development mode
  console.log(`📨 [SIMULATED EMAIL DISPATCH]`);
  console.log(`   To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body: ${textFallback || 'HTML Notification Content'}`);
  return { success: true, simulated: true };
}

/**
 * Trigger email when complaint is submitted
 */
async function notifyComplaintCreated(complaint) {
  const studentEmail = complaint.studentEmail || 'student@zeal.edu.in';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #4f46e5;">Zeal SCMS - Grievance Registered</h2>
      <p>Hello <strong>${complaint.studentName}</strong>,</p>
      <p>Your grievance has been lodged successfully and registered into the college queue.</p>
      <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #4f46e5; border-radius: 4px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${complaint.ticketId}</p>
        <p><strong>Title:</strong> ${complaint.title}</p>
        <p><strong>Department:</strong> ${complaint.department}</p>
        <p><strong>Priority:</strong> ${complaint.priority}</p>
        <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: bold;">${complaint.status}</span></p>
      </div>
      <p>You can track resolution progress on the SCMS student portal.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #64748b;">Zeal College of Engineering & Technology - Grievance Redressal Committee</p>
    </div>
  `;

  return sendNotificationEmail({
    to: studentEmail,
    subject: `[SCMS] Complaint Submitted: ${complaint.ticketId}`,
    htmlContent: html,
    textFallback: `Your complaint ${complaint.ticketId} (${complaint.title}) has been registered with status: ${complaint.status}.`,
  });
}

/**
 * Trigger email when status or remarks are updated
 */
async function notifyComplaintUpdated(complaint, updateInfo) {
  const studentEmail = complaint.studentEmail || 'student@zeal.edu.in';
  const statusColor = complaint.status === 'Resolved' ? '#10b981' : '#0ea5e9';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: ${statusColor};">Ticket Status Updated: ${complaint.ticketId}</h2>
      <p>Hello <strong>${complaint.studentName}</strong>,</p>
      <p>An official update was posted regarding your grievance ticket.</p>
      <div style="background: #f8fafc; padding: 15px; border-left: 4px solid ${statusColor}; border-radius: 4px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${complaint.ticketId}</p>
        <p><strong>Current Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${complaint.status}</span></p>
        ${updateInfo.remarkText ? `<p><strong>Official Remark:</strong> <em>"${updateInfo.remarkText}"</em></p>` : ''}
        ${complaint.assignedTo?.name ? `<p><strong>Assigned Officer:</strong> ${complaint.assignedTo.name}</p>` : ''}
      </div>
      <p>Visit the SCMS Portal to review the updated resolution timeline.</p>
    </div>
  `;

  return sendNotificationEmail({
    to: studentEmail,
    subject: `[SCMS Update] ${complaint.ticketId} is now ${complaint.status}`,
    htmlContent: html,
    textFallback: `Your ticket ${complaint.ticketId} status has been updated to ${complaint.status}.`,
  });
}

module.exports = {
  sendNotificationEmail,
  notifyComplaintCreated,
  notifyComplaintUpdated,
};

