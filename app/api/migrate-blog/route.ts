import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { savePostToDB } from '@/lib/blog-db'

export async function GET() {
  try {
    const postsDirectory = path.join(process.cwd(), 'content', 'blog')
    const fileNames = fs.readdirSync(postsDirectory)

    const results = []

    for (const fileName of fileNames) {
      if (!fileName.endsWith('.md')) continue

      const slug = fileName.replace(/\.md$/, '')
      const fullPath = path.join(postsDirectory, fileName)
      const fileContents = fs.readFileSync(fullPath, 'utf8')

      const matterResult = matter(fileContents)

      const post = {
        slug: slug,
        title: matterResult.data.title || '',
        meta_description: matterResult.data.meta_description || '',
        focus_keyword: matterResult.data.focus_keyword || '',
        content: matterResult.content,
      }

      await savePostToDB(post)
      results.push(`Migrado: ${slug}`)
    }

    return NextResponse.json({ success: true, message: "¡Todos los artículos se migraron correctamente!", results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
