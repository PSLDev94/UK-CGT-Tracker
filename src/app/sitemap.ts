import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.cgttracker.com'

  const staticRoutes: MetadataRoute.Sitemap = [
    // Homepage
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Guide index
    {
      url: `${baseUrl}/guide`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // Guide sub-pages
    ...[
      'section-104-pool',
      'bed-and-breakfast-rule',
      'cgt-rates-2025-26',
      'sa108-how-to-fill-in',
      'trading-212-cgt',
      'hargreaves-lansdown-cgt',
      'freetrade-cgt',
    ].map((slug) => ({
      url: `${baseUrl}/guide/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // Free tools
    ...[
      'bed-and-breakfast-calculator',
      'section-104-calculator',
      'cgt-allowance-checker',
    ].map((slug) => ({
      url: `${baseUrl}/tools/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // Core pages
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  return staticRoutes
}
