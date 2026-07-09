import { Product } from './supabase'

export const mockProducts = [
  // Strip 1: Pipas y Burbujas
  {
    id: '1', slug: 'burbuja-xs', name_es: 'Burbuja XS', name_en: 'Bubble XS',
    description_es: 'Pipa de cristal pequeña', description_en: 'Small glass pipe',
    price_mxn: 49, category: 'pipes', in_stock: true, featured: true, sort_order: 1,
    bundle_pricing: [{ qty: 2, price: 89 }, { qty: 3, price: 119 }], size_cm: 10,
    image_paths: ['burbuja-xs.png']
  },
  {
    id: '2', slug: 'sencilla', name_es: 'Sencilla (M, G)', name_en: 'Simple Pipe',
    description_es: 'Pipa clásica', description_en: 'Classic pipe',
    price_mxn: 69, category: 'pipes', in_stock: true, featured: true, sort_order: 2,
    bundle_pricing: [{ qty: 2, price: 119 }, { qty: 3, price: 169 }], size_cm: 10,
    image_paths: ['sencilla.png']
  },
  {
    id: '3', slug: 'reforzada', name_es: 'Reforzada', name_en: 'Reinforced',
    description_es: 'Gruesa y duradera', description_en: 'Thick and durable',
    price_mxn: 99, category: 'pipes', in_stock: true, featured: true, sort_order: 3,
    bundle_pricing: [{ qty: 2, price: 180 }, { qty: 3, price: 250 }], size_cm: 10,
    image_paths: ['reforzada.png']
  },
  {
    id: '4', slug: 'colores', name_es: 'Pipa Colores', name_en: 'Colored Pipe',
    description_es: 'Verde, Amarilla, Negra, Azul', description_en: 'Colors',
    price_mxn: 149, category: 'pipes', in_stock: true, featured: false, sort_order: 4,
    bundle_pricing: [{ qty: 2, price: 199 }, { qty: 3, price: 259 }], size_cm: 10,
    image_paths: ['colores.png']
  },
  {
    id: '5', slug: 'calavera', name_es: 'Calavera Reforzada', name_en: 'Skull Pipe',
    description_es: 'Forma de calavera', description_en: 'Skull shape',
    price_mxn: 199, category: 'pipes', in_stock: true, featured: false, sort_order: 5,
    bundle_pricing: [{ qty: 2, price: 350 }], size_cm: 12,
    image_paths: ['calavera.png']
  },
  
  // Accesorios
  {
    id: '6', slug: 'llavero', name_es: 'Llavero Cenicero', name_en: 'Ashtray Keychain',
    description_es: 'Acero Inoxidable', description_en: 'Stainless steel',
    price_mxn: 119, category: 'accessories', in_stock: true, featured: false, sort_order: 6, size_cm: 5,
    image_paths: ['llavero.png']
  },
  {
    id: '7', slug: 'herramienta', name_es: 'Herramienta 3 en 1', name_en: '3 in 1 Tool',
    description_es: 'Metálica', description_en: 'Metal tool',
    price_mxn: 119, category: 'accessories', in_stock: true, featured: false, sort_order: 7, size_cm: 9,
    image_paths: ['herramienta.png']
  },
  {
    id: '8', slug: 'grinder', name_es: 'Grinder Metálico', name_en: 'Metal Grinder',
    description_es: 'Triturador CH', description_en: 'Grinder',
    price_mxn: 149, category: 'accessories', in_stock: true, featured: true, sort_order: 8,
    image_paths: ['grinder.png']
  },

  // Rolling / Para forjar
  {
    id: '9', slug: 'canalas', name_es: 'Canalas / Sábanas', name_en: 'Rolling Papers',
    description_es: '50 filtros, 50 hojas', description_en: 'Papers & filters',
    price_mxn: 99, category: 'rolling', in_stock: true, featured: false, sort_order: 9,
    image_paths: ['canalas.png']
  },

  // Sopletes
  {
    id: '10', slug: 'soplete', name_es: 'Soplete', name_en: 'Torch',
    description_es: 'Soplete grande', description_en: 'Large torch',
    price_mxn: 149, category: 'torches', in_stock: true, featured: false, sort_order: 10,
    image_paths: ['soplete.png']
  },
  
  // Repuestos
  {
    id: '11', slug: 'repuestos', name_es: 'Repuestos Varios', name_en: 'Replacement Parts',
    description_es: 'Cualquier modelo', description_en: 'Any model',
    price_mxn: 139, category: 'parts', in_stock: true, featured: false, sort_order: 11,
    bundle_pricing: [{ qty: 2, price: 240 }, { qty: 3, price: 330 }],
    image_paths: ['repuestos.png']
  },
  {
    id: '12', slug: 'filtros', name_es: 'Filtros Metálicos', name_en: 'Silver Screens',
    description_es: 'Paquete de filtros', description_en: 'Screens',
    price_mxn: 10, category: 'parts', in_stock: true, featured: false, sort_order: 12,
    bundle_pricing: [{ qty: 5, price: 10 }, { qty: 10, price: 18 }, { qty: 15, price: 25 }],
    image_paths: ['filtros.png']
  },

  // Bongs
  {
    id: '13', slug: 'bong-reforzado', name_es: 'Bong Reforzado', name_en: 'Reinforced Bong',
    description_es: 'Cristal grueso 18cm', description_en: 'Thick glass',
    price_mxn: 420, category: 'bongs', in_stock: true, featured: true, sort_order: 13, size_cm: 18,
    image_paths: ['bong-reforzado.png']
  },
  {
    id: '14', slug: 'bong-20cm', name_es: 'Bong 20cm', name_en: 'Bong 20cm',
    description_es: 'Cristal', description_en: 'Glass',
    price_mxn: 520, category: 'bongs', in_stock: true, featured: false, sort_order: 14, size_cm: 20,
    image_paths: ['bong-20cm.png']
  }
] as Product[]
