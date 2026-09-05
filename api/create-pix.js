/**
 * Vercel Serverless Function: Criação de Pagamento Pix Direto via Mercado Pago API
 * Gera QR Code e chave Pix Copia e Cola sem exigir e-mail do convidado e sem sair do site.
 * Endpoint: POST /api/create-pix
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const SITE_URL = host ? `${proto}://${host}` : "https://casamentoericaegabriel.vercel.app";

  const accessToken =
    process.env.MP_ACCESS_TOKEN ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN ||
    "APP_USR-4886951032560827-090416-0a3fe71b92203582c68fb30b49df9540-474353646";

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { itemId, itemName, itemPrice, guestName } = body;

    if (!itemName || !itemPrice || Number(itemPrice) <= 0) {
      return res.status(400).json({ error: "Item e preço inválidos." });
    }

    const price = Number(Number(itemPrice).toFixed(2));
    const safeGuest = String(guestName || "Convidado").trim().slice(0, 50);

    const externalRef = JSON.stringify({
      id: Number(itemId) || 0,
      item: String(itemName).slice(0, 60),
      guest: safeGuest,
      method: "pix",
    });

    const idempotencyKey = `pix-${itemId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Criamos o Pix direto na API do Mercado Pago
    // O e-mail do pagador é pré-definido pelo sistema para o convidado nunca ser barrado pedindo e-mail
    const mpPayload = {
      transaction_amount: price,
      description: `${String(itemName).slice(0, 50)} • Erica & Gabriel`,
      payment_method_id: "pix",
      payer: {
        email: "convidado@casamentoericaegabriel.com.br",
        first_name: safeGuest,
      },
      external_reference: externalRef,
      notification_url: `${SITE_URL}/api/mercadopago-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Erro MP Pix:", mpData);
      return res.status(mpRes.status || 500).json({
        error: "mp_pix_error",
        message: mpData.message || "Erro ao gerar cobrança Pix no Mercado Pago.",
        details: mpData,
      });
    }

    const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code || "";
    const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const paymentId = mpData.id;

    // Pré-registrar como pendente no Supabase caso ainda não esteja
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_submit_purchase_request`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_item_name: itemName,
          p_guest_name: safeGuest,
        }),
      });
    } catch (_) {}

    return res.status(200).json({
      paymentId,
      qrCode,
      qrCodeBase64,
      amount: price,
      status: mpData.status,
    });
  } catch (err) {
    console.error("Erro interno ao gerar Pix:", err);
    return res.status(500).json({ error: "internal_error", message: err.message });
  }
};
