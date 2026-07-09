import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const contentDirectory = path.join(process.cwd(), 'content/blog');

export type PostData = {
  slug: string;
  title: string;
  meta_description: string;
  focus_keyword: string;
  content: string;
};

export function getSortedPostsData(): PostData[] {
  // Get file names under /content/blog
  let fileNames: string[] = [];
  try {
    fileNames = fs.readdirSync(contentDirectory);
  } catch (error) {
    console.error('Could not read content directory', error);
    return [];
  }
  
  const allPostsData = fileNames
    .filter(fileName => fileName.endsWith('.md'))
    .map((fileName) => {
      // Remove ".md" from file name to get slug
      const slug = fileName.replace(/\.md$/, '');

      // Read markdown file as string
      const fullPath = path.join(contentDirectory, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');

      // Use gray-matter to parse the post metadata section
      const matterResult = matter(fileContents);

      // Combine the data with the id
      return {
        slug,
        title: matterResult.data.title || slug,
        meta_description: matterResult.data.meta_description || '',
        focus_keyword: matterResult.data.focus_keyword || '',
        content: matterResult.content,
      };
    });

  // Since we don't have dates, we'll just return them sorted alphabetically by slug for now
  return allPostsData.sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

export function getPostData(slug: string): PostData | null {
  const fullPath = path.join(contentDirectory, `${slug}.md`);
  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const matterResult = matter(fileContents);

    return {
      slug,
      title: matterResult.data.title || slug,
      meta_description: matterResult.data.meta_description || '',
      focus_keyword: matterResult.data.focus_keyword || '',
      content: matterResult.content,
    };
  } catch (error) {
    console.error(`Error reading markdown file for slug: ${slug}`, error);
    return null;
  }
}
