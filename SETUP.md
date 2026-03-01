# Setup y Desarrollo - Anclora Turnos Sebas

## Requisitos

- Node.js 18+
- npm o yarn

## Instalación

1. **Clonar repositorio**
```bash
git clone https://github.com/ToniIAPro73/anclora-turnos-sebas.git
cd anclora-turnos-sebas
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env y agregar token de Forge API
# BUILT_IN_FORGE_API_KEY=your_token_here
# BUILT_IN_FORGE_API_URL=https://forge.manus.ai
```

## Desarrollo

### Opción 1: Ejecutar solo frontend (Vite)
```bash
npm run dev
```
- Frontend disponible en: http://localhost:5173
- Requiere que el servidor backend esté corriendo en otro terminal

### Opción 2: Ejecutar solo backend (Express)
```bash
npm run dev:server
```
- Backend disponible en: http://localhost:3001
- Endpoints:
  - `POST /api/shifts/extract-forge` - Procesar imagen con Forge
  - `POST /api/shifts/export-excel` - Exportar a Excel
  - `POST /api/shifts/export-json` - Exportar a JSON
  - `GET /api/shifts/health` - Health check

### Opción 3: Ejecutar ambos (recomendado)
```bash
npm run dev:all
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- El frontend usa proxy para `/api` → backend

## Estructura del Proyecto

```
anclora-turnos-sebas/
├── src/
│   ├── components/
│   │   └── shift-dashboard/
│   │       ├── ImportModal.tsx          # Modal con integración Forge
│   │       └── ShiftPreview.tsx         # Previsualización de turnos
│   ├── lib/
│   │   ├── forge-shift-parser.ts        # Cliente Forge API
│   │   ├── export-shifts.ts             # Cliente exportación
│   │   └── ...
│   └── main.tsx
├── server.mjs                           # Servidor Express
├── server-export.mjs                    # Módulo exportación
├── .env                                 # Variables de entorno
├── package.json
└── vite.config.ts
```

## Flujo de Uso

1. **Subir imagen** - Usuario selecciona imagen de calendario
2. **Elegir motor** - Forge API (cloud), Ollama (local), o Tesseract (OCR)
3. **Procesar** - Sistema extrae turnos usando el motor seleccionado
4. **Previsualizar** - Tabla interactiva muestra turnos extraídos
5. **Exportar** - Descargar Excel o JSON
6. **Confirmar** - Importar turnos a la aplicación

## Motores Disponibles

### Forge API (Cloud) ✅ RECOMENDADO
- **Modelo**: gemini-2.5-flash
- **Precisión**: Alta
- **Velocidad**: Rápida
- **Requisito**: Token BUILT_IN_FORGE_API_KEY
- **Ventajas**: Mejor precisión, sin instalación local

### Ollama (Local)
- **Modelo**: Qwen Vision (qwen2-vl, qwen3-vl)
- **Precisión**: Media
- **Velocidad**: Depende del hardware
- **Requisito**: Ollama instalado localmente
- **Ventajas**: Privacidad, sin costo

### Tesseract OCR
- **Tipo**: OCR tradicional
- **Precisión**: Baja (solo texto)
- **Velocidad**: Rápida
- **Requisito**: Ninguno (incluido en navegador)
- **Ventajas**: Fallback simple

## Exportación

### Excel
- Tabla de calendario con 7 columnas (Lunes-Domingo)
- Incluye días del mes anterior/siguiente
- Colores según tipo de turno
- Formato: `turnos-YYYY-MM.xlsx`

### JSON
- Estructura de datos completa
- Incluye: día, mes, año, tipo, horarios, notas, color
- Formato: `turnos.json`

## Troubleshooting

### Error: "BUILT_IN_FORGE_API_KEY is not set"
- Verificar que `.env` existe
- Verificar que `BUILT_IN_FORGE_API_KEY` está configurado
- Reiniciar servidor: `npm run dev:server`

### Error: "Failed to extract shifts"
- Verificar que la imagen es un calendario válido
- Intentar con imagen más clara
- Cambiar a otro motor (Ollama o Tesseract)

### Timeout en procesamiento
- Aumentar timeout en cliente
- Verificar conexión a internet
- Verificar que Forge API está disponible

## Desarrollo Adicional

### Agregar nuevo motor
1. Crear archivo `src/lib/nuevo-parser.ts`
2. Implementar función `parseCalendarWithNuevo()`
3. Agregar opción en `ImportModal.tsx`
4. Actualizar tipo `OcrEngine`

### Modificar formato Excel
- Editar `server-export.mjs` función `exportToExcel()`
- Cambiar estilos, colores, o estructura

### Agregar más formatos de exportación
1. Crear función en `server-export.mjs`
2. Agregar endpoint en `server.mjs`
3. Agregar cliente en `src/lib/export-shifts.ts`
4. Agregar botón en `ImportModal.tsx`

## Notas Importantes

- El token `BUILT_IN_FORGE_API_KEY` nunca se expone al cliente
- Las imágenes se procesan en el servidor, no en el cliente
- El proxy Vite redirige `/api` al servidor backend en desarrollo
- En producción, ambos (frontend y backend) se sirven desde el mismo servidor

## Documentación Relacionada

- `backend-setup.md` - Guía de implementación del backend
- `FORGE_INTEGRATION.md` - Integración de Forge API
- `README.md` - Descripción general del proyecto
