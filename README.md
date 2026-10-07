# RingSize — UDES Ingeniería de Software

Aplicación web para determinar correctamente la **talla de un anillo** a partir de su **diámetro interno en milímetros**.

## Tecnologías (exigidas por el examen)
- **HTML5**: `index.html` semántico + estructura en `App.jsx` (`header`, `main`, `section`, `table`, `footer`)
- **CSS3**: `src/index.css` (variables, Flexbox, Grid, responsive, animaciones)
- **JavaScript**: lógica en `src/utils/ringSizes.js` (validación, C = π×d, búsqueda de talla más cercana)
- **React**: componentes con hooks (`useState`, `useMemo`) en `src/App.jsx`
- **Vite**: `vite.config.js`, scripts `dev` / `build` / `preview`

## Fórmula
- Circunferencia: `C = π × d`
- Talla EU: `EU = round(C)` (circunferencia en mm redondeada)
- Talla US / UK / JP: fila más cercana de la tabla estándar 14.0 – 22.2 mm

## Ejecutar
```bash
npm install
npm run dev
```
Abrir http://localhost:5173

## Compilar
```bash
npm run build
npm run preview
```

## Ejemplo
- 17.3 mm → US 7 · UK N · EU 54 · C 54.3 mm
- 18.1 mm → US 8 · UK P · EU 57
- 19.8 mm → US 10 · UK T · EU 62
