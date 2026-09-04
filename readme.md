# Site de Casamento (Mobile-First)

Projeto em HTML + CSS + JavaScript puro para convidados visualizarem informações do evento, escolherem presentes e confirmarem compras com identificação por nome.

## Estrutura

```text
/
  index.html
  styles.css
  script.js
  supabase-backend.js
  data/
    items.js
  supabase/
    setup.sql
    README.md
  assets/
    bg.jpg
    photos/
      photo1.jpg ... photo5.jpg
    items/
      item1.jpg ... item6.jpg
```

## Como executar

Você pode abrir `index.html` diretamente no navegador.

Para ambiente local com servidor (recomendado):

```bash
npx serve .
```

Depois abra a URL exibida no terminal (geralmente `http://localhost:3000`).

## Onde editar conteúdo

1. `script.js` (objeto `CONFIG` no topo):
   - nomes do casal
   - data e cidade
   - PIN administrativo (`adminPin`) para proteger reset
   - backend (`local` ou `supabase`)
   - telefone WhatsApp
   - links e caminhos de imagens
2. `data/items.js`:
   - lista de presentes (nome, descrição, preço, imagem, links e status)
3. `index.html`:
   - textos gerais, FAQ e informações fixas

## Recursos implementados

- Layout mobile-first (otimizado para 360x800 e responsivo)
- Hero com fundo + overlay, botoes e contagem regressiva
- Carrossel de fotos com swipe touch, botoes e indicadores
- Lista de presentes dinâmica com busca e filtro por preço
- Modal de compra com nome, abertura do link externo e confirmação manual da compra
- Estado intermediário `Aguardando` para itens com compra informada e ainda não validada
- Aba "Mensagens aos noivos" com formulário (nome, e-mail, mensagem) e mural de mensagens recebidas
- Painel administrativo com PIN, fila de compras pendentes e ações de aprovar/rejeitar
- Lista "Itens comprados" com item + nome de quem teve a compra confirmada
- Resumo automático de total arrecadado no painel administrativo
- Botão "Excluir item teste" no painel para liberar item comprado sem ir ao Supabase
- Integração opcional com Supabase para sincronizar celular e PC
- Persistencia com `localStorage` para:
  - nome do convidado
  - status dos itens
  - compras pendentes
- Navegação inferior fixa com destaque de seção ativa
- FAQ em acordeão e animações suaves de entrada

## Observações importantes

- Sem configurar backend, o site continua funcionando em modo local e salva tudo no navegador.
- Para sincronizar celular e PC, ative o modo Supabase seguindo [`supabase/README.md`](/C:/Users/Gabriel/OneDrive/Documentos/Site Casamento/supabase/README.md).
- Nesta versão, a compra é registrada apenas com o nome informado pelo convidado.
- As imagens atuais são placeholders em `.jpg`.
- O PIN padrão do painel administrativo está em `CONFIG.adminPin` no `script.js`. Troque antes de compartilhar.
