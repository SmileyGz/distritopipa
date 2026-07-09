'use server'

import { revalidatePath } from 'next/cache'

// A mock server action since we don't have Supabase fully configured with live keys.
// This executes on the server to prevent clients from bypassing the moderation regex.

export async function submitPost(formData: FormData) {
  const content = formData.get('content') as string
  
  if (!content || content.trim() === '') {
    return { error: "El mensaje no puede estar vacío." }
  }

  // 1. MODERATION: Block > 2 numbers (Anti-Phone-Number / Scam protection)
  // This regex matches any string that contains 3 or more digits anywhere.
  const threeOrMoreDigits = /\d.*\d.*\d/
  if (threeOrMoreDigits.test(content)) {
    return { 
      error: "¡Ups! Por tu seguridad y la de todos, no permitimos compartir teléfonos ni contactos aquí. Borra los números para poder publicar." 
    }
  }

  // 2. MODERATION: Block bad words
  const badWords = ['puto', 'pendejo', 'mierda', 'verga', 'droga', 'dealer']
  const badWordsRegex = new RegExp(`\\b(${badWords.join('|')})\\b`, 'i')
  
  if (badWordsRegex.test(content)) {
    return { 
      error: "Tu mensaje contiene lenguaje no permitido en El Barrio." 
    }
  }

  // 3. MOCK DATABASE INSERT
  // In a real scenario: await supabase.from('questions').insert({ content, author_id: user.id })
  
  console.log('Post submitted successfully to Supabase:', content)
  
  // Revalidate the page so the new post shows up
  revalidatePath('/el-barrio')
  
  return { success: true }
}
