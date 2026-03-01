# Integración de Forge API para Procesamiento de Imágenes

Este documento explica cómo integrar el procesamiento de imágenes con Forge API en el repositorio `anclora-turnos-sebas`.

## Descripción General

Se ha agregado soporte para procesar calendarios de turnos usando **Forge API con visión multimodal** (modelo: `gemini-2.5-flash`).

El flujo es:
1. Usuario sube imagen de calendario
2. Frontend envía imagen al backend
3. Backend procesa con Forge API (sin exponer token)
4. Retorna turnos extraídos
5. Frontend muestra previsualización interactiva

## Archivos Agregados

- `src/lib/forge-shift-parser.ts` - Cliente para llamar al backend
- `src/components/shift-dashboard/ShiftPreview.tsx` - Componente de previsualización
- `backend-setup.md` - Guía de implementación del backend
- `FORGE_INTEGRATION.md` - Este archivo

## Configuración del Backend

### Requisitos

- Node.js 18+
- Express.js
- Acceso a Forge API (token `BUILT_IN_FORGE_API_KEY`)

### Pasos de Implementación

1. **Crea un servidor backend** (si no tienes uno):
   ```bash
   mkdir backend
   cd backend
   npm init -y
   npm install express multer axios dotenv
   ```

2. **Configura variables de entorno** (`.env`):
   ```env
   BUILT_IN_FORGE_API_KEY=your_token_here
   BUILT_IN_FORGE_API_URL=https://forge.manus.ai
   LLM_MODEL=gemini-2.5-flash
   PORT=3000
   ```

3. **Implementa el endpoint** (ver `backend-setup.md` para código completo):
   - `POST /api/shifts/extract-forge` - Procesa imagen
   - `GET /api/shifts/health` - Verifica disponibilidad

4. **Inicia el servidor**:
   ```bash
   npm run dev
   ```

## Uso en el Frontend

### Importar el servicio

```typescript
import { parseCalendarWithForge, checkForgeAvailable } from '../lib/forge-shift-parser';
import { ShiftPreview } from './ShiftPreview';
```

### Procesar imagen

```typescript
const handleProcessImage = async (file: File, month: number, year: number) => {
  try {
    const shifts = await parseCalendarWithForge(file, month, year);
    setExtractedShifts(shifts);
  } catch (error) {
    console.error('Error:', error);
  }
};
```

### Mostrar previsualización

```tsx
<ShiftPreview 
  shifts={extractedShifts}
  onRemove={(idx) => setExtractedShifts(prev => prev.filter((_, i) => i !== idx))}
/>
```

## Comparación: Ollama vs Forge

| Aspecto | Ollama (Local) | Forge (Cloud) |
|--------|----------------|---------------|
| Instalación | Requiere Ollama local | Solo token |
| Velocidad | Depende del hardware | Rápido y consistente |
| Precisión | Variable (modelo local) | Alta (gemini-2.5-flash) |
| Costo | Gratis | Según uso |
| Privacidad | Local | Cloud |
| Configuración | Compleja | Simple |

## Estructura de Respuesta

```json
{
  "shifts": [
    {
      "day": 1,
      "month": 3,
      "year": 2026,
      "shiftType": "Regular",
      "startTime": "17:00",
      "endTime": "01:00",
      "color": "blue",
      "notes": ""
    },
    {
      "day": 4,
      "month": 3,
      "year": 2026,
      "shiftType": "Libre",
      "startTime": null,
      "endTime": null,
      "color": "red",
      "notes": "TD"
    }
  ]
}
```

## Características

✅ Extrae turnos de imágenes de calendario  
✅ Soporta días del mes anterior/siguiente  
✅ Filtra días vacíos automáticamente  
✅ Previsualización interactiva  
✅ Edición de turnos antes de guardar  
✅ Token seguro (no expuesto en cliente)  
✅ Fallback a Ollama si está disponible  

## Troubleshooting

### Error: "Failed to extract shifts"
- Verifica que el backend está corriendo
- Comprueba que `BUILT_IN_FORGE_API_KEY` es válido
- Revisa logs del servidor

### Error: "No shifts found"
- La imagen puede no ser un calendario válido
- Intenta con una imagen más clara
- Verifica que el mes/año son correctos

### Timeout
- Aumenta el timeout en el cliente
- Verifica conexión a internet
- Comprueba que Forge API está disponible

## Próximos Pasos

1. Implementar persistencia de turnos en BD
2. Agregar exportación a Excel/JSON
3. Integrar con calendario visual
4. Agregar validación de conflictos de turnos

## Documentación Adicional

- `backend-setup.md` - Guía completa de implementación del backend
- `src/lib/forge-shift-parser.ts` - Código del cliente
- `src/components/shift-dashboard/ShiftPreview.tsx` - Componente de previsualización
