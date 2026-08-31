/**
 * Tests the SMTP settings the way Supabase uses them.
 * Run with:  npm run test:smtp
 *
 * Supabase reports every mail failure as the same opaque
 * "Error sending recovery email", which cannot distinguish a wrong
 * password from a rejected certificate from a blocked port. This does
 * the conversation step by step and says which one failed.
 *
 * Reads from .env, so the password stays on this machine:
 *
 *   SMTP_HOST=business16.web-hosting.com
 *   SMTP_PORT=465
 *   SMTP_USER=dev@davricgroup.com
 *   SMTP_PASS=the mailbox password
 *   SMTP_FROM=dev@davricgroup.com
 *   SMTP_TO=where to send the test message
 */
import net from 'node:net'
import tls from 'node:tls'

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT ?? 465)
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS
const from = process.env.SMTP_FROM ?? user
const to = process.env.SMTP_TO ?? process.env.TEST_ADMIN_EMAIL

const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(
  (k) => !process.env[k],
)
if (missing.length) {
  console.error('Add these to .env first:\n  ' + missing.join('\n  '))
  process.exit(1)
}

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

function talk(socket) {
  let buffer = ''
  const waiters = []

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    // A reply is complete when a line reads "NNN " rather than "NNN-".
    const done = /^\d{3} [^\n]*\r?\n$|\n\d{3} [^\n]*\r?\n$/.test(buffer)
    if (done && waiters.length) {
      const reply = buffer
      buffer = ''
      waiters.shift()(reply.trim())
    }
  })

  return {
    read: () => new Promise((resolve) => waiters.push(resolve)),
    send: (line, hide) => {
      console.log(`  > ${hide ? '<hidden>' : line}`)
      socket.write(line + '\r\n')
    },
  }
}

const step = (label) => console.log(`\n${label}`)

const socket =
  port === 465
    ? tls.connect({ host, port, servername: host })
    : net.connect({ host, port })

socket.setTimeout(30000)
socket.on('timeout', () => {
  console.error('\nTimed out. The port is filtered, or the server is not answering.')
  process.exit(1)
})
socket.on('error', (err) => {
  console.error(`\nConnection failed: ${err.code} ${err.message}`)
  if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    console.error(
      'The certificate does not cover this hostname. Use the name the\n' +
        'certificate is issued for -- on shared hosting that is the server\n' +
        'name, not your own domain.',
    )
  }
  process.exit(1)
})

socket.on('secureConnect', () => {
  console.log(`TLS established, certificate ${socket.authorized ? 'VALID' : 'REJECTED'}`)
  if (!socket.authorized) console.log(`  ${socket.authorizationError}`)
})

const io = talk(socket)

console.log(`Connecting to ${host}:${port}${port === 465 ? ' (implicit TLS)' : ''}`)

step('1. greeting')
let reply = await io.read()
console.log('  < ' + reply.split('\n')[0])
if (!reply.startsWith('220')) {
  console.error('\nThe server refused the connection.')
  process.exit(1)
}

step('2. EHLO')
io.send('EHLO test.local')
reply = await io.read()
console.log('  < ' + reply.replace(/\n/g, '\n  < '))

if (port !== 465 && /STARTTLS/i.test(reply)) {
  step('3. STARTTLS')
  io.send('STARTTLS')
  reply = await io.read()
  console.log('  < ' + reply)
  console.error(
    '\nThis script only completes the handshake on port 465.\n' +
      'Set SMTP_PORT=465 to test authentication.',
  )
  process.exit(1)
}

if (!/AUTH[ =]/i.test(reply)) {
  console.error('\nThe server is not offering AUTH on this port.')
  console.error('Authentication is usually only offered over TLS -- try port 465.')
  process.exit(1)
}

step('4. AUTH LOGIN')
io.send('AUTH LOGIN')
reply = await io.read()
console.log('  < ' + reply)

io.send(b64(user), true)
reply = await io.read()
console.log('  < ' + reply)

io.send(b64(pass), true)
reply = await io.read()
console.log('  < ' + reply)

if (reply.startsWith('535') || reply.startsWith('5')) {
  console.error('\nAUTHENTICATION REJECTED.')
  console.error('The username or password is wrong. On cPanel mail the username')
  console.error('is the full address, and the password is the mailbox password,')
  console.error('not the cPanel account password.')
  process.exit(1)
}
if (!reply.startsWith('235')) {
  console.error('\nUnexpected reply to authentication.')
  process.exit(1)
}
console.log('  authentication ACCEPTED')

step('5. send a test message')
io.send(`MAIL FROM:<${from}>`)
console.log('  < ' + (await io.read()))
io.send(`RCPT TO:<${to}>`)
reply = await io.read()
console.log('  < ' + reply)
if (reply.startsWith('5')) {
  console.error('\nThe recipient was rejected.')
  process.exit(1)
}

io.send('DATA')
console.log('  < ' + (await io.read()))
socket.write(
  [
    `From: Davric VMS <${from}>`,
    `To: <${to}>`,
    'Subject: SMTP test from the visitor system',
    '',
    'If you are reading this, Supabase can send password reset emails.',
    '.',
    '',
  ].join('\r\n'),
)
reply = await io.read()
console.log('  < ' + reply)

io.send('QUIT')
socket.end()

console.log(`\nSENT. Check ${to}, including the spam folder.`)
console.log('If this worked but Supabase still fails, the settings saved in')
console.log('Supabase differ from what is in .env -- compare them field by field.')
