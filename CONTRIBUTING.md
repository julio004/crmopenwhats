# Guía de Contribución

¡Gracias por tu interés en contribuir a este proyecto! Todas las contribuciones, reportes de bugs, correcciones y nuevas funcionalidades son bienvenidas.

## ¿Cómo contribuir?

1. **Haz un Fork del repositorio**
   Haz click en el botón de "Fork" en la parte superior derecha de esta página para crear una copia del repositorio en tu propia cuenta.

2. **Clona tu Fork localmente**
   ```bash
   git clone https://github.com/TU_USUARIO/bot-personal.git
   cd bot-personal
   ```

3. **Crea una nueva rama (Branch)**
   Usa un nombre descriptivo para tu rama.
   ```bash
   git checkout -b feature/nueva-funcionalidad
   # o
   git checkout -b fix/correccion-de-bug
   ```

4. **Haz tus cambios**
   Asegúrate de que tus cambios sigan las convenciones del código del proyecto (puedes revisar el archivo `tsconfig.json` y configuraciones de linters).
   Si estás agregando nuevas características, por favor incluye tests que cubran tus casos de uso.

5. **Haz Commit de tus cambios**
   ```bash
   git commit -m "feat: agrega nueva funcionalidad de X"
   ```
   *Nota: Preferimos el uso de Conventional Commits (feat, fix, docs, chore, etc).*

6. **Haz Push a tu rama**
   ```bash
   git push origin feature/nueva-funcionalidad
   ```

7. **Abre un Pull Request (PR)**
   Ve al repositorio original y abre un Pull Request desde tu rama hacia nuestra rama principal (`main`). 
   Proporciona una descripción clara de lo que hace tu PR y menciona cualquier Issue relacionado.

## Reporte de Bugs

Si encuentras un error, por favor abre un **Issue** describiendo:
* Pasos para reproducirlo.
* Comportamiento esperado vs comportamiento actual.
* Información de tu entorno (Sistema Operativo, versión de Node.js, etc).

## Configuración del entorno de desarrollo local

Este proyecto usa Node.js (v20+) y npm/yarn. 

Para instalar las dependencias y ejecutar localmente:
```bash
npm install
npm run dev
```

¡Apreciamos tu esfuerzo para hacer de este proyecto algo mejor para la comunidad!
