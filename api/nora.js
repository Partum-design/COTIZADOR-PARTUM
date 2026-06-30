const MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 1200;

const serviceSchema = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Confirmación breve en español, sin saludo ni texto promocional.",
    },
    services: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "Desarrollo web",
              "Marketing digital",
              "Identidad visual",
              "Contenido",
              "Consultoría",
            ],
          },
          name: {
            type: "string",
            description: "Nombre comercial claro y breve del servicio.",
          },
          description: {
            type: "string",
            description: "Alcance profesional en una sola oración.",
          },
          duration: {
            type: "string",
            description: "Duración indicada o Por definir.",
          },
          capacity: {
            type: "string",
            description: "Personas, sedes o unidad indicada; si falta, Por definir.",
          },
          quantity: {
            type: "integer",
            minimum: 1,
            maximum: 999,
          },
          price: {
            type: "number",
            minimum: 0,
            description: "Precio unitario sin IVA. Usa 0 si el usuario no dio un precio.",
          },
          deliverable: {
            type: "string",
            description: "Entregable indicado o Por definir.",
          },
        },
        required: [
          "category",
          "name",
          "description",
          "duration",
          "capacity",
          "quantity",
          "price",
          "deliverable",
        ],
      },
    },
  },
  required: ["message", "services"],
};

const safeText = (value, fallback, maxLength = 240) => {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
};

function sanitizeService(service) {
  const categories = new Set([
    "Desarrollo web",
    "Marketing digital",
    "Identidad visual",
    "Contenido",
    "Consultoría",
  ]);
  return {
    category: categories.has(service.category) ? service.category : "Consultoría",
    name: safeText(service.name, "Servicio por definir", 120),
    description: safeText(service.description, "Alcance por definir.", 320),
    duration: safeText(service.duration, "Por definir", 60),
    capacity: safeText(service.capacity, "Por definir", 60),
    quantity: Math.min(999, Math.max(1, Math.round(Number(service.quantity) || 1))),
    price: Math.max(0, Number(service.price) || 0),
    deliverable: safeText(service.deliverable, "Por definir", 160),
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Método no permitido." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (
    !apiKey ||
    apiKey === "undefined" ||
    apiKey.startsWith("pega_aqui_")
  ) {
    return response.status(503).json({
      error: "NORA aún no tiene configurada la variable GEMINI_API_KEY.",
      code: "KEY_NOT_CONFIGURED",
    });
  }

  const prompt = String(request.body?.prompt ?? "").trim();
  const currency = request.body?.currency === "USD" ? "USD" : "MXN";

  if (prompt.length < 8) {
    return response.status(400).json({
      error: "Describe el servicio con un poco más de detalle.",
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return response.status(400).json({
      error: `El dictado debe tener menos de ${MAX_PROMPT_LENGTH} caracteres.`,
    });
  }

  const instruction = [
    "Eres NORA, asistente de cotizaciones de PARTUM Design.",
    "Convierte exclusivamente el texto del usuario en uno o varios servicios comerciales.",
    `La moneda de la cotización es ${currency}.`,
    "No inventes precios, duración, capacidad ni entregables: usa los valores de respaldo definidos en el esquema.",
    "El precio siempre es unitario, numérico y sin IVA.",
    "No agregues explicaciones fuera del JSON.",
    `Texto del usuario: ${prompt}`,
  ].join("\n");

  try {
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 900,
            responseMimeType: "application/json",
            responseSchema: serviceSchema,
            thinkingConfig: {
              thinkingLevel: "minimal",
            },
          },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error("Gemini API error", geminiResponse.status, payload?.error?.message);
      return response.status(geminiResponse.status === 429 ? 429 : 502).json({
        error:
          geminiResponse.status === 429
            ? "NORA llegó al límite temporal. Intenta nuevamente en un momento."
            : "NORA no pudo interpretar el servicio en este momento.",
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("");
    const result = JSON.parse(text);
    const services = Array.isArray(result.services)
      ? result.services.slice(0, 8).map(sanitizeService)
      : [];

    if (!services.length) {
      throw new Error("Gemini returned no services");
    }

    return response.status(200).json({
      message: safeText(result.message, `${services.length} servicio(s) listo(s).`, 140),
      services,
    });
  } catch (error) {
    console.error("NORA request failed", error);
    return response.status(502).json({
      error: "NORA no pudo completar la solicitud. Revisa la conexión e intenta otra vez.",
    });
  }
}
