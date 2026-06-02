import { Resend } from "resend";

export type NotifyMailParams = {
  to: string;
  bcc?: string;
  subject: string;
  text: string;
  html: string;
};

// Validate email format
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Retry logic with exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const sendNotifyMail = async (
  { to, bcc, subject, text, html }: NotifyMailParams,
  maxRetries = 3
) => {
  const { RESEND_API_KEY, RESEND_FROM_EMAIL, OTP_BCC_EMAIL } = process.env;
  
  // More detailed environment variable validation
  if (!RESEND_API_KEY) {
    console.error("[Email] RESEND_API_KEY is not configured");
    throw new Error("Email service not configured: Missing API key");
  }
  
  if (!RESEND_FROM_EMAIL) {
    console.error("[Email] RESEND_FROM_EMAIL is not configured");
    throw new Error("Email service not configured: Missing sender email");
  }

  if (!isValidEmail(to)) {
    console.warn(`[Email] Invalid recipient email: ${to}`);
    throw new Error(`Invalid email address: ${to}`);
  }

  // Use BCC from parameter, or fallback to OTP_BCC_EMAIL if not provided
  const finalBcc = bcc?.trim() || (OTP_BCC_EMAIL?.trim() ? OTP_BCC_EMAIL.trim() : undefined);
  
  if (finalBcc && !isValidEmail(finalBcc)) {
    console.warn(`[Email] Invalid BCC email: ${finalBcc}`);
    throw new Error(`Invalid BCC email address: ${finalBcc}`);
  }

  console.log(`[Email] Config check: FROM=${RESEND_FROM_EMAIL}, TO=${to}, BCC=${finalBcc || "none"}, KEY_PREFIX=${RESEND_API_KEY.substring(0, 10)}...`);

  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Email] Send attempt ${attempt + 1}/${maxRetries} for ${to}, BCC: ${finalBcc || "none"}`);
      const resend = new Resend(RESEND_API_KEY);
      
      const emailPayload: any = {
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        text,
        html,
      };
      
      // Only add BCC if it's a valid email
      if (finalBcc && isValidEmail(finalBcc)) {
        emailPayload.bcc = finalBcc;
        console.log(`[Email] BCC included: ${finalBcc}`);
      } else if (finalBcc) {
        console.warn(`[Email] BCC skipped - invalid email: ${finalBcc}`);
      }
      
      const response = await resend.emails.send(emailPayload);

      // Check if Resend returned an error
      if (response.error) {
        const errorMsg = JSON.stringify(response.error);
        console.error(`[Email] Resend API rejected email to ${to}:`, errorMsg);
        throw new Error(`Resend API error: ${errorMsg}`);
      }

      // Successful send
      if (response.data?.id) {
        console.log(`[Email] ✓ Email sent successfully to ${to}, ID: ${response.data.id}`);
        
        // If BCC was requested but Resend doesn't support it with unverified domains,
        // send a separate email to the BCC recipient as a fallback
        if (finalBcc && isValidEmail(finalBcc)) {
          console.log(`[Email] 📧 Attempting BCC fallback send to ${finalBcc}...`);
          try {
            const bccResend = new Resend(RESEND_API_KEY);
            const bccResponse = await bccResend.emails.send({
              from: RESEND_FROM_EMAIL,
              to: finalBcc,
              subject: `[COPY - BCC] ${subject}`,
              text: `[This is a copy of an email sent to ${to}]\n\n${text}`,
              html: `<p><strong>Copy:</strong> <em>This email was also sent to ${to}</em></p><hr/>${html}`,
            });
            
            if (bccResponse.data?.id) {
              console.log(`[Email] ✓ BCC copy sent to ${finalBcc}, ID: ${bccResponse.data.id}`);
            } else if (bccResponse.error) {
              console.warn(`[Email] ⚠️  BCC fallback failed: ${bccResponse.error?.message || "Unknown error"}`);
            }
          } catch (bccError: any) {
            console.warn(`[Email] ⚠️  BCC fallback exception: ${bccError?.message || "Unknown error"}`);
          }
        }
        
        return response;
      }

      console.warn(`[Email] Unexpected response format from Resend for ${to}:`, response);
      throw new Error("Resend response missing email ID");
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || error?.toString() || "Unknown error";
      console.error(
        `[Email] Attempt ${attempt + 1} FAILED for ${to}: ${errorMsg}`
      );

      // Check if error is retryable (not a permanent client error)
      const isPermanentError = 
        error?.status === 400 || 
        error?.status === 401 || 
        error?.status === 403 || 
        error?.status === 422 ||
        errorMsg.includes("Invalid") ||
        errorMsg.includes("Unauthorized") ||
        errorMsg.includes("Forbidden");

      if (isPermanentError) {
        console.error(`[Email] Permanent error (not retrying): ${errorMsg}`);
        throw error;
      }

      // Retry with exponential backoff for transient errors
      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[Email] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  console.error(`[Email] ✗ All ${maxRetries} attempts failed for ${to}`);
  throw new Error(
    `Failed to send email after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
};
