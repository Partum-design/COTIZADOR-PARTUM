# COTIZADOR-PARTUM

Cotizador comercial para desarrollo web, marketing digital, identidad visual y servicios de PARTUM Design.

## Funciones

- Vista previa de la propuesta en tiempo real.
- Servicios editables, duplicables y reordenables.
- Cálculo automático de subtotal, descuento, IVA y total.
- Carga de logotipo y personalización del emisor.
- Guardado local del borrador.
- Diseño adaptable para escritorio y móvil.
- Exportación en formato A4 mediante la vista de impresión.
- NORA: generación asistida de servicios con Gemini.
- Dictado por voz desde navegadores compatibles.

## Desarrollo

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre `.env.local` y configura una clave nueva:

```env
GEMINI_API_KEY=tu_clave_privada
```

La clave se usa únicamente en `/api/nora` y nunca se incluye en el código del navegador.

## Producción

```bash
npm run build
npm run preview
```
