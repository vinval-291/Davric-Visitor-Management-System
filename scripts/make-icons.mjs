/**
 * Generates the installable-app icons from the official logo.
 * Run with:  npm run icons
 *
 * Two shapes are needed, and they are not interchangeable:
 *
 *   "any"      the icon as drawn, used on iOS and on desktop
 *   "maskable" Android may crop this to a circle, squircle or
 *              rounded square depending on the launcher, so the
 *              artwork must sit inside a safe zone of roughly the
 *              middle 80%. Ship only an "any" icon and Android
 *              letterboxes it inside a white blob.
 *
 * The logo is wide and has a transparent background with black
 * lettering, so every icon is composited onto white. On a dark home
 * screen a transparent version would lose the words entirely.
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SOURCE = 'public/davric-logo.webp'
const OUT = 'public/icons'

/**
 * Only the D mark is used, not the full wordmark.
 *
 * The logo is 320x144 -- more than twice as wide as it is tall. Fitted
 * into a square icon it renders at roughly a third of the available
 * height, and "GROUP OF COMPANIES" becomes an illegible smudge at the
 * ~60px a phone home screen actually shows. The D in its tilted square
 * is the distinctive part of the mark and is close to square already,
 * so it fills the icon and stays recognisable when small.
 *
 * Region located by scanning the artwork for the grey square outline.
 */
const MARK = { left: 10, top: 26, width: 104, height: 92 }

// size, filename, how much of the width the logo may occupy
const ICONS = [
  [192, 'icon-192.png', 0.78],
  [512, 'icon-512.png', 0.78],
  [192, 'maskable-192.png', 0.56],
  [512, 'maskable-512.png', 0.56],
  [180, 'apple-touch-icon.png', 0.76],
  [32, 'favicon-32.png', 0.88],
]

await mkdir(OUT, { recursive: true })

for (const [size, name, scale] of ICONS) {
  const logoWidth = Math.round(size * scale)

  const logo = await sharp(SOURCE)
    .extract(MARK)
    .resize({ width: logoWidth, fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  const { height: logoHeight } = await sharp(logo).metadata()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      {
        input: logo,
        top: Math.round((size - logoHeight) / 2),
        left: Math.round((size - logoWidth) / 2),
      },
    ])
    .png()
    .toFile(`${OUT}/${name}`)

  console.log(`  ${name.padEnd(24)} ${size}x${size}`)
}

console.log(`\n${ICONS.length} icons written to ${OUT}/`)
