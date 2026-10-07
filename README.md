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
