import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

export type BlogPost = {
  id: string
  slug: string
  title: string
  meta_description: string
  focus_keyword: string
  content: string
  published_at: string
}

export async function getPostsFromDB() {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('published_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching posts:', error)
    return []
  }
  return data as BlogPost[]
}

export async function getPostFromDB(slug: string) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single()
    
  if (error) {
    console.error('Error fetching post:', error)
    return null
  }
  return data as BlogPost
}

export async function savePostToDB(post: Partial<BlogPost>) {
  const { data, error } = await supabase
    .from('blog_posts')
    .upsert(post, { onConflict: 'slug' })
    .select()
    .single()
    
  if (error) {
    throw new Error(error.message)
  }
  return data
}
