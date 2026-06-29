# Diseño: Insumos Dinámicos en Visitas

**Fecha:** 2026-06-25  
**Autores:** Fede (usuario), Claude (diseñador)  
**Estado:** Diseño Aprobado

---

## Resumen Ejecutivo

Hoy, PILETERO solo permite registrar 6 químicos hardcodeados en cada visita (cloro granulado, cloro líquido, pH+, pH−, algicida, floculante). Fede carga muchos más insumos en su inventario (cloro en pastillas, ácido, clarificador, etc.) pero no puede usarlos en las visitas sin modificar código.

**Solución:** Refactorizar "Lo que aplique" para ser completamente dinámico. La `DosisCalculadora` sigue sugiriendo automáticamente los 6 químicos basado en condición de agua, pero Fede puede eliminar sugerencias o agregar CUALQUIER insumo del inventario. Al registrar la visita, el stock se descuenta automáticamente con las unidades correctas (g, ml, L, etc.).

**Beneficio:** Fede tiene libertad total sin tocar código. Cada vez que agrega un insumo nuevo al inventario, automáticamente aparece disponible en el selector de visitas.

---

## Problema Actual

1. **Insumos hardcodeados:** Solo 6 químicos están en el código
2. **Inventario desaprovechado:** Fede carga muchos más insumos (cloro pastillas, ácido, clarificador) pero no puede usarlos
3. **Fricción de actualización:** Para agregar un nuevo insumo a las visitas, hay que modificar código
4. **Unidades mixed:** Hoy asume gramos/ml, sin considerar la unidad del inventario

---

## Solución: Insumos Dinámicos con Sugerencias Inteligentes

### Arquitectura

**Frontend (React):**
- `DosisCalculadora` calcula dosis de los 6 químicos como SUGERENCIAS automáticas
- Nuevas secciones:
  - "Lo que usaste" — array editable de insumos (incluye sugerencias + agregados por Fede)
  - "+ Agregar otro" — selector dinámico de inventario
- Cada insumo muestra: nombre, stock actual, input numérico, botón eliminar
- Input hereda unidad de medida del inventario (g, ml, L, etc.) y permite decimales

**Backend (Node.js/Express):**
- `POST /api/visitas` ahora recibe array dinámico en lugar de objeto fijo
- Por cada insumo: descuenta stock automáticamente via `ajustarStock(insumo_id, -cantidad)`
- Registra movimiento con `origen='visita'`
- Validación: si stock insuficiente, advierte pero permite guardar (stock va negativo)

**Database (SQLite):**
- Tabla `visitas` columna `quimicos_usados` — cambia de formato, sigue siendo JSON
- Viejo: `{cloroGranulado: 100, cloroLiquido: 0, ...}`
- Nuevo: `[{insumo_id: 1, nombre: "Cloro Granulado", cantidad: 100, unidad: "g"}, ...]`
- Migración: automática en código, backward-compatible

---

## Flujo de Usuario

### Registrar Visita (Caso Happy Path)

1. Fede abre "Nueva visita", selecciona cliente
2. Ingresa volumen pileta (50,000L) + condición de agua (turbia)
3. `DosisCalculadora` calcula → sugiere:
   - Cloro Granulado 100g
   - pH+ 50g
   - Floculante 200g
4. Sección "Lo que usaste" muestra las 3 sugerencias, cada una editable
5. Fede decide hoy usar "Cloro en Pastillas" en lugar de granulado:
   - Elimina "Cloro Granulado" (X)
   - Toca "+ Agregar otro"
   - Busca "Cloro en Pastillas" en dropdown
   - Entra cantidad "150g"
6. Array final: `[{insumo_id: 3, ...}, {insumo_id: 5, ...}, {insumo_id: 7, ...}]`
7. Toca "Guardar visita"
8. Backend descuenta stock de los 3 insumos, registra movimientos
9. Visita guardada ✓

### Stock Insuficiente (Edge Case)

1. Fede entra "uso 3L de cloro líquido" pero solo hay 1.5L
2. Advertencia: "⚠️ Stock bajo: solo hay 1.5L. ¿Confirmar de todas formas?"
3. Fede confirma → visita se registra, stock queda -1.5L (negativo, Fede lo ve en rojo después)

---

## Cambios de Implementación

### Frontend

**Archivo: `frontend/src/components/DosisCalculadora.jsx`**
- Refactorizar `usados` de objeto plano a array de objetos
- Agregar estado `insumosAgregados` para los agregados manualmente
- Nuevo componente `SelectorInsumo` — dropdown + input cantidad
- Mantener lógica de cálculo de dosis (solo cambia cómo se almacena)

**Archivo: `frontend/src/pages/VisitasPage.jsx`**
- Adaptarse a recibir/enviar array en `quimicos_usados`
- Helper `quimicosTexto()` actualizado para iterar array
- Backward-compat: si lee formato viejo, convierte a array

**Archivo: `frontend/src/pages/ReporteVisitaPage.jsx` & `ReciboPagoPage.jsx`**
- Actualizar para leer array dinámico
- Mostrar dinámicamente sin hardcodeados

### Backend

**Archivo: `backend/server.js` (POST /api/visitas)**
- Cambiar parsing de `quimicos_usados` de objeto a array
- Iterar array, llamar `database.ajustarStock()` por cada insumo

**Archivo: `backend/services/database.js`**
- `ajustarStock()` ya existe (Task 6) — sin cambios
- Nuevo helper `validateInsumoStock(insumo_id, cantidad)` — valida pero NO bloquea
- Nuevo helper `parseQuimicos(raw)` — convierte viejo formato a nuevo array (backward-compat)

**Archivo: `backend/api/routes.js`**
- GET `/api/inventario` — ya existe, sin cambios (devuelve todos, excepto agua se filtra en frontend)

### Database

**Tabla `visitas` columna `quimicos_usados`:**
- Sigue siendo JSON
- Ninguna migration SQL necesaria (es compatible)
- Viejo formato sigue guardable, solo ya no se genera nuevo

---

## Backward Compatibility

**Visitas antiguas (formato viejo):**
- Al leerlas: `parseQuimicos()` convierte `{cloroGranulado: 100, ...}` a array
- En UI: se ven idénticas
- Si Fede edita y guarda: se convierte al formato nuevo

**Ejemplo conversión:**
```javascript
// Viejo
{cloroGranulado: 100, cloroLiquido: 0, phMas: 50, phMenos: 0, algicida: 0, floculante: 200}

// Nuevo (después de parseQuimicos)
[
  {insumo_id: 1, nombre: "Cloro Granulado", cantidad: 100, unidad: "g"},
  {insumo_id: 3, nombre: "pH+", cantidad: 50, unidad: "g"},
  {insumo_id: 4, nombre: "Floculante", cantidad: 200, unidad: "ml"}
]
```

---

## Validaciones y Edge Cases

| Caso | Comportamiento | Razón |
|------|---|---|
| Stock insuficiente | Advertencia, permite guardar, stock negativo | Fede puede rectificar después |
| Eliminar todas sugerencias | Permite guardar sin insumos | Fede puede registrar visita sin químicos |
| Agua en selector | Excluida del dropdown | Agua no se descuenta conceptualmente |
| Insumo con stock=0 | Permitido ingresar, stock va negativo | Fede trabaja con préstamo o expectativa |
| Cantidad decimal | Soportado (1.5L, 0.25g) | Realidad del uso |
| Visita antigua leída | Conversión silenciosa a array | Transparente para Fede |

---

## Datos y Schema

**Tabla `visitas` — columna `quimicos_usados`:**

Formato NUEVO (JSON array):
```json
[
  {
    "insumo_id": 1,
    "nombre": "Cloro Granulado",
    "cantidad": 100.5,
    "unidad": "g"
  },
  {
    "insumo_id": 6,
    "nombre": "Cloro en Pastillas",
    "cantidad": 1.5,
    "unidad": "unidades"
  }
]
```

**Tabla `movimientos_inventario`:**
- Ya existe (Task 6)
- Cada descuento crea una fila con `tipo='uso'`, `origen='visita'`, `referencia_id=visita_id`

---

## Testing

**Escenarios a validar:**

1. ✓ Crear visita con sugerencias automáticas
2. ✓ Editar cantidades de sugerencias
3. ✓ Eliminar sugerencia, agregar otro insumo
4. ✓ Stock descuenta correctamente (con decimales)
5. ✓ Stock negativo genera movimiento rojo
6. ✓ Advertencia en stock insuficiente
7. ✓ Visita antigua se lee/convierte correctamente
8. ✓ PDF muestra insumos dinámicos
9. ✓ Historial de visitas muestra insumos dinámicos
10. ✓ Inventario → movimientos → correctamente registrados

---

## Restricciones y Supuestos

- **Agua siempre excluida** — no aparece en selector, no se descuenta
- **6 químicos siguen siendo sugeridos** — lógica de DosisCalculadora sin cambios
- **Descuento 1:1** — cantidad ingresada = cantidad descontada (no hay conversiones)
- **Sin migración de datos** — formato viejo coexiste, se convierte on-read
- **Usuario ya tiene insumos en inventario** — no hay que crear defaults

---

## Criterios de Aceptación

- [ ] Fede puede seleccionar cualquier insumo del inventario en una visita
- [ ] El stock se descuenta automáticamente con la unidad correcta
- [ ] Soporta cantidades decimales (ej: 1.5 litros)
- [ ] Advertencia (no bloqueo) si stock insuficiente
- [ ] Visitas antiguas siguen funcionando
- [ ] PDFs y reportes muestran insumos dinámicos
- [ ] Documentación actualizada
