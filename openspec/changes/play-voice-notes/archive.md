# Archive: Escuchar Notas de Voz y Visualizar Imágenes en la App

## Completed Changes

1. **Descarga de Adjuntos Multimedia (Backend)**:
   - Se añadió e inyectó la dependencia `downloadMediaMessage` en `src/lib/baileys/client.ts`.
   - Se implementó la descarga física de audios e imágenes en el directorio `/public/media/` bajo el nombre `${whatsappMessageId}.${ext}`.
   - Se guarda la ruta física en los metadatos de base de datos (`metadata.mediaUrl`).

2. **Renderizado en Interfaz (Frontend)**:
   - Se modificó `MessageBubble.tsx` para renderizar un reproductor HTML5 `<audio>` cuando el tipo de mensaje es de audio.
   - Se renderiza la imagen adjunta a través del componente `<Image>` con zoom/apertura al hacer clic si el mensaje contiene una imagen.

## Verification
- Validado a nivel de UI en el dashboard.
- Módulos cubiertos con tests unitarios para verificar la descarga correcta y servir los audios con validaciones de seguridad de ruta.
