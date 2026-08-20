// Smoke test SMS auth module: verify endpoint reachability & error mapping (no real SMS sent).
import { sendSmsCode, smsLogin, isValidMobile } from '../out/auth/sms.js';

// 1. mobile validation
console.log('valid mobile 13800138000:', isValidMobile('13800138000'));
console.log('invalid mobile 12345:', isValidMobile('12345'));

// 2. sendSmsCode with a test number → expect clean error (1204 手机号无效), proving the endpoint is alive
try {
  await sendSmsCode('13800138000');
  console.log('UNEXPECTED: send succeeded');
} catch (e) {
  console.log('✔ sendSmsCode →', e.message.slice(0, 80), '(code', e.code + ')');
}

// 3. smsLogin with bogus code → expect clean error (1203/1204), proving login endpoint alive
try {
  await smsLogin('13800138000', '1234', 'mobile_ticket_test');
  console.log('UNEXPECTED: login succeeded');
} catch (e) {
  console.log('✔ smsLogin →', e.message.slice(0, 80), '(code', e.code + ')');
}
