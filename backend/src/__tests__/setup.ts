/**
 * Setup global de los tests.
 *
 * Fuerza variables de entorno ficticias ANTES de que se importe
 * `src/config.ts`, para que la suite sea hermética: no depende del
 * `.env` local ni intenta hablar con la Supabase real. El cliente de
 * Supabase se mockea en cada test que lo necesita.
 */
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.JWT_SECRET = 'test-jwt-secret-para-la-suite';
process.env.PORT = '3999';
