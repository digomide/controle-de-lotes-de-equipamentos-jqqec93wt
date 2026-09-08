import React from 'react'

interface AmbicorpFlowLogoProps {
  /**
   * Tamanho do ícone/monograma: 'sm' (28-32px), 'md' (36-40px), 'lg' (48px)
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Exibir o wordmark ("AmbicorpFlow") ao lado do símbolo
   */
  showWordmark?: boolean
  /**
   * Variante de tema: 'light' para cabeçalhos claros, 'dark' para fundos escuros/rodapé
   */
  variant?: 'light' | 'dark'
  /**
   * Classes extras no contêiner raiz
   */
  className?: string
}

/**
 * Logo oficial AmbicorpFlow
 * Símbolo tech moderno combinando monograma "AF", dinâmica de fluxo contínuo (Flow),
 * chip corporativo e tons quentes/coral (#f97316 / #ea580c / #c2410c) com ardósia/grafite (#0f172a).
 */
export const AmbicorpFlowLogo: React.FC<AmbicorpFlowLogoProps> = ({
  size = 'md',
  showWordmark = true,
  variant = 'light',
  className = '',
}) => {
  const iconDimensions = {
    sm: { box: 'w-8 h-8', svg: 32 },
    md: { box: 'w-10 h-10 sm:w-11 sm:h-11', svg: 42 },
    lg: { box: 'w-12 h-12', svg: 48 },
  }[size]

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Símbolo / Monograma AF + Fluxo */}
      <div
        className={`${iconDimensions.box} rounded-xl relative flex items-center justify-center shrink-0 shadow-xs overflow-hidden transition-transform group-hover:scale-105 duration-300`}
        style={{
          background:
            variant === 'dark'
              ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
              : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border:
            variant === 'dark'
              ? '1px solid rgba(255,255,255,0.12)'
              : '1px solid rgba(15,23,42,0.1)',
        }}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
          aria-hidden="true"
        >
          <defs>
            {/* Gradiente Coral / Laranja do Fluxo */}
            <linearGradient
              id="af-coral-grad"
              x1="6"
              y1="42"
              x2="42"
              y2="6"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="50%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>

            {/* Gradiente Cyan / Tech da Letra A */}
            <linearGradient
              id="af-teal-grad"
              x1="10"
              y1="36"
              x2="26"
              y2="12"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0ea5e9" />
            </linearGradient>

            {/* Brilho sutil */}
            <radialGradient id="af-glow" cx="50%" cy="30%" r="60%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Fundo glow sutil */}
          <circle cx="24" cy="24" r="20" fill="url(#af-glow)" />

          {/* Traçado do "A" (Estrutura esquerda tech, angulada) */}
          <path
            d="M9 36L20 12C20.6 10.7 22.4 10.7 23 12L31 30"
            stroke="url(#af-teal-grad)"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Barra horizontal dinâmica do "A" que se conecta ao Flow */}
          <path d="M14 26.5H26" stroke="url(#af-teal-grad)" strokeWidth="3" strokeLinecap="round" />

          {/* Símbolo "F" + "Flow" em forma de seta de fluxo acelerado em gradiente coral/laranja */}
          <path
            d="M26 13H39C40.6569 13 42 14.3431 42 16C42 17.6569 40.6569 19 39 19H29V36"
            stroke="url(#af-coral-grad)"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Barra do F com terminação em seta estilizada (Fluxo tech) */}
          <path
            d="M29 24.5H36.5M36.5 24.5L34 22M36.5 24.5L34 27"
            stroke="url(#af-coral-grad)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ponto / Chip node pulsante no topo */}
          <circle cx="39" cy="16" r="2.2" fill="#fed7aa" />
        </svg>
      </div>

      {/* Wordmark AmbicorpFlow */}
      {showWordmark && (
        <div className="flex flex-col justify-center min-w-0 leading-none">
          <div className="flex items-baseline tracking-tight font-extrabold">
            <span
              className={`text-lg sm:text-xl font-black ${
                variant === 'dark' ? 'text-white' : 'text-slate-900'
              }`}
            >
              <span className="text-orange-500 font-black">A</span>
              <span>mbicorp</span>
              <span className="text-orange-500 font-black ml-0.5">Flow</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
export default AmbicorpFlowLogo
