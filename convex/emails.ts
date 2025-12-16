"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Get the from email address from environment variable or use default
function getFromEmail(): string {
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  return `Diabetes Risk Prediction <${fromEmail}>`;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const sendVerificationEmail = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Validate email format
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return { success: false, error: "Email service is not configured. Please contact support." };
    }

    // Create verification code in database
    let code: string;
    let expiresAt: number;
    try {
      const result = await ctx.runMutation(
        api.emailVerification.createVerificationCode,
        { email: args.email }
      );
      code = result.code;
      expiresAt = result.expiresAt;
    } catch (error: any) {
      console.error("Failed to create verification code:", error);
      return { success: false, error: `Failed to create verification code: ${error?.message || "Unknown error"}` };
    }

    // Send email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>", // Use your domain after verifying
        to: args.email.trim(),
        subject: "Verify Your Email - Diabetes Risk Prediction System",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Email Verification</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Verify Your Email Address</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0;">
                  Thank you for registering! Please use the verification code below to complete your registration:
                </p>
                
                <div style="background: #f1f5f9; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                  <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">Your verification code is:</p>
                  <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3B82F6;">
                    ${code}
                  </div>
                  <p style="color: #94a3b8; margin: 15px 0 0 0; font-size: 13px;">
                    This code expires in 15 minutes
                  </p>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0; font-size: 14px;">
                  If you didn't create an account with us, you can safely ignore this email.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        const errorMessage = error.message || JSON.stringify(error) || "Failed to send email";
        return { success: false, error: `Email sending failed: ${errorMessage}` };
      }

      return { success: true, messageId: data?.id };
    } catch (error: any) {
      console.error("Email sending error:", error);
      const errorMessage = error?.message || error?.toString() || "Failed to send verification email";
      return { success: false, error: `Email sending error: ${errorMessage}` };
    }
  },
});

// Send support response email
export const sendSupportResponseEmail = action({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    subject: v.string(),
    response: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate email format
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    // Send email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>", // Use your domain after verifying
        to: args.email.trim(),
        subject: `Re: ${args.subject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Support Response</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Response to Your Support Request</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  ${args.name ? `Hello ${args.name},` : 'Hello,'}
                </p>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  Thank you for contacting us. We've reviewed your support request regarding "<strong>${args.subject}</strong>" and here's our response:
                </p>
                
                <div style="background: #f1f5f9; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                  <div style="color: #1e293b; line-height: 1.8; white-space: pre-wrap;">${args.response}</div>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  If you have any further questions or concerns, please don't hesitate to reach out to us again.
                </p>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  Best regards,<br>
                  <strong>Support Team</strong><br>
                  Diabetes Risk Prediction System
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: "Failed to send email" };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send support response email" };
    }
  },
});

// Send password reset email
export const sendPasswordResetEmail = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Validate email format
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    // Create password reset code in database
    const result = await ctx.runMutation(
      api.emailVerification.createPasswordResetCode,
      { email: args.email }
    );

    // Always return success (don't reveal if email exists)
    if (!result.success) {
      return { success: true, message: "If an account exists with this email, a password reset code has been sent." };
    }

    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured in Convex environment variables");
      // Still return success to not reveal the issue, but log it
      return { 
        success: true, 
        message: "If an account exists with this email, a password reset code has been sent.",
        warning: "Email service not configured. Please check server logs."
      };
    }

    // Send email via Resend
    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>", // Use your domain after verifying
        to: args.email.trim(),
        subject: "Reset Your Password - Diabetes Risk Prediction System",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Reset Your Password</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0;">
                  We received a request to reset your password. Use the code below to reset your password:
                </p>
                
                <div style="background: #f1f5f9; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                  <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">Your password reset code is:</p>
                  <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3B82F6;">
                    ${result.code}
                  </div>
                  <p style="color: #94a3b8; margin: 15px 0 0 0; font-size: 13px;">
                    This code expires in 15 minutes
                  </p>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0; font-size: 14px;">
                  If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                </p>
                
                <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="color: #92400E; margin: 0; font-size: 13px; line-height: 1.5;">
                    <strong>Security Tip:</strong> Never share this code with anyone. Our support team will never ask for your password reset code.
                  </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error sending password reset email:", error);
        // Log detailed error for debugging
        console.error("Error details:", JSON.stringify(error, null, 2));
        return { success: false, error: `Failed to send email: ${error.message || "Unknown error"}` };
      }

      console.log("Password reset email sent successfully:", data?.id);
      return { success: true, messageId: data?.id };
    } catch (error: any) {
      console.error("Email sending error:", error);
      console.error("Error stack:", error?.stack);
      return { success: false, error: `Failed to send password reset email: ${error?.message || "Unknown error"}` };
    }
  },
});

// Send assessment result email to patient
export const sendAssessmentResultEmail = action({
  args: {
    email: v.string(),
    patientName: v.string(),
    riskScore: v.number(),
    riskCategory: v.string(),
    recommendations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    const riskColor = args.riskCategory === "very_high" ? "#EF4444" :
                     args.riskCategory === "high" ? "#F97316" :
                     args.riskCategory === "moderate" ? "#EAB308" : "#22C55E";

    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>",
        to: args.email.trim(),
        subject: `Your Diabetes Risk Assessment Results - ${args.riskScore.toFixed(1)}%`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Assessment Results</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hello ${args.patientName},</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0;">
                  Your diabetes risk assessment has been completed. Here are your results:
                </p>
                
                <div style="background: #f1f5f9; border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0; border-left: 4px solid ${riskColor};">
                  <p style="color: #64748b; margin: 0 0 10px 0; font-size: 14px;">Your Risk Score</p>
                  <div style="font-size: 48px; font-weight: bold; color: ${riskColor}; margin: 10px 0;">
                    ${args.riskScore.toFixed(1)}%
                  </div>
                  <p style="color: #64748b; margin: 10px 0 0 0; font-size: 16px; text-transform: capitalize; font-weight: 600;">
                    ${args.riskCategory.replace('_', ' ')} Risk
                  </p>
                </div>
                
                ${args.recommendations.length > 0 ? `
                <div style="margin: 30px 0;">
                  <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">Recommendations</h3>
                  <ul style="color: #64748b; line-height: 1.8; margin: 0; padding-left: 20px;">
                    ${args.recommendations.map(rec => `<li style="margin-bottom: 10px;">${rec}</li>`).join('')}
                  </ul>
                </div>
                ` : ''}
                
                <p style="color: #64748b; line-height: 1.6; margin: 30px 0 20px 0;">
                  You can view detailed results and track your progress in your dashboard.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: "Failed to send email" };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send assessment result email" };
    }
  },
});

// Send doctor assignment notification email
export const sendAssignmentNotificationEmail = action({
  args: {
    email: v.string(),
    recipientName: v.string(),
    doctorName: v.optional(v.string()),
    patientName: v.optional(v.string()),
    status: v.union(v.literal("accepted"), v.literal("rejected"), v.literal("requested")),
    isPatient: v.boolean(), // true if email is to patient, false if to doctor
  },
  handler: async (ctx, args) => {
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    let subject = "";
    let message = "";
    
    if (args.status === "accepted") {
      subject = args.isPatient 
        ? `Your doctor request has been accepted`
        : `Your patient request has been accepted`;
      message = args.isPatient
        ? `Great news! Dr. ${args.doctorName} has accepted your request to be your healthcare provider. You can now communicate and share your health data with them.`
        : `Great news! ${args.patientName} has accepted your request to be their healthcare provider. You can now view their health data and provide care.`;
    } else if (args.status === "rejected") {
      subject = args.isPatient
        ? `Your doctor request has been declined`
        : `Your patient request has been declined`;
      message = args.isPatient
        ? `Unfortunately, Dr. ${args.doctorName} has declined your request. You can request another doctor from your profile.`
        : `Unfortunately, ${args.patientName} has declined your request.`;
    } else {
      subject = args.isPatient
        ? `New doctor request`
        : `New patient request`;
      message = args.isPatient
        ? `Dr. ${args.doctorName} wants to be your healthcare provider. Please check your dashboard to accept or reject this request.`
        : `${args.patientName} wants to add you as their healthcare provider. Please check your dashboard to accept or reject this request.`;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>",
        to: args.email.trim(),
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Healthcare Provider Update</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hello ${args.recipientName},</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  ${message}
                </p>
                
                ${args.status === "accepted" ? `
                <div style="background: #D1FAE5; border-left: 4px solid #10B981; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.5;">
                    <strong>Next Steps:</strong> Log in to your dashboard to start managing your health data and communicating with your ${args.isPatient ? 'doctor' : 'patient'}.
                  </p>
                </div>
                ` : ''}
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: "Failed to send email" };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send assignment notification email" };
    }
  },
});

// Send high-risk alert email
export const sendHighRiskAlertEmail = action({
  args: {
    email: v.string(),
    patientName: v.string(),
    riskScore: v.number(),
    riskCategory: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>",
        to: args.email.trim(),
        subject: `⚠️ High Risk Alert - ${args.riskScore.toFixed(1)}% Diabetes Risk`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">⚠️ High Risk Alert</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Diabetes Risk Prediction</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hello ${args.patientName},</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0;">
                  Your recent assessment indicates a <strong style="color: #EF4444;">${args.riskCategory.replace('_', ' ').toUpperCase()} RISK</strong> for diabetes.
                </p>
                
                <div style="background: #FEE2E2; border-left: 4px solid #EF4444; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                  <p style="color: #991B1B; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Your Risk Score</p>
                  <div style="font-size: 36px; font-weight: bold; color: #EF4444;">
                    ${args.riskScore.toFixed(1)}%
                  </div>
                </div>
                
                <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="color: #92400E; margin: 0; font-size: 14px; line-height: 1.5;">
                    <strong>Important:</strong> Please consult with your healthcare provider as soon as possible. Early intervention and lifestyle changes can significantly reduce your risk.
                  </p>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 30px 0 20px 0;">
                  Log in to your dashboard to view detailed recommendations and share this information with your doctor.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: "Failed to send email" };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send high-risk alert email" };
    }
  },
});

// Send new message notification email
export const sendNewMessageEmail = action({
  args: {
    email: v.string(),
    recipientName: v.string(),
    senderName: v.string(),
    messagePreview: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>",
        to: args.email.trim(),
        subject: `New message from ${args.senderName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🏥 Diabetes Risk Prediction</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">New Message</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hello ${args.recipientName},</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  You have received a new message from <strong>${args.senderName}</strong>:
                </p>
                
                <div style="background: #f1f5f9; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                  <p style="color: #1e293b; line-height: 1.8; margin: 0; white-space: pre-wrap;">${args.messagePreview}</p>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0;">
                  Log in to your dashboard to view and respond to this message.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        return { success: false, error: "Failed to send email" };
      }

      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error("Email sending error:", error);
      return { success: false, error: "Failed to send new message email" };
    }
  },
});

/**
 * Send medication reminder email
 */
export const sendMedicationReminderEmail = action({
  args: {
    email: v.string(),
    patientName: v.string(),
    medicationName: v.string(),
    dosage: v.string(),
    reminderTime: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.email || !isValidEmail(args.email)) {
      return { success: false, error: "Invalid email address format" };
    }

    try {
      const { data, error } = await resend.emails.send({
        from: "Diabetes Risk Prediction <onboarding@resend.dev>",
        to: args.email.trim(),
        subject: `Medication Reminder: Time to take ${args.medicationName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f7fa;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">💊 Medication Reminder</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Time to Take Your Medication</p>
              </div>
              
              <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 22px;">Hello ${args.patientName},</h2>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 30px 0;">
                  This is a reminder to take your medication at <strong>${args.reminderTime}</strong>.
                </p>
                
                <div style="background: #f1f5f9; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 0 0 30px 0;">
                  <p style="color: #1e293b; margin: 0 0 10px 0; font-weight: bold; font-size: 18px;">${args.medicationName}</p>
                  <p style="color: #64748b; margin: 0; font-size: 16px;">Dosage: <strong>${args.dosage}</strong></p>
                </div>
                
                <p style="color: #64748b; line-height: 1.6; margin: 0 0 20px 0; font-size: 14px;">
                  Please take your medication as prescribed. If you have any questions or concerns, contact your healthcare provider.
                </p>
                
                <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?tab=medications" 
                   style="display: inline-block; background-color: #3B82F6; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 10px;">
                  View Medications
                </a>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                
                <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
                  Diabetes Risk Prediction & Early Detection System<br>
                  Aligned with Oman Vision 2040
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (error) {
        console.error("Resend email error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error("Failed to send medication reminder email:", error);
      return { success: false, error: error.message };
    }
  },
});

