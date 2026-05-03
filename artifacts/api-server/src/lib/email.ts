import { db } from "@workspace/db";
import { systemConfigTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";

const EMAIL_KEYS = [
  "email_enabled",
  "email_api_key",
  "email_sender_name",
  "email_sender_address",
  "email_reply_to",
];

async function getEmailConfig(): Promise<Record<string, string | null>> {
  const rows = await db.select().from(systemConfigTable).where(inArray(systemConfigTable.key, EMAIL_KEYS));
  const cfg: Record<string, string | null> = {};
  for (const key of EMAIL_KEYS) cfg[key] = rows.find(r => r.key === key)?.value ?? null;
  return cfg;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const cfg = await getEmailConfig();
    if (cfg.email_enabled !== "true") return false;
    if (!cfg.email_api_key || !cfg.email_sender_address) return false;

    const from = cfg.email_sender_name
      ? `${cfg.email_sender_name} <${cfg.email_sender_address}>`
      : cfg.email_sender_address;

    const payload = {
      from,
      to: [opts.to],
      ...(cfg.email_reply_to ? { reply_to: cfg.email_reply_to } : {}),
      subject: opts.subject,
      html: opts.html,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.email_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, "Email send failed");
      return false;
    }

    return true;
  } catch (err) {
    logger.warn({ err }, "Email send error");
    return false;
  }
}

export function buildInviteEmail(opts: {
  candidateName: string;
  companyName: string;
  processTitle: string;
  inviteLink: string;
  estimatedMinutes?: number;
}): string {
  const { candidateName, companyName, processTitle, inviteLink, estimatedMinutes = 30 } = opts;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0;font-weight:700;">HireForward</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">AI-Conducted Interview Platform</p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">Hello, ${candidateName}!</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong>${companyName}</strong> has invited you to complete an AI-conducted interview for the <strong>${processTitle}</strong> position.
      </p>
      <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:24px;">
        <p style="color:#475569;font-size:14px;margin:0 0 4px;"><strong>Estimated duration:</strong> ~${estimatedMinutes} minutes</p>
        <p style="color:#475569;font-size:14px;margin:0;">Complete at your own pace — the link is available for 72 hours.</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${inviteLink}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          Start Interview →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
        Or copy this link: <span style="font-family:monospace;word-break:break-all;">${inviteLink}</span>
      </p>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:24px 0 0;">
      Powered by HireForward &mdash; AI-native recruitment platform
    </p>
  </div>
</body>
</html>`;
}

export function buildEvaluationReadyEmail(opts: {
  hrEmail: string;
  candidateName: string;
  processTitle: string;
  overallScore: number;
  recommendation: string;
  candidateReportUrl: string;
  companyName: string;
}): string {
  const { candidateName, processTitle, overallScore, recommendation, candidateReportUrl, companyName } = opts;
  const scoreColor = overallScore >= 80 ? "#16a34a" : overallScore >= 60 ? "#d97706" : "#dc2626";
  const recColor = recommendation.toLowerCase().includes("advance") || recommendation.toLowerCase().includes("hire")
    ? "#16a34a" : "#dc2626";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:#1e293b;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
      <h1 style="color:#fff;font-size:24px;margin:0;font-weight:700;">HireForward</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">Evaluation Ready</p>
    </div>
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
      <h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">New evaluation available</h2>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        <strong>${candidateName}</strong> has completed the AI interview for <strong>${processTitle}</strong> at ${companyName}.
      </p>
      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin-bottom:24px;display:flex;gap:24px;justify-content:center;text-align:center;">
        <div>
          <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Overall Score</p>
          <p style="color:${scoreColor};font-size:36px;font-weight:700;margin:0;">${overallScore}</p>
        </div>
        <div style="border-left:1px solid #e2e8f0;margin:4px 0;"></div>
        <div>
          <p style="color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Recommendation</p>
          <p style="color:${recColor};font-size:16px;font-weight:600;margin:0;">${recommendation}</p>
        </div>
      </div>
      <div style="text-align:center;">
        <a href="${candidateReportUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
          View Full Report →
        </a>
      </div>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:24px 0 0;">
      Powered by HireForward &mdash; AI-native recruitment platform
    </p>
  </div>
</body>
</html>`;
}
