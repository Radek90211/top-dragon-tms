export default function handler(_request, response) {
  return response.status(404).json({ ok: false, message: 'Endpoint diagnostyczny został wyłączony.' })
}
