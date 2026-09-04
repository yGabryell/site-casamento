import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GIFT_STATES_TABLE = "wedding_gift_states";

export function createSupabaseBackend(config) {
  const client = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return {
    mode: "supabase",
    async loadGiftStates() {
      const { data, error } = await client
        .from(GIFT_STATES_TABLE)
        .select("item_id, status, reserved_by")
        .order("item_id", { ascending: true });

      if (error) {
        throw buildError(error, "Nao foi possivel carregar os status dos presentes no Supabase.");
      }

      return (data || []).reduce((accumulator, row) => {
        accumulator[Number(row.item_id)] = {
          status: normalizeGiftStatus(row.status),
          reservedBy: row.reserved_by || "",
        };
        return accumulator;
      }, {});
    },

    async verifyAdminPin(pin) {
      const { data, error } = await client.rpc("wedding_verify_admin_pin", {
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel validar o PIN administrativo no Supabase.");
      }

      return Boolean(data);
    },

    async listPendingRequests(pin) {
      const { data, error } = await client.rpc("wedding_list_pending_requests", {
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel carregar as compras pendentes.");
      }

      return Array.isArray(data) ? data.map(normalizePendingRequest) : [];
    },

    async listRsvpResponses(pin) {
      const { data, error } = await client.rpc("wedding_list_rsvp_responses", {
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel carregar as confirmacoes de presenca.");
      }

      return Array.isArray(data) ? data.map(normalizeRsvpResponse) : [];
    },

    async deleteRsvpResponse(responseId, pin) {
      const { error } = await client.rpc("wedding_delete_rsvp_response", {
        p_response_id: responseId,
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel excluir a confirmacao de presenca.");
      }
    },

    async deletePurchaseItem(itemId, pin) {
      const { error } = await client.rpc("wedding_delete_purchase_item", {
        p_item_id: itemId,
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel excluir o item no Supabase.");
      }
    },

    async setReservation(itemId, guestName, reserve) {
      const { error } = await client.rpc("wedding_set_reservation", {
        p_item_id: itemId,
        p_guest_name: guestName || "",
        p_reserve: reserve,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel atualizar a reserva no Supabase.");
      }
    },

    async submitPurchaseRequest(item, guestName) {
      const { error } = await client.rpc("wedding_submit_purchase_request", {
        p_item_id: item.id,
        p_item_name: item.nome,
        p_guest_name: guestName || "Convidado",
      });

      if (error) {
        throw buildError(error, "Nao foi possivel registrar o pedido de compra no Supabase.");
      }
    },

    async submitRsvpResponse(guestName, attendanceChoice) {
      const normalizedAttendance = normalizeRsvpAttendanceChoice(attendanceChoice);
      const { error } = await client.rpc("wedding_submit_rsvp_response", {
        p_guest_name: guestName || "Convidado",
        p_companion_name: normalizedAttendance === "no" ? "nao" : "sim",
      });

      if (error) {
        throw buildError(error, "Nao foi possivel registrar a confirmacao de presenca.");
      }
    },

    async submitGuestMessage(guestName, guestEmail, messageText) {
      const { error } = await client.rpc("wedding_submit_guest_message", {
        p_guest_name: guestName || "Convidado",
        p_guest_email: guestEmail || "",
        p_message_text: messageText || "",
      });

      if (error) {
        throw buildError(error, "Nao foi possivel registrar a mensagem.");
      }
    },

    async listGuestMessages(pin) {
      const { data, error } = await client.rpc("wedding_list_guest_messages", {
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel carregar as mensagens dos convidados.");
      }

      return Array.isArray(data) ? data.map(normalizeGuestMessage) : [];
    },

    async deleteGuestMessage(messageId, pin) {
      const { error } = await client.rpc("wedding_delete_guest_message", {
        p_message_id: messageId,
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel excluir a mensagem no Supabase.");
      }
    },

    async reviewPurchaseRequest(requestId, pin, action) {
      const { error } = await client.rpc("wedding_review_purchase_request", {
        p_request_id: requestId,
        p_pin: pin,
        p_action: action,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel revisar a compra no Supabase.");
      }
    },

    async resetAll(pin) {
      const { error } = await client.rpc("wedding_reset_all", {
        p_pin: pin,
      });

      if (error) {
        throw buildError(error, "Nao foi possivel resetar os presentes no Supabase.");
      }
    },
  };
}

function normalizeGiftStatus(status) {
  if (status === "pending" || status === "purchased") {
    return status;
  }
  return "available";
}

function normalizePendingRequest(row) {
  return {
    id: row.id,
    itemId: Number(row.item_id),
    itemName: row.item_name,
    guestName: row.guest_name || "Convidado",
    submittedAt: row.submitted_at,
  };
}

function normalizeRsvpResponse(row) {
  return {
    id: row.id,
    guestName: row.guest_name || "Convidado",
    attendanceChoice: normalizeRsvpAttendanceChoice(row.companion_name),
    submittedAt: row.submitted_at,
  };
}

function normalizeGuestMessage(row) {
  return {
    id: row.id,
    guestName: row.guest_name || "Convidado",
    guestEmail: row.guest_email || "",
    messageText: row.message_text || "",
    submittedAt: row.submitted_at,
  };
}

function normalizeRsvpAttendanceChoice(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "nao" || normalized === "no" || normalized === "false" || normalized === "0") {
    return "no";
  }
  return "yes";
}

function buildError(error, fallbackMessage) {
  if (error && typeof error.message === "string" && error.message.trim()) {
    return new Error(error.message.trim());
  }
  return new Error(fallbackMessage);
}

