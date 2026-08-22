/**
 * Generates a VAPID key pair for Web Push.
 * Run with:  npm run vapid
 *
 * VAPID is how a push service (Google's FCM for Chrome, Apple's for
 * Safari) knows the push really came from this application. The
 * private key signs each request; the public key is embedded in the
 * client so the browser can bind its subscription to us.
 *
 * Generate ONCE. Changing the keys invalidates every subscription
 * already stored, and every device has to subscribe again.
 *
 * The private key is a credential. It belongs in Supabase secrets,
 * never in the repository and never in a VITE_ variable.
 */
import { generateKeyPairSync } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // P-256, the only curve Web Push allows
})

const pub = publicKey.export({ format: 'jwk' })
const priv = privateKey.export({ format: 'jwk' })

const b64 = (value) => Buffer.from(value, 'base64url')

// The public key goes on the wire as an uncompressed EC point:
// a 0x04 marker followed by the X and Y coordinates.
const raw = Buffer.concat([Buffer.from([0x04]), b64(pub.x), b64(pub.y)])

console.log(`
VAPID keys generated. Store these now — they are not recoverable.

  Public key  (safe in the browser, goes in .env and Vercel):
  ${raw.toString('base64url')}

  Private key (SECRET — Supabase secret only, never committed):
  ${priv.d}

Next:
  1. Add to .env and to Vercel:
     VITE_VAPID_PUBLIC_KEY=${raw.toString('base64url')}

  2. Set the Supabase secrets (see README, "Alerts when the app is closed"):
     VAPID_PUBLIC_KEY   = the public key above
     VAPID_PRIVATE_KEY  = the private key above
     VAPID_SUBJECT      = mailto:someone@davric.com
`)
