# **Alternativas de Código Abierto para Extracción de Turnos**

*Análisis comparativo de soluciones OCR y Vision Models*

# **1\. Introducción al Problema**

La extracción de turnos desde imágenes de calendarios presenta desafíos únicos que los sistemas OCR tradicionales como Tesseract no manejan adecuadamente. El problema principal radica en que Tesseract fue diseñado para documentos de texto estructurado, no para interpretar el contexto visual de un calendario con múltiples elementos gráficos, códigos de colores y diferenciaciones visuales entre días del mes actual y meses adyacentes.

En el caso específico de los calendarios de turnos laborales, encontramos celdas que contienen números de día, códigos de turno (JT, TD, Libre), horarios en diversos formatos (17:00/01:00), y diferenciaciones visuales por color que indican pertenencia al mes actual o meses vecinos. Tesseract procesa caracteres individuales sin comprender estas relaciones estructurales, lo que resulta en pérdida significativa de información cuando el texto está en colores apagados, fuentes pequeñas, o sobre fondos coloreados.

# **2\. Por Qué Tesseract No Es Suficiente**

Tesseract es un motor OCR excelente para documentos escaneados tradicionales, pero presenta limitaciones críticas cuando se aplica a calendarios de turnos:

1. **Falta de comprensión contextual:** Tesseract no entiende que los números en las celdas representan días del mes ni que ciertos textos son códigos de turno con significado semántico.

2. **Problemas con colores apagados:** Los días de meses adyacentes suelen mostrarse en gris claro, lo que reduce drásticamente la tasa de reconocimiento de Tesseract.

3. **Dificultad con fondos coloreados:** Las celdas con fondos lila, azul o rojo interfieren con el umbralizado automático del OCR.

4. **No distingue tipos de contenido:** Un número de día, un horario y un código de turno se procesan igual, sin diferenciar su función.

5. **Tasa de error variable:** En calendarios de turnos típicos, Tesseract puede perder entre 10-15 turnos por cada 35-42 celdas procesadas.

# **3\. Soluciones de Código Abierto Recomendadas**

## **3.1 Qwen2-VL (Recomendado)**

Qwen2-VL es un modelo de visión-lenguaje desarrollado por Alibaba que sobresale en tareas de OCR y comprensión de documentos. Es particularmente efectivo para calendarios porque combina reconocimiento óptico de caracteres con comprensión del contexto visual, permitiendo distinguir entre elementos activos e inactivos, interpretar códigos de colores y mantener la coherencia estructural del calendario.

**Ventajas principales:**

* Excelente rendimiento en OCR multilingüe, especialmente en español

* Comprensión nativa de estructuras tabulares y cuadrículas

* Tamaños disponibles: 2B, 7B y 72B parámetros

* Puede ejecutarse localmente mediante Ollama o vLLM

* Licencia Apache 2.0 \- uso comercial permitido

**Instalación con Ollama:**

ollama pull qwen2-vl:7b

**Uso desde API:**

curl http://localhost:11434/api/generate \-d '{"model": "qwen2-vl:7b", "prompt": "Extrae todos los turnos de este calendario", "images": \["\<base64\_image\>"\]}'

## **3.2 LLaVA (Large Language and Vision Assistant)**

LLaVA es un modelo de visión-lenguaje de código abierto desarrollado por la Universidad de Wisconsin-Madison. Combina un codificador de visión CLIP con un modelo de lenguaje LLaMA, creando un sistema capaz de mantener conversaciones sobre imágenes. Para calendarios de turnos, LLaVA puede analizar la estructura visual completa, identificar patrones de color que indican tipos de turno, y extraer información horaria con comprensión contextual.

**Ventajas principales:**

* Ampliamente adoptado y bien documentado

* Excelente para análisis conversacional de imágenes

* Versiones disponibles: LLaVA-1.5 (7B, 13B) y LLaVA-NeXT

* Comunidad activa y soporte continuo

**Instalación con Ollama:**

ollama pull llava:13b

## **3.3 Moondream**

Moondream es un modelo de visión-lenguaje diseñado específicamente para ser ligero y eficiente. Con solo 1.6B parámetros, puede ejecutarse en hardware modesto, incluyendo CPUs sin GPU. Para calendarios de turnos, es ideal cuando se requiere procesamiento en dispositivos edge o cuando los recursos computacionales son limitados. A pesar de su tamaño reducido, mantiene capacidades sorprendentes de OCR y comprensión visual de estructuras tabulares.

**Ventajas principales:**

* Extremadamente ligero (1.6B parámetros)

* Funciona en CPUs sin GPU

* Rápido tiempo de inferencia

* Ideal para integración en aplicaciones móviles

**Instalación con Ollama:**

ollama pull moondream:1.8b

## **3.4 PaddleOCR (Alternativa OCR Tradicional Mejorada)**

Si prefieres mantener un enfoque OCR tradicional pero mejorado, PaddleOCR ofrece capacidades superiores a Tesseract. Desarrollado por Baidu, incluye modelos preentrenados específicos para documentos estructurados, detección de tablas y reconocimiento de texto en múltiples idiomas. A diferencia de Tesseract, PaddleOCR incluye detección de estructuras tabulares que puede ayudar a identificar las celdas del calendario antes de realizar el OCR del contenido.

**Ventajas principales:**

* Mejor rendimiento que Tesseract en documentos estructurados

* Detección de tablas integrada

* Soporte nativo para 80+ idiomas

* Modelos ligeros disponibles para edge deployment

**Instalación:**

pip install paddlepaddle paddleocr

# **4\. Comparativa de Soluciones**

La siguiente tabla presenta una comparación detallada de las diferentes soluciones evaluadas, considerando factores críticos como requisitos de hardware, precisión en tareas de OCR de calendarios, facilidad de implementación y licencia de uso:

| Modelo | Tamaño | RAM Req. | GPU Rec. | Precisión OCR | Licencia |
| :---: | :---: | :---: | :---: | :---: | :---: |
| Qwen2-VL | 2B-72B | 8-48 GB | Opcional | Excelente | Apache 2.0 |
| LLaVA | 7B-13B | 16-32 GB | Recomendada | Muy Buena | Apache 2.0 |
| Moondream | 1.6B | 4 GB | No requiere | Buena | MIT |
| PaddleOCR | \~100MB | 2 GB | Opcional | Buena | Apache 2.0 |
| ~~Tesseract~~ | \~50MB | \< 1 GB | No requiere | Limitada | Apache 2.0 |

*Tabla 1: Comparativa de soluciones OCR y Vision Models para calendarios*

# **5\. Implementación Práctica**

## **5.1 Arquitectura Recomendada**

Para lograr la máxima precisión en la extracción de turnos, se recomienda una arquitectura que combine las fortalezas de los modelos de visión con procesamiento post-extracción. El flujo ideal comienza con la captura de imagen, seguida de un preprocesamiento opcional (ajuste de contraste, normalización), luego la extracción mediante un modelo VLM, y finalmente una validación y corrección de los datos extraídos.

## **5.2 Ejemplo de Código con Ollama**

El siguiente código muestra cómo implementar la extracción de turnos usando Ollama con Qwen2-VL:

import requests

import base64

def extract\_shifts(image\_path):

    with open(image\_path, 'rb') as f:

        image\_base64 \= base64.b64encode(f.read()).decode()

    prompt \= '''Analiza este calendario de turnos.

    Extrae TODOS los turnos en formato JSON:

    {"month": N, "shifts": \[{"day": N, "code": "X"}\]}'''

    response \= requests.post('http://localhost:11434/api/generate',

        json={'model': 'qwen2-vl:7b', 'prompt': prompt,

             'images': \[image\_base64\], 'stream': False})

    return response.json()\['response'\]

## **5.3 Estrategia Híbrida**

Para maximizar la precisión, se puede implementar una estrategia híbrida que combine preprocesamiento de imagen con VLM:

1. **Preprocesamiento:** Ajustar contraste y brillo para resaltar textos apagados.

2. **Extracción VLM:** Usar Qwen2-VL o LLaVA para extraer turnos con comprensión contextual.

3. **Validación:** Verificar que el número de turnos coincida con los días del mes.

4. **Corrección manual:** Permitir al usuario corregir turnos con baja confianza.

# **6\. Recomendaciones Finales**

Basándose en el análisis realizado y considerando los requisitos de precisión para calendarios de turnos, se ofrecen las siguientes recomendaciones estratégicas que consideran tanto la precisión como la viabilidad de implementación en diferentes escenarios:

### **Para máxima precisión:**

Utilizar Qwen2-VL 7B con GPU. Este modelo ofrece la mejor combinación de comprensión visual y precisión OCR, especialmente para calendarios en español. La capacidad del modelo para entender el contexto estructural del calendario permite distinguir entre días del mes actual y meses adyacentes, además de interpretar correctamente los códigos de turno basándose en su color y posición.

### **Para recursos limitados:**

Moondream ofrece una solución viable que puede ejecutarse en CPUs estándar. Aunque su precisión es menor que la de modelos más grandes, sigue siendo significativamente superior a Tesseract para esta tarea específica. Es ideal para prototipos rápidos o aplicaciones móviles.

### **Para integración en producción:**

Implementar la estrategia híbrida con fallback automático: primero intentar extracción con el VLM, y si el número de turnos extraídos es menor al esperado, ejecutar un segundo pase con prompt más específico. Esto maximiza la cobertura mientras mantiene tiempos de respuesta aceptables.

# **7\. Conclusión**

El análisis demuestra que los modelos de visión-lenguaje de código abierto representan una mejora sustancial sobre Tesseract para la extracción de turnos desde calendarios. La capacidad de estos modelos para comprender el contexto visual, distinguir elementos por color y mantener la coherencia estructural permite superar las limitaciones inherentes del OCR tradicional. Qwen2-VL se presenta como la opción más equilibrada para este caso de uso, ofreciendo excelente precisión con requisitos de hardware moderados y una licencia permisiva para uso comercial.