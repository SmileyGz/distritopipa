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
            <td align="center" style="padding: 32px 20px; background-color: #151515; border-top: 1px solid #333333;">
              <h1 style="margin: 0 0 8px 0; font-family: 'Bebas Neue', sans-serif; font-size: 28px; letter-spacing: 2px; color: #DC143C; text-transform: uppercase;">
                DISTRITO <span style="color: #FFFFFF; font-family: 'Times New Roman', serif; font-style: italic; text-transform: none; font-size: 30px;">Pipa</span>
              </h1>
              <p style="margin: 0; color: #888888; font-size: 12px; line-height: 1.4;">
                <strong>Distrito Pipa Cancún</strong><br>
                La opción local de confianza · Entregas rápidas y seguras
              </p>

              <!-- Social Links -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 20px 0 10px 0;">
                <tr>
                  <td align="center">
                    <a href="https://www.facebook.com/distritopipacancun/" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 7px 16px; margin: 0 5px; background-color: #242424; border: 1px solid #383838; border-radius: 20px; color: #FFFFFF; font-size: 12px; font-weight: 600; text-decoration: none; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                      <span style="color: #DC143C; font-size: 12px; margin-right: 5px;">●</span>Facebook
                    </a>
                    <a href="https://www.instagram.com/distritopipa/" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 7px 16px; margin: 0 5px; background-color: #242424; border: 1px solid #383838; border-radius: 20px; color: #FFFFFF; font-size: 12px; font-weight: 600; text-decoration: none; font-family: 'Inter', Helvetica, Arial, sans-serif;">
                      <span style="color: #DC143C; font-size: 12px; margin-right: 5px;">●</span>Instagram
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 4px 0 0 0; color: #666666; font-size: 11px;">
                Síguenos para ver restocks, dinámicas y entregas del día en Cancún
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

export interface OrderItem {
  title?: string;
  name?: string;
  quantity: number;
  price: number;
  bundle_price?: number;
  total_price?: number;
}

export interface OrderSummaryParams {
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  anticipoPaid?: number;
}

export function renderOrderSummaryHtml({ items, subtotal, deliveryFee, total, anticipoPaid = 0 }: OrderSummaryParams): string {
  const pendingBalance = total - anticipoPaid;
  const isFullyPaid = anticipoPaid >= total && total > 0;

  // Calculate sum of base unit prices to see if any promo discount was applied
  const regularItemsSum = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const promoDiscount = Math.max(0, regularItemsSum - subtotal);
  
  const itemsHtml = items.map(item => {
    const lineTotal = item.total_price ?? item.bundle_price ?? (item.price * item.quantity);
    const standardTotal = item.price * item.quantity;
    const hasDiscount = (item.bundle_price !== undefined && item.bundle_price < standardTotal) || (lineTotal < standardTotal);

    return `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #333333; color: #E0E0E0;">
        ${item.title || item.name || 'Producto'} <span style="color: #888888;">x${item.quantity}</span>
        ${hasDiscount ? `<div style="font-size: 11px; color: #4CAF50; margin-top: 2px;">⚡ Promo aplicada</div>` : ''}
      </td>
      <td align="right" style="padding: 10px 0; border-bottom: 1px solid #333333; color: #E0E0E0;">
        ${hasDiscount ? `<span style="text-decoration: line-through; color: #777777; font-size: 12px; margin-right: 6px;">$${standardTotal.toFixed(2)}</span>` : ''}
        <span style="color: ${hasDiscount ? '#4CAF50' : '#E0E0E0'}; font-weight: ${hasDiscount ? '600' : 'normal'};">$${lineTotal.toFixed(2)}</span>
      </td>
    </tr>
  `}).join('');

  return `
    <div style="margin: 30px 0; background-color: #222222; border-radius: 8px; padding: 20px;">
      <h3 style="margin: 0 0 15px 0; color: #FFFFFF; font-size: 16px; border-bottom: 1px solid #444444; padding-bottom: 10px;">Resumen de tu pedido</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        ${itemsHtml}
        ${promoDiscount > 0 ? `
        <tr>
          <td style="padding: 8px 0 2px 0; color: #777777; text-decoration: line-through; font-size: 13px;">Subtotal base</td>
          <td align="right" style="padding: 8px 0 2px 0; color: #777777; text-decoration: line-through; font-size: 13px;">$${regularItemsSum.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 2px 0 6px 0; color: #4CAF50; font-size: 13px;">Descuento Promoción</td>
          <td align="right" style="padding: 2px 0 6px 0; color: #4CAF50; font-weight: 600; font-size: 13px;">-$${promoDiscount.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 10px 0 5px 0; color: #AAAAAA;">Subtotal</td>
          <td align="right" style="padding: 10px 0 5px 0; color: #AAAAAA;">$${subtotal.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0 15px 0; color: #AAAAAA; border-bottom: 1px solid #444444;">Envío</td>
          <td align="right" style="padding: 5px 0 15px 0; color: #AAAAAA; border-bottom: 1px solid #444444;">$${deliveryFee.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 15px 0 5px 0; color: #FFFFFF; font-weight: bold;">Total</td>
          <td align="right" style="padding: 15px 0 5px 0; color: #FFFFFF; font-weight: bold;">$${total.toFixed(2)}</td>
        </tr>
        ${anticipoPaid > 0 ? `
        <tr>
          <td style="padding: 5px 0; color: #4CAF50;">Anticipo / Pagado</td>
          <td align="right" style="padding: 5px 0; color: #4CAF50;">-$${anticipoPaid.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 15px 0 0 0; color: ${isFullyPaid ? '#4CAF50' : '#DC143C'}; font-weight: bold; font-size: 16px;">
            ${isFullyPaid ? 'PAGO 100% CUBIERTO' : 'SALDO PENDIENTE'}
          </td>
          <td align="right" style="padding: 15px 0 0 0; color: ${isFullyPaid ? '#4CAF50' : '#DC143C'}; font-weight: bold; font-size: 16px;">
            $${Math.max(0, pendingBalance).toFixed(2)}
          </td>
        </tr>
        ` : ''}
      </table>
    </div>
  `;
}

export interface CancellationEmailParams {
  orderNumber: string
  customerName: string
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  reason?: string
}

export function renderCancellationEmailHtml({
  orderNumber,
  customerName,
  items,
  subtotal,
  deliveryFee,
  total,
  reason
}: CancellationEmailParams): string {
  const shortName = customerName ? customerName.split(' ')[0] : 'amigo'

  const reasonNotice = reason ? `
    <div style="margin: 18px 0; background-color: #222222; border-left: 3px solid #f87171; padding: 12px 16px; border-radius: 0 6px 6px 0;">
      <p style="margin: 0; color: #fca5a5; font-size: 13px;">
        <strong>Motivo:</strong> ${reason}
      </p>
    </div>
  ` : ''

  const orderSummaryHtml = renderOrderSummaryHtml({
    items,
    subtotal,
    deliveryFee,
    total,
    anticipoPaid: 0
  })

  const content = `
    <p>¡Qué onda <strong>${shortName}</strong>! Todo bien por acá.</p>
    
    <p>Te escribimos para avisarte que, como no registramos el anticipo de tu pedido <strong>${orderNumber}</strong>, tuvimos que cancelar el apartado en el sistema.</p>
    
    ${reasonNotice}

    <p>Entendemos al 100% que a veces la semana se complica, salen imprevistos o simplemente cambian los planes. <strong>¡Cero broncas con nosotros!</strong></p>
    
    <p>Para no dejar el material congelado y darle oportunidad a <strong>otros vecinos de Cancún que andan buscando estas piezas hoy mismo</strong>, regresamos los artículos a nuestro catálogo disponible.</p>
    
    ${orderSummaryHtml}

    <div style="margin: 28px 0; background-color: #222222; border-left: 4px solid #DC143C; padding: 16px 20px; border-radius: 0 8px 8px 0;">
      <p style="margin: 0; color: #FFFFFF; font-size: 14px; font-weight: 600;">La puerta sigue abierta cuando tú quieras 🤝</p>
      <p style="margin: 6px 0 0 0; color: #AAAAAA; font-size: 13px; line-height: 1.5;">
        Cuando andes listo para estrenar o caiga la quincena, date una vuelta por el catálogo. Aquí te atendemos con el mismo gusto de siempre.
      </p>
    </div>

    <div style="margin: 30px 0; text-align: center;">
      <a href="https://www.distritopipa.com/catalogo" 
         style="background-color: #DC143C; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 15px; letter-spacing: 0.5px;">
        Ver Catálogo Disponible
      </a>
    </div>

    <p style="font-size: 13px; color: #888888; margin-top: 30px; border-top: 1px solid #333333; padding-top: 16px; line-height: 1.5;">
      <em>¿Hiciste tu transferencia hace un momento y se cruzaron los mensajes? Cero estrés: tiranos un WhatsApp con tu captura de pago y con gusto reactivamos tu paquete de inmediato.</em>
    </p>

    <p style="margin-top: 20px;">¡Un abrazo y seguimos activos en Cancún!</p>
  `

  return getBrandedEmailHtml('Liberamos tus piezas', content)
}
