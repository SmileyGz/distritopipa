const BLACKLIST = [
  'pipa', 'bong', 'humo', 'tabaco', 'sábanas', 'forros', 
  'vaporizador', 'vape', 'grinder', 'weed', 'foco', 'bombilla'
];

const SALES_TERMS = [
  'precio', 'venta', 'compra', 'dm para comprar', 'cómpralo aquí'
];

export interface ComplianceResult {
  isValid: boolean;
  errors: string | null;
  warnings: string | null;
  ctaMissing: string | null;
}

export function scanCopy(text: string | null | undefined): ComplianceResult {
  if (!text) {
    return { isValid: true, errors: null, warnings: null, ctaMissing: null };
  }

  const lowerText = text.toLowerCase();
  
  // 1. Hard Blocks (Errors)
  const foundBlacklist = BLACKLIST.filter(word => lowerText.includes(word));
  
  // 2. Warnings (Soft Blocks)
  const foundSalesTerms = SALES_TERMS.filter(word => lowerText.includes(word));
  
  // 3. CTA Checker
  const hasBridge = lowerText.includes('distritopipa.com') || lowerText.includes('link en bio') || lowerText.includes('link de nuestra bio');

  return {
    isValid: foundBlacklist.length === 0,
    errors: foundBlacklist.length > 0 
      ? `🚨 ELIMINAR INMEDIATAMENTE: Contiene palabras prohibidas (${foundBlacklist.join(', ')})` 
      : null,
    warnings: foundSalesTerms.length > 0
      ? `⚠️ AVISO: Evita términos de venta directa (${foundSalesTerms.join(', ')}). Usa llamados a la acción hacia la web.`
      : null,
    ctaMissing: !hasBridge 
      ? `🔗 FALTA CTA: Agrega 'distritopipa.com' o 'link en bio' para dirigir el tráfico de forma segura.` 
      : null
  };
}
