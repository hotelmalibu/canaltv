# Hotel TV

Aplicación de "canal de TV" para hoteles: contenido bajo demanda (programas, eventos,
menú de restaurante y videos de la región) para televisores Android TV, con panel web
de administración para el personal del hotel.

## Estructura

```
hotel-tv/
├── server/            # Backend Node.js (Express + SQLite nativo)
│   ├── index.js       # Punto de entrada
│   ├── db.js          # Base de datos y datos de ejemplo
│   ├── auth.js        # Contraseñas (scrypt) y tokens (JWT)
│   ├── middleware.js  # Autenticación de rutas
│   └── routes/        # API REST
├── public/
│   ├── admin/         # Panel web de administración
│   ├── tv/            # Pantalla para el televisor
│   └── uploads/       # Archivos multimedia subidos
└── android-tv/        # App Android TV (APK) — WebView de la pantalla TV
```

## Requisitos

- Node.js 22.5 o superior (usa el módulo `node:sqlite` integrado).

## Puesta en marcha (local)

```bash
npm install
npm start
```

- Pantalla TV: http://localhost:3000/tv/
- Panel admin: http://localhost:3000/admin/
- API: http://localhost:3000/api/

Usuario administrador inicial: `admin` / `hotel123` (cámbialo).

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores.
