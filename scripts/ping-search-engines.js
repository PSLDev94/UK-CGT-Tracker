const SITEMAP_URL = 'https://www.cgttracker.com/sitemap.xml'

if (process.env.VERCEL_ENV === 'production') {
  Promise.all([
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`),
  ])
    .then(() => console.log('✓ Pinged Google and Bing with sitemap'))
    .catch((err) => console.warn('⚠ Sitemap ping failed (non-blocking):', err.message))
} else {
  console.log('Skipping sitemap ping (not production)')
}
