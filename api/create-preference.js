/**
 * Vercel Serverless Function: Criação de Preferência de Pagamento no Mercado Pago (Checkout Pro)
 * Endpoint: POST /api/create-preference
 */

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // Obter URL do site dinamicamente a partir do host da requisição
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const SITE_URL = host ? `${proto}://${host}` : "https://casamentoericaegabriel.netlify.app";

  // Token de Acesso do Mercado Pago configurado nas variáveis de ambiente ou token padrão dos noivos
  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  if (!accessToken || !accessToken.trim()) {
    return res.status(503).json({
      error: "token_missing",
      message: "A chave MP_ACCESS_TOKEN ainda não foi configurada nas variáveis de ambiente.",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { itemId, itemName, itemPrice, itemImage, guestName, paymentMethod } = body;

    if (!itemName || !itemPrice || Number(itemPrice) <= 0) {
      return res.status(400).json({ error: "Parâmetros inválidos: itemName e itemPrice são obrigatórios." });
    }

    const price = Number(Number(itemPrice).toFixed(2));

    // Garantir URL absoluta para a foto do produto
    let pictureUrl = "";
    if (itemImage) {
      if (itemImage.startsWith("http://") || itemImage.startsWith("https://")) {
        pictureUrl = itemImage;
      } else {
        const cleanPath = itemImage.startsWith("/") ? itemImage.slice(1) : itemImage;
        pictureUrl = `${SITE_URL}/${cleanPath}`.split("?")[0];
      }
    }

    // Montar referência externa para identificar quem presenteou no retorno
    const externalRef = JSON.stringify({
      id: Number(itemId) || 0,
      item: String(itemName).slice(0, 60),
      guest: String(guestName || "Convidado").slice(0, 50),
      method: String(paymentMethod || "all"),
    });

    const paymentMethodsConfig = {
      installments: 12,
    };

    if (paymentMethod === "pix") {
      paymentMethodsConfig.default_payment_method_id = "pix";
    }

    const preferencePayload = {
      items: [
        {
          id: String(itemId || "presente"),
          title: `${String(itemName).slice(0, 100)} • Erica & Gabriel`,
          description: `Presente de Casamento para Erica & Gabriel: ${itemName}`,
          picture_url: pictureUrl || undefined,
          category_id: "wedding_gifts",
          quantity: 1,
          currency_id: "BRL",
          unit_price: price,
        },
      ],
      payer: {
        name: String(guestName || "Convidado").slice(0, 50),
      },
      back_urls: {
        success: `${SITE_URL}/?status=approved&item_id=${encodeURIComponent(itemId || "")}&guest=${encodeURIComponent(guestName || "")}#presentes`,
        pending: `${SITE_URL}/?status=pending&item_id=${encodeURIComponent(itemId || "")}&guest=${encodeURIComponent(guestName || "")}#presentes`,
        failure: `${SITE_URL}/?status=failure#presentes`,
      },
      auto_return: "approved",
      statement_descriptor: "CASAMENTO E&G",
      external_reference: externalRef,
      notification_url: `${SITE_URL}/api/mercadopago-webhook`,
      payment_methods: paymentMethodsConfig,
    };

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const data = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Erro da API Mercado Pago:", data);
      return res.status(mpResponse.status || 500).json({
        error: "mp_api_error",
        message: data.message || "Erro ao gerar preferência no Mercado Pago",
        details: data,
      });
    }

    return res.status(200).json({
      id: data.id,
      init_point: data.init_point,
      sandbox_init_point: data.sandbox_init_point,
    });
  } catch (err) {
    console.error("Erro interno na função create-preference:", err);
    return res.status(500).json({
      error: "internal_error",
      message: err.message || "Erro interno do servidor.",
    });
  }
};
