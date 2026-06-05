"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmailConfig = validateEmailConfig;
exports.logConfigStatus = logConfigStatus;
/**
 * Validate critical environment configuration at startup
 */
function validateEmailConfig() {
    var issues = [];
    var apiKey = process.env.RESEND_API_KEY;
    var fromEmail = process.env.RESEND_FROM_EMAIL;
    if (!apiKey) {
        issues.push("❌ RESEND_API_KEY is not configured");
    }
    else if (!apiKey.startsWith("re_")) {
        issues.push("⚠️  RESEND_API_KEY may be invalid (should start with 're_')");
    }
    if (!fromEmail) {
        issues.push("❌ RESEND_FROM_EMAIL is not configured");
    }
    else if (fromEmail.includes("onboarding@resend.dev")) {
        issues.push("⚠️  RESEND_FROM_EMAIL uses sandbox domain (onboarding@resend.dev). Only verified recipients will receive emails.");
    }
    return {
        valid: issues.length === 0,
        issues: issues,
    };
}
function logConfigStatus() {
    var _a = validateEmailConfig(), valid = _a.valid, issues = _a.issues;
    if (valid) {
        console.log("✅ Email configuration is valid");
    }
    else {
        console.warn("\n📧 EMAIL CONFIGURATION ISSUES:\n");
        issues.forEach(function (issue) { return console.warn("  ".concat(issue)); });
        console.warn("\n");
    }
}
