/**
 * Validate critical environment configuration at startup
 */
export function validateEmailConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    issues.push("❌ RESEND_API_KEY is not configured");
  } else if (!apiKey.startsWith("re_")) {
    issues.push("⚠️  RESEND_API_KEY may be invalid (should start with 're_')");
  }

  if (!fromEmail) {
    issues.push("❌ RESEND_FROM_EMAIL is not configured");
  } else if (fromEmail.includes("onboarding@resend.dev")) {
    issues.push(
      "⚠️  RESEND_FROM_EMAIL uses sandbox domain (onboarding@resend.dev). Only verified recipients will receive emails."
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function logConfigStatus(): void {
  const { valid, issues } = validateEmailConfig();

  if (valid) {
    console.log("✅ Email configuration is valid");
  } else {
    console.warn("\n📧 EMAIL CONFIGURATION ISSUES:\n");
    issues.forEach((issue) => console.warn(`  ${issue}`));
    console.warn("\n");
  }
}
