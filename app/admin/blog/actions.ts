'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { savePostToDB, deletePostFromDB } from '@/lib/blog-db'
import { ADMIN_COOKIE_NAME, isValidAdminToken } from '@/lib/auth'

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value
  return isValidAdminToken(token)
}

export async function savePostAction(post: any) {
  try {
    if (!await verifyAdmin()) {
      return { success: false, error: 'No autorizado' }
    }

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

export async function deletePostAction(slug: string) {
  try {
    if (!await verifyAdmin()) {
      return { success: false, error: 'No autorizado' }
    }

    await deletePostFromDB(slug)
    revalidatePath('/blog')
    revalidatePath(`/blog/${slug}`)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
