# Habla con la ciudad

<!-- hy-mt2-i18n:start -->
[English](./README.md) | [中文](./README_zh-CN.md) | [日本語](./README_ja.md) | **Español**
<!-- hy-mt2-i18n:end -->


[Talk to the City (T3C)](https://ai.objectives.institute/talk-to-the-city) es una herramienta SaaS de código abierto basada en LLM que permite mejorar la deliberación colectiva y la toma de decisiones mediante el análisis de datos cualitativos detallados. Agrega las respuestas y organiza las afirmaciones similares en un árbol anidado de temas principales y subtemas.

**Pruébalo en directo**: [https://talktothe.city/](https://talktothe.city/)

### Para desarrolladores

Consulte [DEVELOPMENT.md](DEVELOPMENT.md) para obtener instrucciones detalladas sobre:

- Configurar dependencias en la nube (Firebase, GCS, etc.)
- Configurar variables de entorno
- Instalar y ejecutar todos los servicios localmente

## Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   next-client   │◄──►│ express-server  │◄──►│pipeline-worker  │
│   (Frontend)    │    │   (Backend)     │    │ (Procesamiento LLM)│
│   Puerto: 3000    │    │   Puerto: 8080    │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │
          │                      │
          ▼                      ▼
       ┌─────────────────────────────────────┐
       │             common                  │
       │         (Tipos compartidos,              │
       │      Esquemas y utilidades)           │
       └─────────────────────────────────────┘
```

**Servicios externos**: Firebase (Autenticación), Google Cloud Storage (Informes), Redis (Almacenamiento en caché), Google Pub/Sub (Trabajos)

## Datos de ejemplo

Consulte el directorio `examples/sample_csv_files/` para encontrar archivos CSV de ejemplo:

- `reddit_climate_change_posts_500.csv`: Publicaciones sobre cambio climático

Formato esperado del CSV:

```csv
id,interview,comment
1,participant_1,Este es un comentario de ejemplo
2,participant_2,Respuesta de otro participante
```

## Licencia

[![Licencia](https://img.shields.io/badge/license-Apache%202-blue)](LICENSE.txt)

---

**¿Preguntas?** ¿Tiene alguna pregunta, comentario o interés en colaborar directamente con nosotros en aplicaciones de alto impacto? Contáctenos en <hello@aiobjectives.org>
