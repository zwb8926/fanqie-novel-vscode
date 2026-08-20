// Smoke test the QR login module: expect graceful multi-strategy failure from datacenter IP,
// and correct behavior of the import-cookies path with bogus cookies.
import { startQrLogin, importCookiesLogin, logout } from '../out/auth/qr.js';

// 1. startQrLogin should try all strategies and throw a descriptive error (sso blocked from this IP)
try {
  const ticket = await startQrLogin(s => console.log('  status:', s.stage, '|', s.message.slice(0, 60)));
  console.log('UNEXPECTED: got ticket', ticket.strategy, ticket.qrUrl);
} catch (e) {
  console.log('✔ startQrLogin threw as expected:', e.message.slice(0, 120));
}

// 2. importCookiesLogin with bogus cookies should fail with clear message
try {
  await importCookiesLogin('sessionid=invalid123; tt_scid=abc');
  console.log('UNEXPECTED: import succeeded');
} catch (e) {
  console.log('✔ importCookiesLogin rejected bogus cookies:', e.message.slice(0, 80));
}

// 3. logout clears jar
await logout();
console.log('✔ logout ok');
