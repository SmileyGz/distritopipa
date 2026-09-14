'use server'

import { revalidatePath } from 'next/cache'
import { savePostToDB } from '@/lib/blog-db'

export async function savePostAction(post: any) {
  try {
    const data = await savePostToDB(post)
    if (post.slug) {
      revalidatePath(`/blog/${post.slug}`)
    }
    revalidatePath('/blog')
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
