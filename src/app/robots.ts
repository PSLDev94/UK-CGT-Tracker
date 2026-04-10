import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.cgttracker.co.uk'

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/guide', '/pricing', '/signup', '/login'],
      disallow: ['/dashboard/', '/api/', '/_next/', '/auth/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
