import React, { useRef } from 'react'
import { Printer, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface OrderItem {
  id: number
  descricao: string
  codigo: string
  un: string
  qtd: string
  valorUnitario: string
  valorTotal: string
}

export const Pedido6849: React.FC = () => {
  const printRef = useRef<HTMLDivElement>(null)

  const items: OrderItem[] = [
    {
      id: 1,
      descricao: 'Notebook Dell Latitude 3400 - I7 8ª 8GB Sem SSD Fonte',
      codigo: '877747',
      un: 'UN',
      qtd: '5,00',
      valorUnitario: '1.200,00',
      valorTotal: '6.000,00',
    },
    {
      id: 2,
      descricao: 'Notebook Dell Latitude 3400 - I5 8ª 8GB Sem SSD Fonte',
      codigo: '877748',
      un: 'UN',
      qtd: '2,00',
      valorUnitario: '1.100,00',
      valorTotal: '2.200,00',
    },
    {
      id: 3,
      descricao: 'Notebook Dell Latitude 5400 - I7 8ª 8GB Sem SSD Fonte',
      codigo: '877749',
      un: 'UN',
      qtd: '32,00',
      valorUnitario: '1.200,00',
      valorTotal: '38.400,00',
    },
    {
      id: 4,
      descricao: 'Notebook Dell Latitude 5400 - I5 8ª 8GB Sem SSD Fonte',
      codigo: '877750',
      un: 'UN',
      qtd: '6,00',
      valorUnitario: '1.100,00',
      valorTotal: '6.600,00',
    },
    {
      id: 5,
      descricao: 'Notebook Dell Latitude 3490 - I7 8ª 8GB Sem SSD Fonte',
      codigo: '877751',
      un: 'UN',
      qtd: '4,00',
      valorUnitario: '1.200,00',
      valorTotal: '4.800,00',
    },
    {
      id: 6,
      descricao: 'Notebook Dell Latitude 3490 - I5 8ª 8GB Sem SSD Fonte',
      codigo: '877752',
      un: 'UN',
      qtd: '14,00',
      valorUnitario: '1.100,00',
      valorTotal: '15.400,00',
    },
    {
      id: 7,
      descricao: 'Notebook Dell Latitude 5490 - I5 8ª 8GB Sem SSD Fonte',
      codigo: '877753',
      un: 'UN',
      qtd: '10,00',
      valorUnitario: '1.100,00',
      valorTotal: '11.000,00',
    },
  ]

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Barra de Ações Superior (Apenas Tela / print:hidden) */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Voltar ao sistema
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-800 text-sm sm:text-base">
                Pedido de Venda 6849 (Bling - Corrigido)
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> 73 peças (R$ 84.400,00)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Réplica fiel para impressão A4 retrato. Use o botão abaixo ou Ctrl+P para &quot;Salvar
              como PDF&quot;.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Folha A4 do Pedido de Venda */}
      <div
        ref={printRef}
        id="bling-document-page"
        className="bling-sheet bg-white text-black mx-auto shadow-md print:shadow-none print:m-0 print:border-none border border-slate-300"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '12mm 15mm 12mm 15mm',
          boxSizing: 'border-box',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
          lineHeight: 1.3,
          color: '#000000',
        }}
      >
        {/* Cabeçalho do Bling de Topo do Navegador (Data, Hora / Bling - Pedido de Venda) */}
        <div className="flex justify-between items-center text-[10px] text-black mb-4 select-none pb-1">
          <div>29/07/2026, 15:51</div>
          <div className="font-normal">Bling - Pedido de Venda</div>
        </div>

        {/* Top Header: Logo + Emissor */}
        <div className="flex justify-between items-start pb-4">
          {/* Caixa de Logo Placeholder idêntica ao Bling */}
          <div
            className="flex items-center gap-2.5 px-3 py-2 border border-[#999999] bg-[#d9d9d9]"
            style={{ width: '230px', minHeight: '68px' }}
          >
            {/* Ícone de prédio / corporativo */}
            <div className="w-9 h-9 rounded-full border border-[#555555] flex items-center justify-center shrink-0 bg-transparent">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-[#333333]"
              >
                <rect x="4" y="2" width="16" height="20" rx="1" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />
              </svg>
            </div>
            <div className="font-bold text-[12px] leading-tight text-black tracking-tight">
              Ambiente Corpor-
              <br />
              ativo Informatica
              <br />
              LTDA
            </div>
          </div>

          {/* Dados do Emissor (alinhados à direita) */}
          <div className="text-right text-[10.5px] leading-relaxed text-black pt-1">
            <div className="font-normal">
              Ambiente Corporativo Informatica LTDA - (31) 3347-3003
            </div>
            <div>Praça Urupês, N° 75</div>
            <div>31130410 - Belo Horizonte, MG</div>
            <div>CNPJ: 53.353.026/0001-80, IE: 47883300059</div>
          </div>
        </div>

        {/* Título Centralizado: Pedido 6849 */}
        <div className="text-center font-bold text-[15px] my-4 text-black tracking-wide">
          Pedido 6849
        </div>

        {/* Seção Cliente + Caixa do Pedido */}
        <div className="mt-2 mb-5">
          <div className="text-[11px] font-bold mb-1 text-black">Cliente</div>
          <div className="border border-black flex justify-between">
            {/* Dados do Cliente (Lado Esquerdo) */}
            <div className="p-2 text-[10px] leading-relaxed flex-1">
              <div className="font-bold text-[10.5px]">MKC COMERCIO E SERVICOS LTDA</div>
              <div>CNPJ: 05.010.522/0001-98,</div>
              <div>IE: 0621764840096</div>
              <div>RUA JOAO LUCIO BRANDAO, N° 228, Bairro: PRADO</div>
              <div>BELO HORIZONTE, MG, 30411046</div>
            </div>

            {/* Tabela Número / Data / Data prevista (Lado Direito) */}
            <div className="w-[210px] border-l border-black flex flex-col justify-between text-[10px]">
              <div className="flex border-b border-black">
                <div className="w-[110px] p-1 font-bold border-r border-black bg-white">
                  Número do pedido
                </div>
                <div className="flex-1 p-1 pl-2">6849</div>
              </div>
              <div className="flex border-b border-black">
                <div className="w-[110px] p-1 font-bold border-r border-black bg-white">Data</div>
                <div className="flex-1 p-1 pl-2">29/07/2026</div>
              </div>
              <div className="flex">
                <div className="w-[110px] p-1 font-bold border-r border-black bg-white">
                  Data prevista
                </div>
                <div className="flex-1 p-1 pl-2">&nbsp;</div>
              </div>
            </div>
          </div>
        </div>

        {/* Seção Itens do pedido de venda */}
        <div className="mt-4 mb-5">
          <div className="text-[11px] font-bold mb-1 text-black">Itens do pedido de venda</div>
          <table
            className="w-full border-collapse border border-black text-[10px]"
            style={{ tableLayout: 'fixed' }}
          >
            <thead>
              <tr className="border-b border-black font-bold">
                <th
                  className="border-r border-black p-1 text-left font-bold"
                  style={{ width: '47%' }}
                >
                  Descrição do produto/serviço
                </th>
                <th
                  className="border-r border-black p-1 text-left font-bold"
                  style={{ width: '13%' }}
                >
                  Código
                </th>
                <th
                  className="border-r border-black p-1 text-center font-bold"
                  style={{ width: '6%' }}
                >
                  Un.
                </th>
                <th
                  className="border-r border-black p-1 text-right font-bold"
                  style={{ width: '8%' }}
                >
                  Qtd.
                </th>
                <th
                  className="border-r border-black p-1 text-right font-bold leading-tight"
                  style={{ width: '12%' }}
                >
                  Valor
                  <br />
                  unitário
                </th>
                <th className="p-1 text-right font-bold" style={{ width: '14%' }}>
                  Valor total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-black">
                  <td className="border-r border-black p-1 text-left truncate leading-tight">
                    {item.descricao}
                  </td>
                  <td className="border-r border-black p-1 text-left">{item.codigo}</td>
                  <td className="border-r border-black p-1 text-center">{item.un}</td>
                  <td className="border-r border-black p-1 text-right font-mono">{item.qtd}</td>
                  <td className="border-r border-black p-1 text-right font-mono">
                    {item.valorUnitario}
                  </td>
                  <td className="p-1 text-right font-mono">{item.valorTotal}</td>
                </tr>
              ))}

              {/* Totais no rodapé da tabela (alinhados exatamente como no Bling) */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r-0 p-1"></td>
                <td className="p-1 text-right font-bold border-l border-black">N° de itens</td>
                <td className="p-1 text-right font-mono border-l border-black">7,00</td>
              </tr>
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r-0 p-1"></td>
                <td className="p-1 text-right font-bold border-l border-black">Soma das Qtdes</td>
                <td className="p-1 text-right font-mono border-l border-black">73,00</td>
              </tr>
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r-0 p-1"></td>
                <td className="p-1 text-right font-bold border-l border-black">
                  Total de produtos
                </td>
                <td className="p-1 text-right font-mono border-l border-black">84.400,00</td>
              </tr>
              <tr>
                <td colSpan={4} className="border-r-0 p-1"></td>
                <td className="p-1 text-right font-bold border-l border-black">Total do pedido</td>
                <td className="p-1 text-right font-mono border-l border-black">84.400,00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Seção Observações (presente, vazia) */}
        <div className="mt-6 mb-8">
          <div className="text-[11px] font-bold mb-1 text-black">Observações</div>
          <div className="border border-black h-8 w-full">&nbsp;</div>
        </div>

        {/* Rodapé da Página: Link do Bling + Página 1/1 */}
        <div className="mt-16 pt-8 flex justify-between items-center text-[10px] text-black select-none">
          <div>https://www.bling.com.br/relatorios/venda.impressao.php</div>
          <div>1/1</div>
        </div>
      </div>

      {/* Estilos específicos de impressão @page A4 */}
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

          #bling-document-page,
          #bling-document-page * {
            visibility: visible;
          }

          #bling-document-page {
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
        }
      `}</style>
    </div>
  )
}

export default Pedido6849
