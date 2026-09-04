# Setup do Supabase

## 1. Criar o projeto

Crie um projeto no Supabase e copie:

- `Project URL`
- `anon public key`

## 2. Rodar o SQL

No SQL Editor do Supabase, execute o arquivo:

- [`supabase/setup.sql`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/setup.sql)

Se voce ja tinha configurado o projeto antes e so quer adicionar a nova confirmacao de presenca, pode rodar apenas:

- [`supabase/rsvp-migration.sql`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/rsvp-migration.sql)
- [`supabase/messages-admin-migration.sql`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/messages-admin-migration.sql)
- [`supabase/messages-delete-migration.sql`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/messages-delete-migration.sql)

Para aplicar o novo fluxo de compra sem envio de comprovante e habilitar a aba de mensagens aos noivos, rode novamente o [`supabase/setup.sql`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/setup.sql) (ele atualiza funções, tabelas e defaults).

Antes de salvar, troque o valor inicial do PIN nesta linha:

```sql
insert into public.wedding_admin_settings (id, admin_pin)
values (1, 'TROQUE-ESTE-PIN')
```

Se o registro ja existir, rode depois:

```sql
update public.wedding_admin_settings
set admin_pin = 'SEU-PIN-FORTE'
where id = 1;
```

## 3. Ativar o frontend

No arquivo [`script.js`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/script.js), preencha:

```js
backend: {
  provider: "supabase",
  supabaseUrl: "https://bvbckfajmkfiajjymkmu.supabase.co",
  supabaseAnonKey: "sb_publishable_4tijqvw0v2NFeD6Lg8q_9w_wvDw6SyL",
  receiptsBucket: "wedding-receipts", // opcional no fluxo atual
},
```

## 4. Como o fluxo passa a funcionar

- convidado preenche o nome e confirma a compra no celular
- o pedido entra como `pending` no banco
- o item fica `Aguardando` para todo mundo
- o convidado confirma presença no próprio site, informando apenas o nome
- a resposta fica salva na tabela `wedding_rsvp_responses`
- o convidado também pode enviar mensagens para os noivos
- as mensagens ficam salvas na tabela `wedding_guest_messages`
- as mensagens deixam de aparecer para todos e passam a ficar visíveis apenas no painel administrativo
- no painel administrativo do PC, voce informa o PIN
- o site carrega as compras pendentes e as confirmações de presença
- ao aprovar ou rejeitar, o status atualiza para todos os dispositivos
- na lista "Itens comprados", você pode usar "Excluir item teste" para limpar compras de teste e liberar o item novamente
- quando quiser levar para Excel, você pode baixar o CSV direto no painel administrativo do site

## 5. Observacao importante

O SQL ainda cria o bucket `wedding-receipts` por compatibilidade com fluxos anteriores, mas no fluxo atual (sem envio de comprovante) ele nao e utilizado pelo frontend.
