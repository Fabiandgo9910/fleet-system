'use client';
/** Cliente Supabase del navegador: SOLO se usa para iniciar sesión (clave anon). */
import { createClient } from '@supabase/supabase-js';
import { appConfig } from '@/config/brand.config';

export const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey);
