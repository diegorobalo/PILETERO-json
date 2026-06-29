/**
 * Interpolates placeholders in a message template
 * Supported placeholders:
 *   {nombre_cliente} — replaced with cliente.nombre
 *   {fecha_hoy} — replaced with today's date in es-AR format
 *   {hora} — replaced with current time in es-AR format (optional)
 *
 * @param {string} template - Message template with placeholders
 * @param {object} cliente - Client object with nombre, telefono, etc.
 * @returns {string} Interpolated message
 */
export function interpolateMensaje(template, cliente = {}) {
  if (!template) return '';

  let result = template;

  // Replace {nombre_cliente}
  if (cliente.nombre) {
    result = result.replace(/{nombre_cliente}/g, cliente.nombre);
  }

  // Replace {fecha_hoy} — today's date in Spanish locale
  const hoy = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  result = result.replace(/{fecha_hoy}/g, hoy);

  // Replace {hora} — current time in Spanish locale
  const ahora = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  result = result.replace(/{hora}/g, ahora);

  return result;
}

/**
 * Encodes a message for use in a wa.me URL
 * @param {string} message - Message to encode
 * @returns {string} URL-encoded message
 */
export function encodeWhatsAppMessage(message) {
  return encodeURIComponent(message);
}

/**
 * Generates a WhatsApp link for a given client and message
 * @param {string} clienteTelefono - Client phone number (without country code, e.g., "1234567890")
 * @param {string} mensaje - Message to send
 * @returns {string} wa.me URL
 */
export function generateWhatsAppLink(clienteTelefono, mensaje) {
  if (!clienteTelefono || !mensaje) return '';

  // Ensure phone number format: remove spaces and special chars
  const telefono = clienteTelefono.replace(/\D/g, '');
  const encoded = encodeWhatsAppMessage(mensaje);

  // Argentina country code: +54
  return `https://wa.me/+54${telefono}?text=${encoded}`;
}
