export function getBrandedEmailHtml(title: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1A; font-family: 'Inter', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #1A1A1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #2A2A2A; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 30px 20px; border-bottom: 2px solid #DC143C;">
              <img src="https://www.distritopipa.com/icon.png" alt="Distrito Pipa Logo" width="64" height="64" style="display: block; border-radius: 8px;">
            </td>
          </tr>

          <!-- Content Title -->
          <tr>
            <td style="padding: 30px 40px 10px 40px;">
              <h2 style="margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700;">${title}</h2>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 10px 40px 40px 40px; color: #E0E0E0; font-size: 15px; line-height: 1.6;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 30px 20px; background-color: #151515; border-top: 1px solid #333333;">
              <h1 style="margin: 0 0 10px 0; font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; color: #DC143C; text-transform: uppercase;">
                DISTRITO <span style="color: #FFFFFF; font-family: 'Times New Roman', serif; font-style: italic; text-transform: none; font-size: 30px;">Pipa</span>
              </h1>
              <p style="margin: 0; color: #888888; font-size: 12px;">
                <strong>Distrito Pipa Cancún</strong><br>
                La opción local de confianza. Entregas rápidas y seguras.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
