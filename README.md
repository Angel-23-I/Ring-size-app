# RingSize — UDES Ingeniería de Software

Aplicación web responsive para determinar de forma rápida y confiable la talla de un anillo **T1–T36** a partir de su **diámetro interno en milímetros**, mostrando su equivalencia en talla **USA**.

Actor: **USU-01 Usuario Final**. Sin backend ni base de datos (SPA frontend estática y modular).

## Tecnologías

- HTML5 semántico (`index.html`, `header`, `main`, `section`, `table`, `footer`)
- CSS3 (`src/App.css`, `src/styles/responsive.css`: variables, Flexbox/Grid, responsive, mobile-first)
- JavaScript (lógica pura en `src/utils/ringCalculator.js`)
- React (componentes con hooks en `src/App.jsx` y `src/components/`)
- Vite (configuración en `vite.config.js`, scripts `dev` / `build` / `preview`)

Versiones reales registradas (no inventadas, obtenidas del entorno de construcción):

- Node: v24.15.0
- npm: 11.12.1
- react: 19.3.0
- react-dom: 19.3.0
- vite: 6.4.4
- @vitejs/plugin-react: 4.7.0

Las versiones definitivas son las que quedan registradas en `package.json` y `package-lock.json`.

## Instalación y ejecución

```bash
npm install
npm run dev
```

Abrir http://localhost:5173

Compilar:

```bash
npm run build
npm run preview
```

## Estructura

```text
Ring-size-app/
├── index.html
├── package.json
├── vite.config.js
├── README.md
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    ├── data/
    │   └── ringSizes.js
    ├── utils/
    │   └── ringCalculator.js
    ├── components/
    │   ├── Header.jsx
    │   ├── SizeForm.jsx
    │   ├── ResultCard.jsx
    │   ├── SizeTable.jsx
    │   └── HelpGuide.jsx
    └── styles/
        └── responsive.css
```

Ajuste respecto al esquema base: se eliminó `src/index.css` y la lógica antigua de tabla genérica con otras escalas para cumplir la restricción de fuente única T1–T36 y no duplicar datos. La tabla vive solo en `src/data/ringSizes.js`.

## Funcionamiento

1. Mide el diámetro interno del anillo en milímetros.
2. Introdúcelo en el campo (acepta `18.10` o `18,10`, máximo 2 decimales).
3. Presiona **Calcular talla**.
4. Lee la talla T1–T36, el diámetro de referencia y la equivalencia USA.
5. Consulta la tabla T1–T36 o la guía de medición si lo necesitas.
6. Usa **Limpiar** para una nueva consulta.

## Regla de aproximación (RN-04)

- Coincidencia exacta (tolerancia 0.009 mm): tipo **Exacta**.
- Valor entre dos tallas: se asigna **siempre la talla inmediatamente superior**, tipo **Aproximada**.
- Menor que T1 o mayor que T36: no se asigna talla, se muestra error en español.

## Limitaciones

- Unidad exclusiva: milímetros. No se aceptan otras unidades.
- Fuente de datos: tabla oficial T1–T36 (corrección bloqueante Etapa 2) aplicada en `src/data/ringSizes.js`: T1 13.0 mm USA 1 → T36 24.2 mm USA 15.5, 36 registros.
- No mide físicamente el anillo ni usa cámara.
- Sin login, backend, base de datos, pagos ni app nativa.
- Suite formal de pruebas PF-01 a PF-07 pendiente (etapa de pruebas).

## Uso

Campo con `label` visible, `placeholder`, unidad `mm` e `inputmode="decimal"` para teclado numérico en móvil. Errores claros en español para: vacío, no numérico, valor <= 0, más de 2 decimales, inferior a T1, superior a T36.

## Alpha/Beta — Medición asistida por IA

Módulo experimental y aislado ("Medición con cámara — BETA") que estima el diámetro desde una foto del anillo junto a una regla. El calculador manual sigue siendo la vía principal y no fue modificado.

- **Objetivo:** demostración académica de medición aproximada con visión por IA.
- **Funcionamiento:** foto (galería o cámara, `accept="image/*" capture="environment"`) → proxy local (2 etapas: regla, anillo) → overlay con la propuesta (marcas + mm + líneas de diámetro) → **el humano confirma que los valores coinciden con su regla o indica 2 marcas manualmente** → cálculo local píxeles→mm → `ringCalculator.js` → tabla T1–T36. Sin referencia confirmada no hay talla (`NEEDS_REFERENCE_CONFIRMATION`); los `tick_points` de la IA jamás se usan directamente para calcular. Resultado etiquetado "Estimación aproximada mediante fotografía asistida por IA".
- **Arquitectura:** `React → POST /api/measure (server/beta-proxy.mjs) → Gemini generateContent → detección JSON → imageMeasurement.js → ringCalculator.js → ringSizes.js`. Sin SDK en cliente; proxy Node sin dependencias.
- **Gemini:** modelo configurable (`GEMINI_MODEL`, defecto `gemini-2.5-flash`: multimodal con detección de objetos, rápido, económico, con Free Tier con límites RPM/RPD/TPM que varían — ver AI Studio; no es ilimitado). Entrada inline base64 (< 20 MB total), `responseMimeType: application/json` + `responseSchema`. Coordenadas 0–1000 según documentación oficial de object detection.
- **Seguridad:** `GEMINI_API_KEY` solo en el servidor (`.env`, ignorado por Git). El bundle no contiene la clave ni llamadas directas a Google (verificado). `.env.example` incluido.
- **Flujo de medición:** mediana de px/mm entre pares de marcas (tolerancia de perspectiva 30 %), diámetro desde par de puntos o promedio de caja, compuertas de calidad; coma/validación reutilizan el núcleo.
- **Limitaciones:** aproximado por naturaleza (perspectiva, inclinación, luz, reflejos, blur); requiere regla legible en el mismo plano; sin foto válida no estima; la confianza es de detección, no precisión científica; Free Tier con cuotas y posible uso de datos para mejora de productos (plan gratuito).
- **Requisitos Beta:** `cp .env.example .env` + clave, `npm run beta:server` (puerto 3001), frontend con `VITE_BETA_API_URL` si cambia el puerto.
- **Desactivar:** `VITE_BETA_ENABLED=false` (la sección no se renderiza) o no iniciar el proxy.
- **Por qué es aproximado:** la IA solo localiza píxeles; la escala depende de la foto y la geometría se degrada con perspectiva e inclinación.
