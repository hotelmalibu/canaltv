# Despliegue a la nube

Esta guía te lleva desde el código local hasta una URL pública con HTTPS.

## 1. Subir a GitHub

1. Crea un repositorio nuevo en https://github.com (privado si lo prefieres).
2. En tu PC, dentro de la carpeta `hotel-tv`:

```bash
git config --local user.name "Tu Nombre"
git config --local user.email "tu@correo.com"
git remote add origin https://github.com/TU_USUARIO/hotel-tv.git
git push -u origin main
```

## 2. Desplegar en Render (lo más simple)

1. Entra a https://render.com y crea cuenta (puedes entrar con GitHub).
2. **New → Web Service** → conecta el repositorio `hotel-tv`.
3. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment (variables):**
     - `JWT_SECRET` = una clave larga y aleatoria
     - `ADMIN_PASSWORD` = la contraseña inicial del panel
     - `PORT` = `3000`
4. Pulsa **Deploy**. Render te da una URL tipo `https://hotel-tv.onrender.com`.

Luego:
- Panel admin: `https://tu-app.onrender.com/admin/`
- Pantalla TV: `https://tu-app.onrender.com/tv/`
- Pon esa URL `.../tv/` en la constante `TV_URL` de la app Android TV y vuelve a compilar el APK.

### Datos y videos: Neon (PostgreSQL)

El disco de Render (plan gratis) es **efímero**, así que el contenido NO se guarda ahí. El Channel Manager guarda
todo en PostgreSQL: secciones, ítems, usuarios **y los videos/imágenes subidos** (tabla `files`).

1. Crea un proyecto en https://neon.tech y copia su cadena de conexión (`postgresql://...?sslmode=require`).
2. En Render → servicio → **Environment**, añade `DATABASE_URL` con esa cadena.
3. Redespliega. Al arrancar crea las tablas y, si la base está vacía, el contenido de ejemplo.

Límites del plan gratis de Neon: 0,5 GB en total. Por eso cada archivo admite hasta `MAX_FILE_MB` (100 MB) y el
total hasta `MAX_STORAGE_MB` (350 MB); pasado eso la subida se rechaza con un mensaje claro. Los archivos que ya
ningún ítem usa se borran solos (con una hora de gracia).

## 3. Alternativa: Railway

https://railway.app funciona igual (conecta el repo, `npm install` / `npm start`, variables).
Railway incluye un volumen persistente sencillo, buena opción para el MVP con videos.

## 4. Domino propio y HTTPS

- Render y Railway ya dan **HTTPS** automático.
- Si quieres tu propio dominio (`hotel-tv.com`), añádelo en el panel y apunta el DNS
  (registro CNAME/ALIAS) a la URL que te indiquen.

## Nota sobre el modo kiosco en los TV

Para que la app arranque sola y no se pueda salir (modo kiosco completo), configura en cada
TV la app **"Hotel TV" como launcher por defecto**, o usa un *launcher* de kiosco de Android TV.
