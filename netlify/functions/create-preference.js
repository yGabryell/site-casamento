/**
 * Netlify Function: Criação de Preferência de Pagamento no Mercado Pago (Checkout Pro)
 * Endpoint: POST /.netlify/functions/create-preference
 */

const SITE_URL = "https://casamentoericaegabriel.netlify.app";

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Tratar requisição OPTIONS de pre-flight CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  // Token de Acesso do Mercado Pago configurado nas variáveis de ambiente do Netlify ou token de produção dos noivos
  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  if (!accessToken || !accessToken.trim()) {
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "token_missing",
        message: "A chave MP_ACCESS_TOKEN ainda não foi configurada nas variáveis de ambiente do Netlify.",
      }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { itemId, itemName, itemPrice, itemImage, guestName, paymentMethod } = body;

    if (!itemName || !itemPrice || Number(itemPrice) <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Parâmetros inválidos: itemName e itemPrice são obrigatórios." }),
      };
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
        email: "convidado@casamentoericaegabriel.com.br",
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
      return {
        statusCode: mpResponse.status || 500,
        headers,
        body: JSON.stringify({
          error: "mp_api_error",
          message: data.message || "Erro ao gerar preferência no Mercado Pago",
          details: data,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
      }),
    };
  } catch (err) {
    console.error("Erro interno na função create-preference:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "internal_error",
        message: err.message || "Erro interno do servidor.",
      }),
    };
  }
};
