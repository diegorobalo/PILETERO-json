# PILETERO v1.1 Features

## 💬 WhatsApp Aviso de Visita

### ¿Qué es?

Desde la Agenda del día, Fede puede enviar mensajes pre-llenados a clientes por WhatsApp sin salir de la app. Es perfecto para avisar que va a hacer mantenimiento sin tener que escribir el mismo mensaje una y otra vez.

### ¿Cómo funciona?

#### 1. Configurar mensajes (una sola vez o cuando quieras cambiar)

- Ve a **Configuración** en la barra lateral
- Desplázate hasta la sección **💬 Mensajes WhatsApp**
- Edita el campo "Mensaje para visita" con el texto que quieras enviar
  - Ejemplo: `Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!`
- Opcionalmente, edita el campo "Mensaje para reprogramación"
- Verás que puedes usar placeholders especiales:
  - `{nombre_cliente}` — se reemplaza con el nombre del cliente
  - `{fecha_hoy}` — se reemplaza con la fecha de hoy (ej: "29 de junio de 2026")
  - `{hora}` — se reemplaza con la hora actual (ej: "14:32")
- Haz clic en **Guardar** para guardar el mensaje
- Opcionalmente, haz clic en **Preview** para ver cómo se ve el mensaje con datos de ejemplo

#### 2. Enviar mensaje a un cliente

- Ve a **Agenda** en la barra lateral
- Ve a la pestaña **Hoy**
- Para cada cliente en la lista, verás un botón 💬 (arriba a la derecha de la tarjeta)
- Haz clic en el botón 💬
  - Si el cliente no tiene teléfono registrado, verás un error: "Este cliente no tiene teléfono registrado"
  - Si sí tiene teléfono, se abrirá WhatsApp (o WhatsApp Web) en una nueva pestaña del navegador
- El mensaje estará ya rellenado con los datos del cliente
- Puedes revisar el mensaje, editarlo si lo deseas, y luego hacerlo clic en **Enviar**

### Ejemplos de mensajes

#### Para Visita

```
Hola {nombre_cliente}, hoy voy a hacer el servicio de mantenimiento en tu pileta. Confirma si está todo bien. Saludos!
```

O más corto:

```
Vengo a las {hora} a hacer el mantenimiento. Confirma 👍
```

#### Para Reprogramación

```
Hola {nombre_cliente}, el servicio va a ser reprogramado para otro día. Te aviso cuando.
```

### Notas Importantes

- **Teléfono requerido:** El cliente debe tener su número de teléfono registrado en PILETERO para poder enviarle un WhatsApp
- **WhatsApp Web vs App:**
  - Si abres PILETERO en la computadora, se abrirá WhatsApp Web
  - Si abres PILETERO en un celular, se abrirá la app de WhatsApp
- **Editar antes de enviar:** El mensaje se abre en WhatsApp listo para enviar, pero puedes editarlo si quieres cambiar algo antes de hacerlo clic en "Enviar"
- **Números de Argentina:** Los números se asumen que son de Argentina (+54). Si algún cliente tiene un número de otro país, agrégale el código del país al principio (ej: +58 para Venezuela, +351 para Portugal)

### Formato de Números de Teléfono

Aceptamos números en estos formatos (todos se convierten a +549xxxxxxxxxx):

- `1123456789` (sin espacios ni caracteres especiales)
- `11 2345 6789` (con espacios)
- `11-2345-6789` (con guiones)
- `(11) 2345 6789` (con paréntesis)

### ¿Qué pasa internamente?

1. Guardas un mensaje en Configuración (ej: "Hola {nombre_cliente}, vengo a las {hora}")
2. Desde Agenda, haces clic en 💬 para un cliente llamado "Casa García" a las 14:32
3. PILETERO reemplaza:
   - `{nombre_cliente}` → "Casa García"
   - `{hora}` → "14:32"
   - El mensaje queda: "Hola Casa García, vengo a las 14:32"
4. Se abre: `https://wa.me/+549123456789?text=Hola%20Casa%20García%2C%20vengo%20a%20las%2014%3A32`
5. WhatsApp recibe el número y el texto, y los muestra listos para enviar

---

## Otras Features (v1.0 y anteriores)

[Documentación de otras features...]
