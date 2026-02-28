# AGENTS.md

## Resumen del repositorio
- App Vite + React + TypeScript para gestionar turnos mensuales.
- No hay backend. Todo vive en frontend y persiste en `localStorage`.
- El punto de entrada es `src/App.tsx`.
- El dominio principal es un calendario mensual con alta manual y una importacion por imagen.

## Estructura relevante
- `src/App.tsx`: estado principal, navegacion por mes, modales y persistencia.
- `src/components/shift-dashboard/`: UI del calendario, metricas e importacion.
- `src/lib/types.ts`: tipos `Shift` y derivados.
- `src/lib/storage.ts`: persistencia en `localStorage`.
- `src/lib/week.ts`: calculos de calendario y fechas.
- `src/lib/shifts.ts`: logica de negocio de turnos y metricas.
- `src/lib/calendar-image-parser.ts`: OCR con Tesseract y fusion de resultados.
- `src/lib/ollama-vision-parser.ts`: importacion con modelos vision locales via Ollama.
- `src/estrategia.md`: decision tecnica para priorizar VLMs, especialmente Qwen2-VL.
- `sdd/features/shift-image-calendar-ingestion/`: especificacion de la importacion por imagen.

## Comandos utiles
- `npm run dev`: desarrollo local.
- `npm run build`: validacion principal del proyecto.
- `npm run lint`: linting estricto.

## Convenciones del proyecto
- Los turnos usan fechas ISO `YYYY-MM-DD`.
- Las horas usan `HH:mm`.
- La app muestra meses 0-indexados internamente y dias ISO en la UI/datos.
- La importacion por imagen no debe escribir directamente en almacenamiento: primero pasa por preview editable.

## Reglas para cambios
- Mantener el flujo actual: detectar, previsualizar, editar y confirmar.
- Si tocas OCR, intenta mejorar cobertura sin perder la posibilidad de correccion manual.
- Si hay Ollama disponible, priorizar precision sobre velocidad. `src/estrategia.md` recomienda Qwen2-VL.
- Evitar cambios de diseño amplios salvo que sean necesarios para el flujo de importacion.
- No introducir dependencias nuevas sin una razon clara; el repo hoy es ligero y totalmente frontend.

## Riesgos conocidos
- La importacion por imagen es la parte mas fragil del repo.
- Los screenshots de calendarios pueden incluir UI extra, dias de meses adyacentes y texto sobre fondos coloreados.
- Tesseract falla especialmente con horas blancas sobre azul/lila y con dias atenuados.
- Hay riesgo de duplicados si se importan turnos varias veces; hoy no existe deduplicacion global al confirmar.

## Pistas para futuros agentes
- Antes de tocar el parser, revisar `src/estrategia.md` y la spec en `sdd/features/shift-image-calendar-ingestion/`.
- Validar siempre con `npm run build`.
- Si cambias `ImportModal`, verifica que siga permitiendo editar y borrar filas antes de confirmar.
- Si mejoras OCR, intenta fusionar resultados por fecha en vez de sobrescribir ciegamente un turno parcial por otro.
