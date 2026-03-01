# Documentación del Endpoint Público de Extracción de Turnos

## Descripción General

El endpoint `/api/public/shifts/extract` permite procesar imágenes o PDFs de calendarios de turnos mensuales y extraer automáticamente los datos de turnos. Utiliza OCR + IA para imágenes y procesamiento de PDF para archivos PDF.

**URL Base:** `https://3000-i6m0y9d08zi38wmzuibz5-f8d4e65e.us1.manus.computer`

**Endpoint:** `POST /api/public/shifts/extract`

---

## Autenticación

El endpoint requiere una **API key** para rate limiting y auditoría. La API key debe enviarse en el payload de la solicitud.

### Obtener una API Key

1. Contacta al administrador de la aplicación
2. Se generará una API key única para tu repositorio
3. Guarda la clave de forma segura (no la compartas públicamente)

---

## Solicitud (Request)

### Headers

```
Content-Type: application/json
```

### Body

```json
{
  "type": "image",
  "imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "month": 3,
  "year": 2026,
  "apiKey": "your_api_key_here"
}
```

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `type` | string | Sí | Tipo de archivo: `"image"` o `"pdf"` |
| `imageBase64` | string | Sí | Archivo codificado en base64 (imagen JPEG/PNG o PDF) |
| `month` | number | Sí | Mes del calendario (1-12) |
| `year` | number | Sí | Año del calendario (2000-2100) |
| `apiKey` | string | Sí | Tu API key para autenticación y rate limiting |

### Notas Importantes

- **Tamaño máximo:** El archivo base64 debe representar un archivo de al menos 100 bytes
- **Formatos soportados:**
  - Imágenes: JPEG, PNG, WebP
  - PDFs: PDF estándar (procesamiento con pdfplumber)
- **Diferencia en procesamiento:**
  - **Imágenes:** Los turnos que cruzan medianoche se mantienen en un solo día (ej: 19:00-03:00)
  - **PDFs:** Los turnos que cruzan medianoche se dividen en dos filas (ej: 19:00-00:00 + 00:00-03:00)

---

## Respuesta (Response)

### Respuesta Exitosa (200 OK)

```json
{
  "success": true,
  "data": {
    "shifts": [
      {
        "day": 1,
        "month": 3,
        "year": 2026,
        "shiftType": "Normal",
        "startTime": "08:00",
        "endTime": "16:00",
        "color": "blue"
      },
      {
        "day": 2,
        "month": 3,
        "year": 2026,
        "shiftType": "Libre",
        "startTime": null,
        "endTime": null,
        "color": "gray"
      }
    ],
    "metadata": {
      "type": "image",
      "month": 3,
      "year": 2026,
      "shiftsExtracted": 2,
      "processingTime": 1234,
      "credits": {
        "creditsBefore": 5000,
        "creditsAfter": 4950,
        "creditsDifference": 50,
        "costEur": 0.23,
        "costUsd": 0.25,
        "formattedEur": "€0.23",
        "formattedUsd": "$0.25"
      },
      "rateLimit": {
        "callsUsed": 1,
        "callsRemaining": 9,
        "monthlyLimit": 30,
        "resetDate": "2026-04-01T00:00:00.000Z"
      }
    }
  }
}
```

### Estructura de Turnos Extraídos

Cada turno contiene:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `day` | number | Día del mes (1-31) |
| `month` | number | Mes (1-12) |
| `year` | number | Año |
| `shiftType` | string | Tipo de turno: `"Normal"` o `"Libre"` |
| `startTime` | string \| null | Hora de inicio en formato HH:MM (ej: "08:00") |
| `endTime` | string \| null | Hora de fin en formato HH:MM (ej: "16:00") |
| `color` | string \| null | Color para visualización (ej: "blue", "red", "gray") |

### Información de Créditos

El endpoint retorna información detallada sobre el coste de procesamiento:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `creditsBefore` | number | Créditos disponibles antes del procesamiento |
| `creditsAfter` | number | Créditos disponibles después del procesamiento |
| `creditsDifference` | number | Créditos consumidos en esta llamada |
| `costEur` | number | Coste en euros (redondeado a 2 decimales) |
| `costUsd` | number | Coste en dólares (redondeado a 2 decimales) |
| `formattedEur` | string | Coste formateado con símbolo de euro |
| `formattedUsd` | string | Coste formateado con símbolo de dólar |

**Cálculo de costes:**
- Basado en planes de Manus: $20/mes = 4,000 créditos
- Precio por crédito: $0.005 USD = €0.0046 EUR
- Tasa de cambio: 1 USD = 0.92 EUR

### Información de Rate Limiting

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `callsUsed` | number | Número de llamadas realizadas este mes |
| `callsRemaining` | number | Número de llamadas disponibles hasta fin de mes |
| `monthlyLimit` | number | Límite total de llamadas por mes (default: 10) |
| `resetDate` | string | Fecha en que se reinicia el contador (ISO 8601) |

**Límites:**
- Máximo 30 llamadas por mes por API key (en modo testing, sin límite)
- El contador se reinicia el primer día de cada mes
- Si alcanzas el límite, recibirás un error 429

---

## Códigos de Error

### 400 - Bad Request

```json
{
  "success": false,
  "error": "Invalid request payload",
  "details": [
    {
      "code": "invalid_enum_value",
      "expected": "'image' | 'pdf'",
      "received": "'invalid'",
      "path": ["type"],
      "message": "Invalid enum value. Expected 'image' | 'pdf'"
    }
  ]
}
```

**Causas comunes:**
- `type` no es "image" o "pdf"
- `imageBase64` está vacío o no es válido
- `month` está fuera del rango 1-12
- `year` está fuera del rango 2000-2100

### 401 - Unauthorized

```json
{
  "success": false,
  "error": "Invalid or inactive API key"
}
```

**Causas:**
- API key no proporcionada
- API key inválida o no existe
- API key ha sido desactivada

### 429 - Too Many Requests

```json
{
  "success": false,
  "error": "Monthly API call limit exceeded",
  "callsUsed": 10,
  "monthlyLimit": 30,
  "resetDate": "2026-04-01T00:00:00.000Z"
}
```

**Causa:** Has excedido el límite de 30 llamadas por mes. El contador se reinicia el primer día del siguiente mes.

### 500 - Internal Server Error

```json
{
  "success": false,
  "error": "Error processing file",
  "details": "Error message from processing"
}
```

**Causas comunes:**
- El archivo base64 no es válido
- El archivo está corrupto
- Error durante el procesamiento OCR o PDF
- Problemas de conectividad con la API de Manus

---

## Ejemplos de Uso

### Ejemplo 1: Procesar una Imagen (JavaScript/Node.js)

```javascript
const fs = require('fs');

// Leer imagen y convertir a base64
const imageBuffer = fs.readFileSync('schedule.jpg');
const imageBase64 = imageBuffer.toString('base64');

// Realizar solicitud
const response = await fetch('https://3000-i6m0y9d08zi38wmzuibz5-f8d4e65e.us1.manus.computer/api/public/shifts/extract', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'image',
    imageBase64: imageBase64,
    month: 3,
    year: 2026,
    apiKey: 'your_api_key_here',
  }),
});

const result = await response.json();
console.log(result);
```

### Ejemplo 2: Procesar un PDF (Python)

```python
import requests
import base64

# Leer PDF y convertir a base64
with open('schedule.pdf', 'rb') as f:
    pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

# Realizar solicitud
response = requests.post(
    'https://3000-i6m0y9d08zi38wmzuibz5-f8d4e65e.us1.manus.computer/api/public/shifts/extract',
    json={
        'type': 'pdf',
        'imageBase64': pdf_base64,
        'month': 3,
        'year': 2026,
        'apiKey': 'your_api_key_here',
    }
)

result = response.json()
print(result)
```

### Ejemplo 3: Manejo de Rate Limiting (TypeScript)

```typescript
async function extractShifts(filePath: string, month: number, year: number) {
  const fileBuffer = fs.readFileSync(filePath);
  const base64 = fileBuffer.toString('base64');

  const response = await fetch('/api/public/shifts/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'image',
      imageBase64: base64,
      month,
      year,
      apiKey: process.env.TURNO_APP_API_KEY,
    }),
  });

  if (response.status === 429) {
    const error = await response.json();
    console.error(`Rate limit exceeded. Calls remaining: ${error.callsRemaining}`);
    console.error(`Reset date: ${error.resetDate}`);
    return null;
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Mostrar información de costes
  console.log(`Processing cost: ${data.data.metadata.credits.formattedEur}`);
  console.log(`Calls remaining this month: ${data.data.metadata.rateLimit.callsRemaining}`);
  
  return data.data.shifts;
}
```

---

## Mejores Prácticas

### 1. Gestión de Errores

Siempre verifica el código de estado HTTP y el campo `success` en la respuesta:

```javascript
if (!response.ok || !result.success) {
  console.error('Error:', result.error);
  // Implementar reintentos con backoff exponencial
}
```

### 2. Monitoreo de Créditos

Mantén un registro del consumo de créditos para presupuestar:

```javascript
const cost = result.data.metadata.credits.costEur;
console.log(`This call cost €${cost}`);
```

### 3. Monitoreo de Rate Limit

Verifica el número de llamadas restantes antes de procesar:

```javascript
const remaining = result.data.metadata.rateLimit.callsRemaining;
if (remaining < 2) {
  console.warn(`Only ${remaining} calls remaining this month`);
}
```

### 4. Almacenamiento de Resultados

Guarda los turnos extraídos en tu base de datos para evitar reprocesamiento:

```javascript
// Después de procesar exitosamente
await db.shifts.insertMany(result.data.shifts);
```

### 5. Diferencias entre Imagen y PDF

Recuerda que el procesamiento difiere según el tipo:

```javascript
if (type === 'image') {
  // Los turnos que cruzan medianoche se mantienen en un solo día
  // Ej: 19:00-03:00 permanece como un turno
} else if (type === 'pdf') {
  // Los turnos que cruzan medianoche se dividen en dos
  // Ej: 19:00-03:00 se convierte en:
  //   - 19:00-00:00 (día actual)
  //   - 00:00-03:00 (día siguiente)
}
```

---

## Preguntas Frecuentes

### ¿Cuánto cuesta cada llamada?

El coste varía según el tamaño y complejidad del archivo. Típicamente:
- Imagen pequeña (< 1MB): €0.10-0.30
- PDF pequeño (< 5MB): €0.20-0.50

El coste exacto se retorna en cada respuesta en el campo `metadata.credits`.

### ¿Qué pasa si me quedo sin créditos?

Si tu cuenta de Manus se queda sin créditos, el endpoint retornará un error 500. Deberás comprar más créditos en tu cuenta de Manus.

### ¿Puedo aumentar mi límite de 30 llamadas/mes?

Sí, contacta al administrador de la aplicación para solicitar un aumento en el límite mensual.

### ¿Cómo sé si un turno cruza medianoche?

En **imágenes:** El turno aparecerá tal como está en la imagen (ej: 19:00-03:00)

En **PDFs:** El turno se dividirá automáticamente en dos:
- Primer turno: 19:00-00:00 (mismo día)
- Segundo turno: 00:00-03:00 (día siguiente)

### ¿Qué formatos de imagen se soportan?

- JPEG
- PNG
- WebP

### ¿Qué versión de PDF se soporta?

Se soportan PDFs estándar. Si tienes problemas con un PDF específico, contacta al administrador.

---

## Soporte

Para reportar problemas o solicitar cambios en el endpoint, contacta al administrador de la aplicación.
