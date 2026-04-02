export function buildEmail(options: {
  workspaceName?: string;
  workspaceLogoUrl?: string | null;
  brandColor?: string | null;
  preheader?: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerText?: string;
}): string {
  const {
    workspaceName,
    workspaceLogoUrl,
    brandColor,
    preheader,
    heading,
    body,
    ctaLabel,
    ctaUrl,
    footerText,
  } = options;

  const preheaderHtml = preheader
    ? '<div style="display:none;font-size:1px;color:#0a0a0b;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">' + preheader + '</div>'
    : '';

  const ctaBackground = brandColor
    ? 'background-color:' + brandColor + ';'
    : 'background:linear-gradient(135deg,#f97316,#ec4899);';

  const ctaHtml = ctaLabel && ctaUrl
    ? '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:32px 0 8px 0;">'
      + '<tr><td align="center">'
      + '<a href="' + ctaUrl + '" target="_blank" style="display:inline-block;' + ctaBackground + 'color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:15px;font-family:Arial,sans-serif;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:22pt">&nbsp;</i><![endif]-->' + ctaLabel + '<!--[if mso]><i style="mso-font-width:150%">&nbsp;</i><![endif]--></a>'
      + '</td></tr></table>'
    : '';

  const trakalogLogoUrl = 'https://app.trakalog.com/trakalog-logo.png';

  const footerLogo = workspaceLogoUrl
    ? '<tr><td align="center" style="padding:0 0 8px 0;"><img src="' + workspaceLogoUrl + '" alt="" style="max-height:24px;display:block;margin:0 auto;" /></td></tr>'
    : '';

  const footerLine = footerText || 'Sent via Trakalog';

  return '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'
    + '<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" />'
    + '<title>' + heading + '</title>'
    + '<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700&display=swap" rel="stylesheet" />'
    + '<!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->'
    + '</head>'
    + '<body style="margin:0;padding:0;background-color:#0a0a0b;font-family:Arial,sans-serif;">'
    + preheaderHtml
    // Outer wrapper table
    + '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#0a0a0b;">'
    + '<tr><td align="center" style="padding:40px 16px;">'
    // Card table
    + '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%;background-color:#141416;border:1px solid rgba(255,255,255,0.06);border-radius:16px;">'
    // Header
    + '<tr><td align="center" style="padding:32px 32px 0 32px;">'
    + '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">'
    + '<tr><td align="center" style="padding:0;">'
    + '<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>'
    + '<td style="vertical-align:middle;padding-right:12px;"><img src="' + trakalogLogoUrl + '" alt="Trakalog" style="height:32px;display:block;" /></td>'
    + '<td style="vertical-align:middle;font-family:\'Sora\',Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;letter-spacing:4px;line-height:1;">'
    + '<span style="color:#f97316;">T</span>'
    + '<span style="color:#f97316;">R</span>'
    + '<span style="color:#ea580c;">A</span>'
    + '<span style="color:#db2777;">K</span>'
    + '<span style="color:#c026d3;">A</span>'
    + '<span style="color:#a855f7;">L</span>'
    + '<span style="color:#8b5cf6;">O</span>'
    + '<span style="color:#7c3aed;">G</span>'
    + '</td>'
    + '</tr></table>'
    + '</td></tr>'
    + '<tr><td align="center" style="padding:6px 0 0 0;font-family:\'Sora\',Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:#71717a;text-transform:uppercase;">CATALOG MANAGER</td></tr>'
    + '</table>'
    + '</td></tr>'
    // Gradient separator
    + '<tr><td style="padding:20px 32px 0 32px;">'
    + '<div style="height:1px;background:linear-gradient(90deg,#f97316,#ec4899,#8b5cf6);"></div>'
    + '</td></tr>'
    // Content
    + '<tr><td style="padding:28px 32px 0 32px;">'
    + '<h1 style="margin:0 0 20px 0;font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff;">' + heading + '</h1>'
    + '<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#a1a1aa;">' + body + '</div>'
    + ctaHtml
    + '</td></tr>'
    // Footer separator
    + '<tr><td style="padding:28px 32px 0 32px;">'
    + '<div style="height:1px;background-color:rgba(255,255,255,0.06);"></div>'
    + '</td></tr>'
    // Footer
    + '<tr><td style="padding:20px 32px 28px 32px;">'
    + '<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">'
    + footerLogo
    + '<tr><td align="center" style="font-family:Arial,sans-serif;font-size:12px;color:#52525b;">' + footerLine + '</td></tr>'
    + '</table>'
    + '</td></tr>'
    + '</table>'
    // End card
    + '</td></tr></table>'
    + '</body></html>';
}
