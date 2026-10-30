/**
 * Crea el PRIMER super administrador.
 * Uso: define SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en .env y ejecuta
 *      npm run create-superadmin
 */
import 'dotenv/config';
import { supabase } from '../src/lib/supabase.js';

const { SUPERADMIN_EMAIL: email, SUPERADMIN_PASSWORD: password, SUPERADMIN_NAME: name = 'Super Admin' } = process.env;
if (!email || !password) { console.error('Falta SUPERADMIN_EMAIL o SUPERADMIN_PASSWORD en .env'); process.exit(1); }

const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) { console.error('❌', error.message); process.exit(1); }

const { error: pe } = await supabase.from('profiles').insert({ id: data.user.id, full_name: name, role: 'super_admin' });
if (pe) { console.error('❌', pe.message); process.exit(1); }
console.log(`✅ Super admin creado: ${email}`);
