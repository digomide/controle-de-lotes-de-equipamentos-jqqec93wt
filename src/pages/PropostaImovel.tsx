import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Printer,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  Scale,
  FileCheck2,
  FileText,
  BadgePercent,
  Banknote,
  AlertCircle,
  Home,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface InstallmentRow {
  mes: number
  competencia: string
  valor: number
  saldoDevedor: number
  descricao: string
}

export const PropostaImovel: React.FC = () => {
  const handlePrint = () => {
    window.print()
  }

  // Formatação em pt-BR
  const formatBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Dados centrais
  const valorReferencia = 350000
  const valorOferta = 245000
  const descontoPercentual = 30 // 70% do valor de referência
  const descontoValor = valorReferencia - valorOferta // 105.000
  const entradaDivida = 45000
  const saldoFinanciado = 200000
  const totalParcelas = 29
  const itbiEstimado = 7350 // ~3% sobre a oferta
  const escrituraRegistroEstimado = 5000
  const custosTransferencia = 12350 // ~R$ 12.000
  const totalComprometimento = valorOferta + custosTransferencia // R$ 257.350

  // Gera cronograma das 29 parcelas
  const parcelas: InstallmentRow[] = useMemo(() => {
    const list: InstallmentRow[] = []
    let saldo = saldoFinanciado
    const dataInicial = new Date()
    // Início no mês seguinte à assinatura
    dataInicial.setMonth(dataInicial.getMonth() + 1)

    for (let i = 1; i <= totalParcelas; i++) {
      const valor = i === totalParcelas ? 6000 : 7000
      saldo = Math.max(0, saldo - valor)

      const mesData = new Date(dataInicial)
      mesData.setMonth(dataInicial.getMonth() + (i - 1))
      const nomeMes = mesData.toLocaleString('pt-BR', { month: 'short' }).replace('.', '')
      const ano = mesData.getFullYear()
      const competencia = `${nomeMes.toUpperCase()}/${ano}`

      list.push({
        mes: i,
        competencia,
        valor,
        saldoDevedor: saldo,
        descricao:
          i === totalParcelas
            ? '29ª Parcela (Ajuste Final de Quitação)'
            : `${i}ª Parcela Mensal Fixa`,
      })
    }
    return list
  }, [saldoFinanciado, totalParcelas])

  // Amostras de anúncios no bairro Floresta
  const amostrasMercado = [
    { endereco: 'Rua Curvelo, Floresta', area: '70 m²', valor: 380000, m2: 5428 },
    { endereco: 'Rua Jacuí, Floresta', area: '60 m²', valor: 400000, m2: 6666 },
    { endereco: 'Av. do Contorno, Floresta', area: '50 m²', valor: 380000, m2: 7600 },
    { endereco: 'Rua Curvelo, Floresta', area: '60 m²', valor: 370000, m2: 6166 },
  ]

  // Data atual formatada para o documento
  const hojeFormatado = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 sm:px-6 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* BARRA DE AÇÕES SUPERIOR (TELA / OCULTA NA IMPRESSÃO) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-xs border border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao sistema
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm sm:text-base">
                Proposta Formal de Compra e Venda
              </span>
              <Badge className="bg-emerald-600 text-white font-semibold text-xs border-none">
                Oferta: R$ 245.000,00
              </Badge>
              <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                Apto 905 · Av. Francisco Sales, 40
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Documento formal formatado para impressão A4 e exportação em PDF. Oculta menus e
              barras ao imprimir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xs text-xs sm:text-sm px-4 h-9"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO PRINCIPAL A4 IMPRIMÍVEL */}
      <div
        id="proposta-imovel-doc"
        className="proposta-sheet bg-white text-slate-900 mx-auto shadow-md print:shadow-none print:m-0 print:border-none border border-slate-300"
        style={{
          width: '210mm',
          minHeight: '297mm',
          boxSizing: 'border-box',
          padding: '12mm 15mm 12mm 15mm',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: '11px',
          lineHeight: 1.4,
          color: '#0f172a',
        }}
      >
        {/* CABEÇALHO DO DOCUMENTO COM LINHA INSTITUCIONAL */}
        <header className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 block">
                    Instrumento Particular de Apresentação
                  </span>
                  <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                    PROPOSTA DE COMPRA E VENDA — APARTAMENTO RESIDENCIAL
                  </h1>
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-700 mt-1 pl-10">
                Avenida Francisco Sales, nº 40, Apto 905 — Floresta, Belo Horizonte/MG
              </p>
            </div>
            <div className="text-right text-[10px] text-slate-500 shrink-0">
              <div className="font-semibold text-slate-700">Data de Emissão</div>
              <div>{hojeFormatado}</div>
              <div className="text-slate-400 mt-0.5">Belo Horizonte — MG</div>
            </div>
          </div>
        </header>

        {/* 1. DADOS DO IMÓVEL */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <Building2 className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              1. Dados do Imóvel
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Localização / Endereço
              </span>
              <strong className="text-slate-900 block leading-tight text-[11px] mt-0.5">
                Av. Francisco Sales, nº 40, Apto 905
              </strong>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                Floresta — Belo Horizonte, MG — CEP 30150-210 (Região Centro)
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Área Privativa & Prédio
              </span>
              <strong className="text-slate-900 block text-xs mt-0.5">70,09 m² privativos</strong>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                Fração ideal: 0,006873 (~145 unidades no condomínio)
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                Padrão & Zoneamento
              </span>
              <strong className="text-slate-900 block text-xs mt-0.5">
                AP3 / P3 · Zona C31/ZA
              </strong>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                Edifício antigo, imóvel necessitando de reforma integral
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">
                IPTU & Valor Venal
              </span>
              <strong className="text-slate-900 block text-xs mt-0.5">IPTU 2026 Quitado</strong>
              <span className="text-[10px] text-slate-600 block mt-0.5">
                Anual: R$ 1.482,99 (~R$ 135/mês) · Venal: R$ 95.262 (~R$ 1.360/m²)
              </span>
            </div>
          </div>
        </section>

        {/* 2. ANÁLISE DE VALOR DE MERCADO */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <Scale className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              2. Análise de Valor de Mercado (Apresentada em Faixas com Cautela)
            </h2>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded p-2 mb-2 text-[10.5px] text-amber-900 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
            <div>
              <strong>Referência Principal no Edifício:</strong> Registro informal de venda recente
              (há ~3 meses) de apartamento similar no <em>mesmo prédio</em> na ordem de{' '}
              <strong>R$ 350.000,00</strong>. Dado tratado com prudência como{' '}
              <span className="underline">referência a confirmar via síndico/guia de ITBI</span>.
            </div>
          </div>

          {/* Gráfico Vetorial / Barra de Faixas de Avaliação */}
          <div className="border border-slate-200 rounded p-2.5 bg-slate-50 mb-2.5">
            <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-700 mb-1.5">
              <span>Faixas de Avaliação de Mercado (Imóvel Reformado / Pleno vs. Atual):</span>
              <span className="text-slate-500 font-normal">Base: 70,09 m² privativos</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white border border-slate-300 rounded p-2 text-center">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                  Cenário Conservador
                </span>
                <div className="text-sm font-extrabold text-slate-800 mt-0.5">R$ 300.000,00</div>
                <div className="text-[9px] text-slate-500">
                  ~R$ 4.280/m² (estado atual s/ reforma)
                </div>
              </div>

              <div className="bg-blue-50/80 border-2 border-blue-400 rounded p-2 text-center relative">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8.5px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                  Referência Adotada
                </div>
                <span className="text-[9.5px] font-bold text-blue-900 uppercase block">
                  Cenário Base (Mesmo Prédio)
                </span>
                <div className="text-sm font-black text-blue-900 mt-0.5">
                  R$ 330.000 a R$ 350.000
                </div>
                <div className="text-[9px] text-blue-800 font-medium">
                  Adotado: <strong>R$ 350.000,00</strong> (~R$ 4.993/m²)
                </div>
              </div>

              <div className="bg-white border border-slate-300 rounded p-2 text-center">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">
                  Cenário Otimista
                </span>
                <div className="text-sm font-extrabold text-slate-800 mt-0.5">R$ 380.000,00</div>
                <div className="text-[9px] text-slate-500">
                  ~R$ 5.420/m² (totalmente modernizado)
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Amostras de Anúncios Ativos */}
          <div>
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>
                Amostragem de Anúncios Ativos no Bairro Floresta (Faixa: R$ 5.400 a R$ 6.700/m²)
              </span>
              <span className="text-slate-500 font-normal">Pesquisa comparativa imobiliária</span>
            </div>
            <table className="w-full text-left border-collapse text-[10px] border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                  <th className="py-1 px-2 border-r border-slate-200">Endereço / Logradouro</th>
                  <th className="py-1 px-2 text-center border-r border-slate-200">Área Útil</th>
                  <th className="py-1 px-2 text-right border-r border-slate-200">
                    Preço Anunciado
                  </th>
                  <th className="py-1 px-2 text-right border-r border-slate-200">Preço / m²</th>
                  <th className="py-1 px-2">Situação / Características</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {amostrasMercado.map((amostra, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="py-1 px-2 border-r border-slate-200 font-medium text-slate-900">
                      {amostra.endereco}
                    </td>
                    <td className="py-1 px-2 text-center border-r border-slate-200">
                      {amostra.area}
                    </td>
                    <td className="py-1 px-2 text-right border-r border-slate-200 font-mono">
                      {formatBRL(amostra.valor)}
                    </td>
                    <td className="py-1 px-2 text-right border-r border-slate-200 font-mono text-slate-700">
                      {formatBRL(amostra.m2)}/m²
                    </td>
                    <td className="py-1 px-2 text-slate-500">
                      Anúncio ativo em portal (valores de pedida sujeitos a negociação)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. A PROPOSTA (DESTAQUE VISUAL MÁXIMO) */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <BadgePercent className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              3. A Proposta Formal de Compra
            </h2>
          </div>

          <div className="bg-slate-900 text-white rounded-lg p-3.5 shadow-xs mb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Valor de Referência Adotado
                </span>
                <div className="text-xl font-bold text-slate-200 mt-0.5">
                  {formatBRL(valorReferencia)}
                </div>
                <span className="text-[9.5px] text-slate-400 block">
                  100% da avaliação máxima do mesmo prédio
                </span>
              </div>

              <div className="border-y sm:border-y-0 sm:border-x border-slate-700 py-2 sm:py-0 sm:px-3 text-center">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  Proposta de Aquisição (70%)
                </span>
                <div className="text-2xl font-black text-emerald-300 mt-0.5">
                  {formatBRL(valorOferta)}
                </div>
                <span className="text-[9.5px] text-emerald-200/80 block font-medium">
                  Desconto justo de {descontoPercentual}% ({formatBRL(descontoValor)})
                </span>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Estrutura de Quitação
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  R$ 45.000 entrada + 29x R$ 7.000*
                </div>
                <span className="text-[9.5px] text-slate-400 block">
                  *Última parcela ajustada para R$ 6.000,00
                </span>
              </div>
            </div>
          </div>

          {/* Justificativa do Desconto */}
          <div className="border border-slate-200 rounded p-2.5 bg-slate-50 text-[10.5px]">
            <strong className="text-slate-900 block mb-1">
              Justificativas Técnicas do Coeficiente de 70% da Proposta:
            </strong>
            <ul className="space-y-1 text-slate-700 list-disc list-inside">
              <li>
                <strong>(a) Reserva de Usufruto Vitalício:</strong> O proponente adquire a{' '}
                <em>nua-propriedade</em> e renuncia à posse direta imediata, mantendo a proprietária
                com garantia de moradia e fruição vitalícia. A nua-propriedade possui valor de
                mercado expressivamente inferior à propriedade plena.
              </li>
              <li>
                <strong>(b) Estado de Conservação:</strong> Trata-se de edificação antiga com
                necessidade premente de reforma integral de instalações elétricas, hidráulicas,
                esquadrias e revestimentos a expensas do adquirente.
              </li>
              <li>
                <strong>(c) Liquidez Imediata e Resolução Judicial:</strong> Extinção completa do
                passivo judicial das cuidadoras com quitação em dinheiro sem deságio contra a
                família, eliminando risco de penhora ou leilão judicial.
              </li>
            </ul>
          </div>
        </section>

        {/* 4. CONDIÇÕES DE PAGAMENTO */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <Banknote className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              4. Condições e Cronograma de Pagamento
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
            {/* ENTRADA */}
            <div className="border border-slate-300 rounded p-2.5 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Entrada Vinculada
                </span>
                <span className="text-xs font-black text-slate-900">
                  {formatBRL(entradaDivida)}
                </span>
              </div>
              <p className="text-[10px] text-slate-700 leading-tight">
                <strong>Assunção Formal da Dívida Judicial:</strong> Processo trabalhista movido por
                ex-cuidadoras. O valor de <strong>R$ 45.000,00</strong> será pago diretamente às
                credoras pelo comprador mediante recibo e petição de quitação judicial, conforme
                cronograma acordado com parcelas de <strong>R$ 5.000,00</strong> e{' '}
                <strong>R$ 15.000,00</strong> até o fim do ano corrente. O montante é integralmente
                abatido do preço da compra.
              </p>
            </div>

            {/* SALDO FINANCIADO */}
            <div className="border border-slate-300 rounded p-2.5 bg-white">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">
                  Saldo Financiado
                </span>
                <span className="text-xs font-black text-slate-900">
                  {formatBRL(saldoFinanciado)}
                </span>
              </div>
              <p className="text-[10px] text-slate-700 leading-tight">
                <strong>29 Parcelas Mensais:</strong> Saldo de <strong>R$ 200.000,00</strong> pago
                diretamente à família/proprietária em 29 parcelas mensais sucessivas: 28 parcelas
                fixas de <strong>R$ 7.000,00</strong> e a última (29ª) ajustada para{' '}
                <strong>R$ 6.000,00</strong> (28 × 7.000 = 196.000 + 6.000 = R$ 200.000,00 exatos),
                iniciando no mês subsequente à formalização da assinatura.
              </p>
            </div>
          </div>

          {/* CUSTOS DE TRANSFERÊNCIA */}
          <div className="border border-slate-200 rounded p-2 bg-slate-50 mb-2.5 flex items-start justify-between gap-3 text-[10px]">
            <div>
              <strong className="text-slate-900 block">
                Custos de Transferência Cartorária e Tributária (Assumidos Integralmente pelo
                Comprador):
              </strong>
              <span className="text-slate-600 block mt-0.5">
                ITBI 3% (~R$ 7.350,00 sobre a oferta de R$ 245.000,00) + Escritura Pública e
                Registro de Imóveis (~R$ 5.000,00).{' '}
                <strong>Total estimado de R$ 12.000,00 a R$ 12.350,00</strong>, desonerando 100% a
                vendedora.
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9.5px] uppercase font-bold text-slate-500 block">
                Custo Adicional
              </span>
              <strong className="text-xs text-slate-900 font-mono">~R$ 12.350,00</strong>
            </div>
          </div>

          {/* TABELA CRONOLÓGICA DAS 29 PARCELAS (EM DUAS COLUNAS PARA COMPACIDADE E QUEBRA SUAVE) */}
          <div className="cronograma-parcelas-wrapper">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                Cronograma Mês a Mês do Saldo Financiado (29 Parcelas — Saldo R$ 200.000,00)
              </span>
              <span className="text-[9px] text-slate-500">
                Datas projetadas a partir do mês seguinte à formalização
              </span>
            </div>

            {/* Layout em 2 colunas: Parcelas 1 a 15 / Parcelas 16 a 29 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9.5px]">
              {/* Coluna 1 (Mês 1 a 15) */}
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="py-0.5 px-1.5 border-r border-slate-200 text-center w-8">Mês</th>
                    <th className="py-0.5 px-1.5 border-r border-slate-200 w-16">Prev.</th>
                    <th className="py-0.5 px-1.5 border-r border-slate-200 text-right">Parcela</th>
                    <th className="py-0.5 px-1.5 text-right">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {parcelas.slice(0, 15).map((p) => (
                    <tr key={p.mes} className="border-b border-slate-200">
                      <td className="py-0.5 px-1.5 border-r border-slate-200 text-center font-bold text-slate-800">
                        {p.mes}º
                      </td>
                      <td className="py-0.5 px-1.5 border-r border-slate-200 text-slate-600 font-sans">
                        {p.competencia}
                      </td>
                      <td className="py-0.5 px-1.5 border-r border-slate-200 text-right font-bold text-slate-900">
                        {formatBRL(p.valor)}
                      </td>
                      <td className="py-0.5 px-1.5 text-right text-slate-700">
                        {formatBRL(p.saldoDevedor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Coluna 2 (Mês 16 a 29) */}
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                    <th className="py-0.5 px-1.5 border-r border-slate-200 text-center w-8">Mês</th>
                    <th className="py-0.5 px-1.5 border-r border-slate-200 w-16">Prev.</th>
                    <th className="py-0.5 px-1.5 border-r border-slate-200 text-right">Parcela</th>
                    <th className="py-0.5 px-1.5 text-right">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {parcelas.slice(15, 29).map((p) => (
                    <tr
                      key={p.mes}
                      className={`border-b border-slate-200 ${
                        p.mes === 29 ? 'bg-emerald-50/70 font-semibold' : ''
                      }`}
                    >
                      <td className="py-0.5 px-1.5 border-r border-slate-200 text-center font-bold text-slate-800">
                        {p.mes}º
                      </td>
                      <td className="py-0.5 px-1.5 border-r border-slate-200 text-slate-600 font-sans">
                        {p.competencia}
                      </td>
                      <td
                        className={`py-0.5 px-1.5 border-r border-slate-200 text-right font-bold ${
                          p.mes === 29 ? 'text-emerald-800' : 'text-slate-900'
                        }`}
                      >
                        {formatBRL(p.valor)}
                      </td>
                      <td
                        className={`py-0.5 px-1.5 text-right ${
                          p.mes === 29 ? 'text-emerald-800 font-bold' : 'text-slate-700'
                        }`}
                      >
                        {p.saldoDevedor === 0 ? 'R$ 0,00 (Quitado)' : formatBRL(p.saldoDevedor)}
                      </td>
                    </tr>
                  ))}
                  {/* Linha de preenchimento para emparelhar com a coluna 1 */}
                  <tr className="bg-slate-50 text-slate-400">
                    <td colSpan={4} className="py-0.5 px-1.5 text-center font-sans text-[9px]">
                      Total amortizado do saldo financiado: <strong>R$ 200.000,00</strong> em 29
                      meses
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5. ESTRUTURA JURÍDICA E PROTEÇÕES */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              5. Estrutura Jurídica e Cláusulas de Proteção Mútua
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
            <div className="border border-slate-200 rounded p-2 bg-slate-50 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900">
                  Reserva de Usufruto Vitalício na Matrícula:
                </strong>
                <p className="text-slate-600 mt-0.5">
                  Aquisição exclusiva da nua-propriedade, com gravação de usufruto vitalício formal
                  em favor da proprietária no Cartório de Registro de Imóveis, assegurando moradia e
                  posse direta perpétua.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-2 bg-slate-50 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900">Laudo Médico de Lucidez:</strong>
                <p className="text-slate-600 mt-0.5">
                  Apresentação de atestado/laudo de higidez mental e plena lucidez da proprietária
                  no ato da assinatura, conferindo segurança jurídica irretratável perante terceiros
                  e herdeiros.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-2 bg-slate-50 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900">
                  Assunção e Quitação da Dívida Trabalhista:
                </strong>
                <p className="text-slate-600 mt-0.5">
                  Instrumento com interveniência e anuência expressa das credoras e advogados, com
                  recibos de pagamento depositados e comprovação de baixa do passivo no processo
                  judicial.
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded p-2 bg-slate-50 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-900">Due Diligence Imobiliária Completa:</strong>
                <p className="text-slate-600 mt-0.5">
                  Exibição de certidão de matrícula atualizada (ônus reais e ações
                  reipersecutórias), certidão negativa de débitos condominiais e minuta elaborada
                  por advogado imobilista.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. RESUMO FINANCEIRO CONSOLIDADO */}
        <section className="mb-4">
          <div className="flex items-center gap-1.5 pb-1 mb-2 border-b border-slate-200">
            <FileCheck2 className="w-3.5 h-3.5 text-slate-700" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              6. Resumo Financeiro Consolidado da Operação
            </h2>
          </div>

          <table className="w-full text-left border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                <th className="py-1.5 px-2.5 border-r border-slate-200">
                  Item / Conceito Financeiro
                </th>
                <th className="py-1.5 px-2.5 border-r border-slate-200 text-center">Referência</th>
                <th className="py-1.5 px-2.5 border-r border-slate-200 text-right">
                  Valor Nominal
                </th>
                <th className="py-1.5 px-2.5">Detalhamento / Prazos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="border-b border-slate-200 bg-white">
                <td className="py-1 px-2.5 border-r border-slate-200 font-medium">
                  Valor de Referência de Mercado (Adoção)
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                  100%
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                  {formatBRL(valorReferencia)}
                </td>
                <td className="py-1 px-2.5 text-slate-600 text-[10.5px]">
                  Base em venda recente de similar no mesmo condomínio
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-emerald-50/40">
                <td className="py-1 px-2.5 border-r border-slate-200 font-bold text-emerald-950">
                  Oferta Formal da Proposta de Compra
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-center font-bold text-emerald-800 font-mono">
                  70%
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-right font-mono font-black text-emerald-900 text-sm">
                  {formatBRL(valorOferta)}
                </td>
                <td className="py-1 px-2.5 text-emerald-900 text-[10.5px] font-medium">
                  Preço final fechado para aquisição da nua-propriedade
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-white">
                <td className="py-1 px-2.5 border-r border-slate-200 text-slate-700">
                  (−) Entrada via Assunção de Dívida Judicial
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                  Abatimento
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-rose-700">
                  − {formatBRL(entradaDivida)}
                </td>
                <td className="py-1 px-2.5 text-slate-600 text-[10.5px]">
                  Pagamento direto às credoras (R$ 5.000 + R$ 15.000 ano corrente)
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-white">
                <td className="py-1 px-2.5 border-r border-slate-200 text-slate-700">
                  Saldo Parcelado à Vendedora / Família
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                  29 meses
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                  {formatBRL(saldoFinanciado)}
                </td>
                <td className="py-1 px-2.5 text-slate-600 text-[10.5px]">
                  28 parcelas fixas de R$ 7.000,00 + última ajustada de R$ 6.000,00
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-white">
                <td className="py-1 px-2.5 border-r border-slate-200 text-slate-700">
                  Custos de Transferência (ITBI + Escritura + Registro)
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-center text-slate-500 font-mono">
                  Comprador
                </td>
                <td className="py-1 px-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-800">
                  ~ {formatBRL(custosTransferencia)}
                </td>
                <td className="py-1 px-2.5 text-slate-600 text-[10.5px]">
                  Despesa 100% assumida pelo comprador sem dedução da oferta
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-900 text-white font-bold">
              <tr>
                <td className="py-2 px-2.5 border-r border-slate-700 uppercase tracking-wide">
                  Comprometimento Financeiro Total do Proponente
                </td>
                <td className="py-2 px-2.5 border-r border-slate-700 text-center text-emerald-400 font-mono">
                  Total
                </td>
                <td className="py-2 px-2.5 border-r border-slate-700 text-right font-mono text-base font-black text-emerald-300">
                  {formatBRL(totalComprometimento)}
                </td>
                <td className="py-2 px-2.5 text-slate-300 text-[10.5px] font-normal">
                  R$ 245.000 (preço) + R$ 12.350 (custas) ao longo de ~29 meses
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        {/* 7. RODAPÉ DO DOCUMENTO E ASSINATURAS */}
        <section className="mt-6 pt-2 border-t-2 border-slate-900 break-inside-avoid">
          <div className="mb-6">
            <span className="text-[10.5px] text-slate-600 block text-center">
              Belo Horizonte/MG, {hojeFormatado}.
            </span>
          </div>

          {/* Linhas de Assinatura */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-[10px] mb-6">
            <div>
              <div className="border-b border-slate-900 h-10 mb-1.5"></div>
              <strong className="text-slate-900 block text-[10.5px]">PROPONENTE / COMPRADOR</strong>
              <span className="text-slate-500">CPF: ___________________</span>
            </div>

            <div>
              <div className="border-b border-slate-900 h-10 mb-1.5"></div>
              <strong className="text-slate-900 block text-[10.5px]">
                PROPRIETÁRIA / VENDEDORA
              </strong>
              <span className="text-slate-500">CPF: ___________________</span>
            </div>

            <div>
              <div className="border-b border-slate-900 h-10 mb-1.5"></div>
              <strong className="text-slate-900 block text-[10.5px]">TESTEMUNHA 1</strong>
              <span className="text-slate-500">CPF: ___________________</span>
            </div>

            <div>
              <div className="border-b border-slate-900 h-10 mb-1.5"></div>
              <strong className="text-slate-900 block text-[10.5px]">TESTEMUNHA 2</strong>
              <span className="text-slate-500">CPF: ___________________</span>
            </div>
          </div>

          {/* Nota Legal de Rodapé */}
          <div className="p-2 rounded bg-slate-100 border border-slate-300 text-[9.5px] text-slate-600 text-center leading-relaxed">
            <strong>NOTA IMPORTANTE:</strong> Documento de proposta de negócio — valores sujeitos a
            confirmação de documentação e verificação de matrícula. Não constitui promessa de compra
            e venda definitiva.
          </div>

          <div className="mt-2 flex items-center justify-between text-[9px] text-slate-400">
            <span>AmbicorpFlow · Emissão Especial de Proposta Imobiliária</span>
            <span>Folha de Apresentação Familiar / Formal</span>
          </div>
        </section>
      </div>

      {/* ESTILOS DE IMPRESSÃO A4 ESPECÍFICOS */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 12mm 10mm 12mm;
        }

        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          #proposta-imovel-doc,
          #proposta-imovel-doc * {
            visibility: visible;
          }

          #proposta-imovel-doc {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }

          .cronograma-parcelas-wrapper {
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          .break-inside-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}

export default PropostaImovel
