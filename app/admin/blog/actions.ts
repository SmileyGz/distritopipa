'use server'

import { savePostToDB } from '@/lib/blog-db'

export async function savePostAction(post: any) {
  try {
    const data = await savePostToDB(post)
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
