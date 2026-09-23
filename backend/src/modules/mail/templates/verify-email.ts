export function verifyEmailTemplate(data: {
  firstName: string;
  otp: string;
  verifyUrl?: string;
}): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f7f8f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr><td style="background:#0C66E4;padding:24px;text-align:center;border-radius:12px 12px 0 0;">
          <strong style="color:#fff;font-size:22px;letter-spacing:-0.5px;">Connect</strong>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#172B4D;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${data.firstName},</p>
          <p style="color:#172B4D;font-size:15px;line-height:1.6;margin:0 0 20px;">Here is your 6-digit verification code to activate your workspace:</p>
          
          <div style="background:#F4F5F7;border:1px solid #DFE1E6;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
            <div style="font-family:monospace,Consolas,'Courier New',Courier;font-size:36px;font-weight:700;letter-spacing:10px;color:#0C66E4;padding-left:10px;">
              ${data.otp}
            </div>
            <p style="margin:8px 0 0;font-size:12px;color:#626F86;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Verification Code</p>
          </div>

          <p style="color:#626F86;font-size:14px;margin:20px 0 8px;">Enter this code on the verification screen. This code is valid for <strong>10 minutes</strong>.</p>
          
          ${
            data.verifyUrl
              ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #EBECF0;text-align:center;">
                  <p style="color:#626F86;font-size:13px;margin-bottom:12px;">Or click the direct verification button:</p>
                  <a href="${data.verifyUrl}" style="display:inline-block;background:#0C66E4;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Verify directly</a>
                </div>`
              : ''
          }
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `Hi ${data.firstName},\n\nYour Connect verification code is: ${data.otp}\n\nThis code is valid for 10 minutes.\n\n${data.verifyUrl ? `Or verify directly: ${data.verifyUrl}` : ''}`;
  return { html, text };
}
