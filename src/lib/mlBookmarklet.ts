/**
 * Bookmarklet gerador de código para coletar contadores públicos de vendas do Mercado Livre
 * diretamente do navegador renderizado do usuário (bypass do WAF / Cloudflare).
 */

export interface MLCollectorResultItem {
  id?: string
  mlb_id?: string
  title: string
  price?: number
  currency?: string
  condition?: string // 'usado' | 'novo' | 'recondicionado' | etc
  sold_quantity: number | null
  sold_quantity_text?: string
  available_quantity?: number
  permalink?: string
  thumbnail?: string
  seller_name?: string
  is_free_shipping?: boolean
  is_full?: boolean
}

export interface MLCollectorPayload {
  version: string
  source_url: string
  collected_at: string
  search_term?: string
  results_count: number
  with_sales_count: number
  results: MLCollectorResultItem[]
}

/**
 * Retorna o código javascript puro (compactado) para ser usado como bookmarklet.
 * Executa apenas leitura do DOM já renderizado pelo Chrome do usuário.
 * Cria um modal nativo overlay para copiar o JSON com 1 clique ou baixar o arquivo .json.
 */
export function getBookmarkletScript(): string {
  // Código executado no contexto da página do Mercado Livre
  const code = `
(function() {
  try {
    const existingModal = document.getElementById('ml-collector-overlay');
    if (existingModal) existingModal.remove();

    function parseSoldQuantity(text) {
      if (!text) return { qty: null, raw: '' };
      const clean = text.toLowerCase().replace(/\\s+/g, ' ').trim();
      // Casos comuns:
      // "+500 vendidos", "+50 mil vendidos", "+5 mil vendidos", "12 vendidos", "+100 vendas", "+5mil vendidos"
      const milMatch = clean.match(/\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:mil|k)\\s*(?:vendidos?|vendas?)/i);
      if (milMatch) {
        const num = parseFloat(milMatch[1].replace(',', '.'));
        return { qty: Math.round(num * 1000), raw: text.trim() };
      }
      const numMatch = clean.match(/\\+?\\s*(\\d+)\\s*(?:vendidos?|vendas?)/i);
      if (numMatch) {
        return { qty: parseInt(numMatch[1], 10), raw: text.trim() };
      }
      return { qty: null, raw: text.trim() };
    }

    function extractMlbId(url) {
      if (!url) return '';
      const m = url.match(/MLB-?(\\d+)/i);
      return m ? 'MLB' + m[1] : '';
    }

    function parsePrice(text) {
      if (!text) return undefined;
      // remove R$, espaços, pontos de milhar, troca virgula por ponto
      const clean = text.replace(/[^0-9,\\.]/g, '').replace(/\\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    }

    const items = [];
    const sourceUrl = window.location.href;
    const pageTitle = document.title || '';

    // Heurística de termo de busca a partir da URL ou do input de busca do ML
    let searchTerm = '';
    const searchInput = document.querySelector('input.nav-search-input') || document.querySelector('input[name="as_word"]');
    if (searchInput && searchInput.value) {
      searchTerm = searchInput.value.trim();
    } else {
      const urlMatch = sourceUrl.match(/lista\\.mercadolivre\\.com\\.br\\/([^?#]+)/);
      if (urlMatch) {
        searchTerm = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
      }
    }

    // 1. É uma página de anúncio individual?
    const isSingleItemPage = sourceUrl.includes('/p/MLB') || /\\/MLB-?\\d+/i.test(sourceUrl);
    const singleTitleEl = document.querySelector('h1.ui-pdp-title');
    
    if (isSingleItemPage && singleTitleEl) {
      const title = singleTitleEl.textContent.trim();
      let price = undefined;
      const priceMetaEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
      if (priceMetaEl) {
        price = parsePrice(priceMetaEl.textContent);
      }

      // Procurar subtítulo de vendas (ex.: "Novo  |  +1000 vendidos" ou "Usado  |  25 vendidos")
      let soldQty = null;
      let soldRaw = '';
      let condition = '';
      const subtitleEl = document.querySelector('.ui-pdp-subtitle') || document.querySelector('.ui-pdp-header__subtitle');
      if (subtitleEl) {
        const subText = subtitleEl.textContent || '';
        const parsed = parseSoldQuantity(subText);
        soldQty = parsed.qty;
        soldRaw = parsed.raw;
        if (/usado/i.test(subText)) condition = 'usado';
        else if (/recondicionado/i.test(subText)) condition = 'recondicionado';
        else if (/novo/i.test(subText)) condition = 'novo';
      }

      // Procurar seller
      let sellerName = '';
      const sellerEl = document.querySelector('.ui-pdp-seller__link-trigger') || document.querySelector('.ui-seller-info a') || document.querySelector('.ui-pdp-action-modal__link');
      if (sellerEl) sellerName = sellerEl.textContent.trim();

      items.push({
        id: extractMlbId(sourceUrl) || 'MLB_PAGE',
        mlb_id: extractMlbId(sourceUrl),
        title,
        price,
        currency: 'BRL',
        condition: condition || 'usado',
        sold_quantity: soldQty,
        sold_quantity_text: soldRaw,
        permalink: sourceUrl,
        seller_name: sellerName
      });
    } else {
      // 2. É página de lista de busca
      // Seletores comuns de cards no ML
      const cardNodes = document.querySelectorAll(
        '.ui-search-layout__item, .ui-search-result__wrapper, li.ui-search-layout__item, div[class*="ui-search-result"], .poly-card'
      );

      const seenLinks = new Set();

      cardNodes.forEach((card) => {
        // Título e link
        const linkEl = card.querySelector('a.ui-search-link') || card.querySelector('a[href*="MLB"]') || card.querySelector('a.poly-component__title') || card.querySelector('h2 a') || card.querySelector('a');
        if (!linkEl) return;

        const permalink = linkEl.href || '';
        const mlbId = extractMlbId(permalink);
        if (permalink && seenLinks.has(permalink)) return;
        if (permalink) seenLinks.add(permalink);

        const titleEl = card.querySelector('h2') || card.querySelector('.ui-search-item__title') || card.querySelector('.poly-component__title') || linkEl;
        const title = (titleEl ? titleEl.textContent : '').trim();
        if (!title) return;

        // Preço
        let price = undefined;
        const fractionEl = card.querySelector('.andes-money-amount__fraction') || card.querySelector('.price-tag-fraction');
        if (fractionEl) {
          price = parsePrice(fractionEl.textContent);
        }

        // Contador de vendas: varrer todos os elementos de texto do card buscando pistas de "+X vendidos"
        let soldQty = null;
        let soldRaw = '';

        // Seletor específico de reviews / vendidos se houver
        const polyReviewsEl = card.querySelector('.poly-reviews__total') || card.querySelector('.ui-search-reviews__amount') || card.querySelector('.poly-component__sales');
        if (polyReviewsEl) {
          const parsed = parseSoldQuantity(polyReviewsEl.textContent);
          if (parsed.qty != null) {
            soldQty = parsed.qty;
            soldRaw = parsed.raw;
          }
        }

        if (soldQty == null) {
          // Varredura por texto em spans / parágrafos do card
          const textNodes = card.querySelectorAll('span, p, div');
          for (const node of textNodes) {
            // Ignora nós que têm muitos filhos
            if (node.children.length > 2) continue;
            const t = (node.textContent || '').trim();
            if (/vendidos?|vendas?/i.test(t)) {
              const parsed = parseSoldQuantity(t);
              if (parsed.qty != null) {
                soldQty = parsed.qty;
                soldRaw = parsed.raw;
                break;
              }
            }
          }
        }

        // Condição
        let condition = undefined;
        const cardText = card.textContent || '';
        if (/\\busado\\b/i.test(cardText)) condition = 'usado';
        else if (/\\brecondicionado\\b/i.test(cardText)) condition = 'recondicionado';
        else if (/\\bnovo\\b/i.test(cardText)) condition = 'novo';

        // Seller
        let sellerName = '';
        const sellerEl = card.querySelector('.ui-search-official-store-label') || card.querySelector('.ui-search-item__brand-discoverability') || card.querySelector('.poly-component__seller');
        if (sellerEl) {
          sellerName = sellerEl.textContent.replace(/por\\s+/i, '').trim();
        }

        // Imagem
        const imgEl = card.querySelector('img');
        const thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

        // Frete / Full
        const isFull = Boolean(card.querySelector('.ui-search-item__fulfillment') || card.querySelector('.poly-component__shipped-from'));
        const isFreeShipping = /frete gr[áa]tis/i.test(cardText);

        items.push({
          id: mlbId || 'MLB_' + (items.length + 1),
          mlb_id: mlbId,
          title,
          price,
          currency: 'BRL',
          condition,
          sold_quantity: soldQty,
          sold_quantity_text: soldRaw,
          permalink,
          thumbnail,
          seller_name: sellerName,
          is_free_shipping: isFreeShipping,
          is_full: isFull
        });
      });
    }

    const withSalesCount = items.filter(i => i.sold_quantity != null && i.sold_quantity > 0).length;

    const payload = {
      version: '1.0.0',
      source_url: sourceUrl,
      collected_at: new Date().toISOString(),
      search_term: searchTerm,
      results_count: items.length,
      with_sales_count: withSalesCount,
      results: items
    };

    const jsonStr = JSON.stringify(payload, null, 2);

    // Modal overlay nativo no DOM do ML
    const overlay = document.createElement('div');
    overlay.id = 'ml-collector-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.8);backdrop-filter:blur(4px);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#ffffff;color:#0f172a;width:100%;max-width:640px;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;border:1px solid #cbd5e1;display:flex;flex-direction:column;max-height:90vh;';

    box.innerHTML = \`
      <div style="padding:16px 20px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#38bdf8;"></span>
          <strong style="font-size:16px;font-weight:700;">Coletor do Navegador · Mercado Livre</strong>
        </div>
        <button id="ml-collector-close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;">&times;</button>
      </div>
      <div style="padding:18px 20px;overflow-y:auto;flex:1;">
        <div style="display:flex;gap:12px;margin-bottom:14px;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Termo Detectado</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">\${searchTerm || 'Página do Mercado Livre'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Anúncios Lidos</div>
            <div style="font-size:16px;font-weight:800;color:#0284c7;">\${items.length}</div>
          </div>
          <div style="text-align:right;border-left:1px solid #cbd5e1;padding-left:12px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Com Vendas Reais</div>
            <div style="font-size:16px;font-weight:800;color:#16a34a;">\${withSalesCount}</div>
          </div>
        </div>

        <p style="font-size:12px;color:#475569;margin-bottom:8px;">
          JSON gerado com sucesso! Clique em <strong>Copiar JSON</strong> e cole no aplicativo do sistema (ou baixe o arquivo).
        </p>

        <textarea id="ml-collector-json-textarea" readonly style="width:100%;height:180px;font-family:monospace;font-size:11px;padding:10px;border-radius:6px;border:1px solid #cbd5e1;background:#f1f5f9;color:#0f172a;resize:none;box-sizing:border-box;">\${jsonStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>

        <div id="ml-collector-feedback" style="display:none;margin-top:8px;padding:8px 12px;background:#dcfce7;color:#166534;border-radius:6px;font-size:12px;font-weight:600;text-align:center;">
          ✓ JSON copiado para a área de transferência! Cole agora no app de Lotes.
        </div>
      </div>
      <div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;">
        <button id="ml-collector-download-btn" style="padding:8px 14px;border-radius:6px;background:#ffffff;border:1px solid #cbd5e1;color:#334155;font-size:12px;font-weight:600;cursor:pointer;">
          Baixar .json
        </button>
        <button id="ml-collector-copy-btn" style="padding:8px 18px;border-radius:6px;background:#0284c7;border:none;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;">
          Copiar JSON
        </button>
      </div>
    \`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('ml-collector-close');
    closeBtn.addEventListener('click', () => overlay.remove());

    const copyBtn = document.getElementById('ml-collector-copy-btn');
    const feedback = document.getElementById('ml-collector-feedback');
    const textarea = document.getElementById('ml-collector-json-textarea');

    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(jsonStr);
        } else {
          textarea.select();
          document.execCommand('copy');
        }
        feedback.style.display = 'block';
        copyBtn.textContent = '✓ Copiado!';
        copyBtn.style.background = '#16a34a';
      } catch (err) {
        textarea.select();
        document.execCommand('copy');
        feedback.style.display = 'block';
      }
    });

    const downloadBtn = document.getElementById('ml-collector-download-btn');
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTerm = (searchTerm || 'mercadolivre').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.href = url;
      a.download = 'ml_coleta_' + safeTerm + '_' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

  } catch (err) {
    alert('Erro ao executar Coletor do Mercado Livre: ' + (err && err.message ? err.message : err));
  }
})();
  `.trim()

  // Converte em URI bookmarklet seguro: javascript:(...)
  return 'javascript:' + encodeURIComponent(code)
}
