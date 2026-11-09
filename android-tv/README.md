# App Android TV (APK)

App nativa para Android TV que muestra la pantalla TV del proyecto en modo kiosco
(no sale de la app y evita que la pantalla se apague).

## Cómo compilarla

1. Instala **Android Studio** (https://developer.android.com/studio).
2. Abre la carpeta `android-tv/` como proyecto.
3. Cambia la URL en `app/src/main/java/com/hotel/tv/MainActivity.kt` (constante `TV_URL`):
   - **Emulador de Android:** `http://10.0.2.2:3000/tv/`
   - **TV real en tu red local:** `http://IP_DE_TU_PC:3000/tv/`
   - **Producción:** `https://tu-dominio.com/tv/`
4. Compila: **Build → Generate Signed Bundle / APK → APK**.
5. Instala el APK en cada televisor (por USB o con `adb install`).

## Notas

- Requiere Android 7.0 (API 24) o superior.
- El botón **Atrás** del control cierra el reproductor de video pero nunca cierra la app.
- Para un "modo kiosco" total (bloquear el botón Home), usa un *launcher* de kiosco
  en el TV o configura la app como launcher por defecto.
