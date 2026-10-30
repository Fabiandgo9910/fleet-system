# Sistema de Gestión de Flota (PWA) — Guía completa

Web instalable (PWA) en **Next.js** + API **Node/Express + Socket.IO** + base de datos **Supabase**.
Dos proyectos independientes: `frontend/` (Vercel) y `backend/` (Render).

```
fleet-system/
├── database/schema.sql     ← tablas, seguridad (RLS) y funciones atómicas
├── backend/                ← API REST + tiempo real + WhatsApp + notificaciones push
│   ├── .env.example        ← TODAS las variables del backend
│   └── src/config/review.config.js   ← tiempo y enlace de la reseña
└── frontend/               ← Next.js (PWA)
    ├── .env.example        ← TODAS las variables del frontend
    └── src/config/brand.config.js    ← logo, nombre, descripción, color
```

## 1. Arquitectura y decisiones

| Decisión | Motivo |
|---|---|
| **Monolito modular** en el backend (no microservicios) | Para una flota pequeña/mediana, microservicios añaden coste y complejidad sin beneficio. El código está separado por módulos (`routes/`, `services/`, `jobs/`, `realtime/`) y se puede extraer cualquiera (p. ej. `jobs/reviewScheduler.js`) cuando el volumen lo justifique. |
| El navegador **nunca** toca las tablas de Supabase | RLS activado sin políticas: la clave pública no puede leer nada. Todo pasa por el backend, que valida rol y datos. La clave `service_role` solo vive en el backend. |
| Login con **Supabase Auth**, permisos en el backend | El JWT se verifica en cada petición y en cada conexión Socket.IO. Roles: `super_admin`, `admin`, `driver`, `client`. |
| Operaciones críticas en **funciones SQL** | Cerrar un servicio (estado + stock + efectivo + viejas) ocurre en una sola transacción: no puede quedar a medias. |
| Tiempo real: **Socket.IO** + **Web Push** | Socket.IO actualiza listas al instante con la app abierta. Web Push avisa aunque la PWA esté cerrada. |
| Reseñas por WhatsApp desde la **BD** | El planificador consulta la BD cada 30 s; si el servidor se duerme o reinicia no se pierde ningún envío. |
| Optimización de rutas | "Vecino más cercano" desde la posición del conductor, abierto en Google Maps (hasta 9 paradas intermedias). Es una buena aproximación, no un óptimo matemático. |

**Seguridad incluida:** Helmet, CORS cerrado a tus dominios, rate limit, validación con Zod, cuerpos limitados, JWT en HTTP y WebSocket, RLS, cabeceras de seguridad en Next, usuarios desactivables al instante.

## 2. Requisitos

- Node.js 20 o superior · Git · cuenta de GitHub
- Cuentas: **Supabase**, **Render**, **Vercel**, **Google Cloud**, (opcional) **Meta for Developers**, **UptimeRobot**

## 3. Paso a paso

### Paso 1 — Supabase (base de datos)
1. supabase.com → *New project*. Guarda la contraseña de la BD y elige región cercana.
2. *SQL Editor → New query* → pega **todo** `database/schema.sql` → *Run*.
3. *Project Settings → API*: copia **Project URL**, **anon public** y **service_role** (secreta).
4. *Authentication → Providers → Email*: desactiva *Allow new users to sign up* (los usuarios los crea el super admin).

> Los proyectos gratuitos de Supabase se **pausan tras ~1 semana sin actividad**. Con uso diario no pasa; si el servicio es esporádico, considera el plan de pago.

### Paso 2 — Claves VAPID (notificaciones push)
```bash
cd backend && npm install && npm run generate-vapid
```
Guarda *Public Key* (frontend y backend) y *Private Key* (solo backend).

### Paso 3 — Google Maps
1. console.cloud.google.com → crea un proyecto y **activa facturación** (Google exige tarjeta; tiene cuota gratuita mensual, revisa los límites vigentes y pon una alerta de presupuesto).
2. *APIs y servicios → Biblioteca*: habilita **Maps JavaScript API** y **Places API (New)**.
3. *Credenciales → Crear clave de API*. Restringe: *Aplicaciones web* con referentes `http://localhost:3000/*` y `https://tu-dominio.vercel.app/*`; y solo esas 2 APIs.
4. (Opcional) *Map Management → Map ID* para estilos propios; si no, deja `DEMO_MAP_ID`.

### Paso 4 — Probar en local
**Backend**
```bash
cd backend
cp .env.example .env        # rellena SUPABASE_*, VAPID_*, SUPERADMIN_*
npm install
npm run create-superadmin   # crea el primer super admin
npm run dev                 # http://localhost:4000/health
```
**Frontend**
```bash
cd frontend
cp .env.example .env.local  # rellena SUPABASE, API_URL, MAPS, VAPID_PUBLIC
npm install
npm run dev                 # http://localhost:3000
```
Entra con el super admin → *Usuarios* → crea un administrador y un conductor.
Con `WHATSAPP_PROVIDER=log` los mensajes de reseña solo se escriben en la consola del backend.

### Paso 5 — Subir a GitHub
Un repositorio con las carpetas `frontend/` y `backend/` (monorepo) sirve para ambos despliegues.
Los `.gitignore` ya excluyen `.env`. **Nunca subas claves.**

### Paso 6 — Desplegar el backend en Render (gratis, con WebSockets)
1. render.com → *New → Web Service* → conecta el repo.
2. **Root Directory:** `backend` · **Build:** `npm install` · **Start:** `npm start` · **Instance:** Free.
   (Alternativa: *New → Blueprint* y usa `backend/render.yaml`.)
3. *Environment*: pega todas las variables de `backend/.env.example` con valores reales (sin `SUPERADMIN_*`). Pon `NODE_ENV=production` y por ahora `ALLOWED_ORIGINS=http://localhost:3000`.
4. *Health Check Path:* `/health`. Despliega y copia la URL (`https://xxx.onrender.com`).

> **Importante:** el plan gratuito de Render **se duerme tras 15 min sin tráfico** y tarda ~30–60 s en despertar. En un servicio con conductores esperando avisos eso es un problema (y se detiene el planificador de reseñas). Solución gratuita: **UptimeRobot** → *Add monitor* → HTTP(s) → `https://xxx.onrender.com/health` cada 5 min. Para producción real con clientes, el plan de pago de Render (o similar) es lo recomendable.

### Paso 7 — Desplegar el frontend en Vercel
1. vercel.com → *Add New → Project* → importa el repo.
2. **Root Directory:** `frontend` (framework Next.js, detectado solo).
3. *Environment Variables*: todas las de `frontend/.env.example`, con `NEXT_PUBLIC_API_URL=https://xxx.onrender.com`.
4. *Deploy*. Obtendrás `https://tu-app.vercel.app`.
5. Vuelve a Render → `ALLOWED_ORIGINS=https://tu-app.vercel.app` (si tienes dominio propio, añádelo separado por coma) → guarda (reinicia solo).
6. Añade esa URL a los referentes permitidos de la clave de Google Maps.

> El plan *Hobby* de Vercel es para uso personal/no comercial. Para un cliente que paga, usa el plan Pro.

### Paso 8 — Instalar la PWA
- **Android/Chrome:** menú ⋮ → *Instalar aplicación*.
- **iPhone/Safari:** Compartir → *Añadir a pantalla de inicio* (las notificaciones push en iOS solo funcionan con la app instalada, iOS 16.4+).
- Dentro de la app, la campana 🔔 → *Activar avisos aunque la app esté cerrada* (una vez por dispositivo).

### Paso 9 — WhatsApp para reseñas (opcional pero recomendado)
1. developers.facebook.com → crea una app tipo *Business* → añade **WhatsApp**.
2. Registra tu número de WhatsApp Business y crea un **token permanente** (usuario del sistema).
3. *Plantillas de mensaje*: crea `solicitud_resena` (idioma `es`) con 2 variables:
   `Hola {{1}}, gracias por confiar en nosotros. ¿Nos dejas una reseña? {{2}}`
   Meta debe aprobarla (suele clasificarla como *marketing*, que se cobra por conversación; revisa tarifas).
4. En Render: `WHATSAPP_PROVIDER=cloud_api`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `REVIEW_URL` (enlace directo de reseña de Google), `REVIEW_DELAY_MINUTES=10`.

## 4. Personalizar para un cliente nuevo
Todo se cambia con variables (sin tocar código):

| Qué | Dónde |
|---|---|
| Nombre, descripción, logo, color, moneda, idioma | `NEXT_PUBLIC_COMPANY_*`, `NEXT_PUBLIC_LOGO_URL`, `NEXT_PUBLIC_PRIMARY_COLOR` (Vercel) · también `frontend/src/config/brand.config.js` |
| Iconos de la app instalada | Reemplaza `frontend/public/icons/` (192, 512 y maskable 512 px) |
| Tiempo y enlace de reseña | `REVIEW_DELAY_MINUTES`, `REVIEW_URL` (Render) · `backend/src/config/review.config.js` |
| País/prefijo telefónico y sugerencias de direcciones | `DEFAULT_COUNTRY_CODE`, `NEXT_PUBLIC_MAPS_COUNTRY`, `NEXT_PUBLIC_MAP_DEFAULT_LAT/LNG` |
| Orígenes permitidos, límites | `ALLOWED_ORIGINS`, `RATE_LIMIT_MAX` |

Flujo recomendado: **un proyecto Supabase + un backend Render + un frontend Vercel por cliente**, todos desde el mismo repositorio.

## 5. Cómo funciona cada pieza del negocio

- **Crear servicio (admin):** la dirección se elige en un desplegable de Google; el **cliente se crea/actualiza solo** (clave: teléfono). Puedes asignar conductor al crear (le llega notificación) y/o **sumar baterías a su stock**.
- **Estados:** Creado → Asignado → Aceptado → Finalizado con éxito / fallido; Cancelado.
- **Conductor:** solo ve sus servicios; acepta; "Cómo llegar" abre Google Maps; con 2+ aceptados aparece **"Ruta más corta"**.
- **Cerrar servicio:** obligatorio indicar efectivo y tarjeta (puede ser 0). Si es con éxito: stock −1, efectivo acumulado + importe en efectivo, baterías viejas + 1 si la recogió. Hay confirmación con resumen antes de guardar.
- **Admin → Conductores:** ve stock, efectivo y viejas de cada uno; **"Recibir efectivo"** registra la entrega y reinicia a 0 (queda historial en `cash_settlements`).
- **Informes:** por fechas y conductor (cobrado en efectivo/tarjeta, baterías vendidas, viejas, éxitos/fallidos) con detalle de servicios por conductor.
- **Reseña:** 10 min (configurable) después de finalizar con éxito se envía el WhatsApp; hasta 3 reintentos si falla.
- **Usuarios:** solo el super admin crea usuarios, cambia roles, desactiva y restablece contraseñas.
- **Rol "client":** puede iniciar sesión y ve en lectura los servicios cuyo teléfono coincide con el de su perfil.

## 6. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| El frontend dice "Error de red" | `NEXT_PUBLIC_API_URL` mal, o `ALLOWED_ORIGINS` no incluye la URL exacta de Vercel (sin `/` final). |
| Backend no arranca | Falta una variable obligatoria: el log indica cuál. |
| Primera carga muy lenta | Render gratuito dormido: configura UptimeRobot. |
| No salen sugerencias de direcciones | Falta habilitar **Places API (New)**, restricción de referente incorrecta o facturación sin activar. |
| No llegan push | Hay que pulsar *Activar avisos* en cada dispositivo; en iPhone, instalar la PWA antes; comprobar claves VAPID (pública igual en ambos lados). |
| El WhatsApp no sale | `WHATSAPP_PROVIDER` sigue en `log`, plantilla sin aprobar o nombre/idioma distintos. El error queda en `services.review_error`. |
| Actualicé la app y no cambia | Cierra y abre la PWA; si persiste, cambia `VERSION` en `frontend/public/sw.js`. |

## 7. Límites conocidos y mejoras sugeridas
- Un solo proceso backend: para varias instancias hay que añadir el adaptador Redis de Socket.IO y bloquear el planificador de reseñas.
- El stock puede quedar negativo si el admin olvida cargarlo (la pantalla lo marca en rojo); se puede bloquear en `finish_service` si lo prefieres.
- No hay seguimiento GPS en vivo de conductores (solo ubicación de servicios).
- El código está en JavaScript con comentarios; migrar a TypeScript es directo si el equipo lo prefiere.
- Antes de producción: prueba el flujo completo con 2 móviles, revisa los límites vigentes de cada plan gratuito y activa copias de seguridad en Supabase.
