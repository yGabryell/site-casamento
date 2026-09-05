/**
 * Netlify Function: Liberação de Presente Pendente
 * Libera um item que estava com checkout pendente se o usuário cancelou ou o tempo expirou.
 * Nunca altera itens já com status "purchased" (comprados).
 * Endpoint: POST /.netlify/functions/release-item
 */

const SUPABASE_URL = "https://bvbckfajmkfiajjymkmu.supabase.co";
const SUPABASE_KEY = "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL";
const ADMIN_PIN = "EG01052027";

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed. Use POST." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { itemId } = body;

    if (!itemId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "itemId é obrigatório." }) };
    }

    const sbHeaders = {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    };

    // 1. Verificar o status atual do item no Supabase
    const stateRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_gift_states?item_id=eq.${Number(itemId)}&select=*`, {
      headers: sbHeaders,
    });
    const stateData = await stateRes.json();
    const existingState = Array.isArray(stateData) && stateData.length > 0 ? stateData[0] : null;

    // Se o item já foi comprado com sucesso, JAMAIS resetamos!
    if (existingState && existingState.status === "purchased") {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          message: "Item já adquirido, não pode ser liberado.",
          itemId: Number(itemId),
        }),
      };
    }

    // Se estiver pendente ou existir registro não-comprado, removemos para voltar a 'available'
    if (existingState) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/wedding_delete_purchase_item`, {
        method: "POST",
        headers: sbHeaders,
        body: JSON.stringify({
          p_item_id: Number(itemId),
          p_pin: ADMIN_PIN,
        }),
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Item liberado com sucesso.",
        itemId: Number(itemId),
      }),
    };
  } catch (error) {
    console.error("Erro ao liberar item:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "server_error",
        message: error.message || "Erro interno ao liberar item.",
      }),
    };
  }
};
