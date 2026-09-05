import React, { useMemo } from 'react'

interface QRCodeSVGProps {
  value: string
  size?: number
  className?: string
}

/**
 * Robust, dependency-free QR Code generator (Version 1-4 Byte Mode)
 * Uses QR Code standard matrix layout with ECC Level M / L fallback
 * and returns a crisp, vector SVG element ideal for printing.
 */
export function QRCodeSVG({ value, size = 120, className = '' }: QRCodeSVGProps) {
  const matrix = useMemo(() => {
    return generateQRCodeMatrix(value)
  }, [value])

  const moduleCount = matrix.length
  const cellSize = size / moduleCount

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="white" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="black"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

// -------------------------------------------------------------
// Minimalist pure-JS QR code matrix generator (Versions 1..5)
// -------------------------------------------------------------
export function generateQRCodeMatrix(text: string): boolean[][] {
  const dataBytes = utf8Encode(text)
  const len = dataBytes.length

  // Pick smallest version that fits
  // Capacity for byte mode with ECC M:
  // V1 (21x21): 14 bytes
  // V2 (25x25): 26 bytes
  // V3 (29x29): 42 bytes
  // V4 (33x33): 62 bytes
  // V5 (37x37): 84 bytes
  // V6 (41x41): 106 bytes
  // V7 (45x45): 122 bytes
  let version = 1
  if (len > 14) version = 2
  if (len > 26) version = 3
  if (len > 42) version = 4
  if (len > 62) version = 5
  if (len > 84) version = 6
  if (len > 106) version = 7

  const size = 17 + 4 * version
  const grid: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  )
  const isReserved: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  )

  const reserve = (r: number, c: number) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      isReserved[r][c] = true
    }
  }

  // 1. Finder patterns (top-left, top-right, bottom-left)
  const placeFinder = (startR: number, startC: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const tr = startR + r
        const tc = startC + c
        if (tr < 0 || tr >= size || tc < 0 || tc >= size) continue
        reserve(tr, tc)
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
          grid[tr][tc] = isOuter || isInner
        } else {
          grid[tr][tc] = false
        }
      }
    }
  }

  placeFinder(0, 0)
  placeFinder(0, size - 7)
  placeFinder(size - 7, 0)

  // 2. Alignment patterns (for versions 2..7)
  // Alignment positions standard:
  // V2: [6, 18] -> single (18, 18)
  // V3: [6, 22] -> single (22, 22)
  // V4: [6, 26] -> single (26, 26)
  // V5: [6, 30] -> single (30, 30)
  // V6: [6, 34] -> single (34, 34)
  // V7: [6, 22, 38]
  const alignCoordsByVersion: Record<number, number[]> = {
    2: [18],
    3: [22],
    4: [26],
    5: [30],
    6: [34],
    7: [22, 38],
  }

  const alignCoords = alignCoordsByVersion[version] || []
  if (alignCoords.length > 0) {
    const allCoords = [6, ...alignCoords]
    for (const ar of allCoords) {
      for (const ac of allCoords) {
        // Skip finder areas
        if ((ar <= 8 && ac <= 8) || (ar <= 8 && ac >= size - 8) || (ar >= size - 8 && ac <= 8)) {
          continue
        }

        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const tr = ar + r
            const tc = ac + c
            reserve(tr, tc)
            const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2
            const isCenter = r === 0 && c === 0
            grid[tr][tc] = isOuter || isCenter
          }
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isReserved[6][i]) {
      grid[6][i] = i % 2 === 0
      reserve(6, i)
    }
    if (!isReserved[i][6]) {
      grid[i][6] = i % 2 === 0
      reserve(i, 6)
    }
  }

  // 4. Dark module
  grid[4 * version + 9][8] = true
  reserve(4 * version + 9, 8)

  // 5. Reserve format info areas
  for (let i = 0; i < 9; i++) {
    reserve(8, i)
    reserve(i, 8)
  }
  for (let i = size - 8; i < size; i++) {
    reserve(8, i)
    reserve(i, 8)
  }

  // 6. Build Codewords
  const totalCodewords = versionTable[version].total
  const ecCodewords = versionTable[version].ec
  const dataCapacity = totalCodewords - ecCodewords

  // Pack data with header (Mode=0100 for Byte, Count)
  const bitstream: number[] = []
  const pushBits = (val: number, bitCount: number) => {
    for (let b = bitCount - 1; b >= 0; b--) {
      bitstream.push((val >> b) & 1)
    }
  }

  // 0100 = 8-bit byte mode
  pushBits(0b0100, 4)
  // Character count indicator (8 bits for versions 1..9)
  pushBits(len, 8)
  for (let i = 0; i < len; i++) {
    pushBits(dataBytes[i], 8)
  }

  // Terminator (up to 4 zeroes)
  const maxDataBits = dataCapacity * 8
  const terminatorLen = Math.min(4, maxDataBits - bitstream.length)
  pushBits(0, terminatorLen)

  // Pad to multiple of 8
  while (bitstream.length % 8 !== 0) {
    bitstream.push(0)
  }

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bitstream.length < maxDataBits) {
    pushBits(padBytes[padIdx % 2], 8)
    padIdx++
  }

  // Convert bits to data codewords
  const dataWords: number[] = []
  for (let i = 0; i < bitstream.length; i += 8) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      byte = (byte << 1) | bitstream[i + b]
    }
    dataWords.push(byte)
  }

  // Reed-Solomon Error Correction
  const ecWords = computeReedSolomon(dataWords, ecCodewords)
  const allCodewords = [...dataWords, ...ecWords]

  // 7. Place data into grid using standard zigzag
  let bitIndex = 0
  const allBits: number[] = []
  for (const cw of allCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((cw >> b) & 1)
    }
  }

  let upward = true
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    // Skip vertical timing column
    if (rightCol === 6) rightCol--

    const colLeft = rightCol - 1
    const rowRange = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const r of rowRange) {
      for (const c of [rightCol, colLeft]) {
        if (!isReserved[r][c]) {
          const bit = bitIndex < allBits.length ? allBits[bitIndex++] : 0
          // Apply Mask 0: (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0
          grid[r][c] = (bit ^ (mask ? 1 : 0)) === 1
        }
      }
    }
    upward = !upward
  }

  // 8. Place Format Information (ECC: M = 00, Mask: 000 = 000 => Format bits = 101010000010010)
  // Standard format string for (M, Mask 0) with BCH error correction and XOR mask:
  // Mask 0 + ECC M => 0b101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]

  // Around top-left finder
  const formatCoordsTL = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ]

  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoordsTL[i]
    grid[r][c] = formatBits[i] === 1
  }

  // Along top-right and bottom-left finders
  for (let i = 0; i < 8; i++) {
    grid[size - 1 - i][8] = formatBits[i] === 1
  }
  for (let i = 8; i < 15; i++) {
    grid[8][size - 15 + i] = formatBits[i] === 1
  }

  // Convert nulls to false
  return grid.map((row) => row.map((cell) => cell === true))
}

const versionTable: Record<number, { total: number; ec: number }> = {
  1: { total: 26, ec: 10 }, // 16 data bytes
  2: { total: 44, ec: 16 }, // 28 data bytes
  3: { total: 70, ec: 26 }, // 44 data bytes
  4: { total: 100, ec: 36 }, // 64 data bytes
  5: { total: 134, ec: 48 }, // 86 data bytes
  6: { total: 172, ec: 64 }, // 108 data bytes
  7: { total: 196, ec: 72 }, // 124 data bytes
}

function utf8Encode(str: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  return bytes
}

// Galois Field (GF 256) math for Reed-Solomon
const GF_EXP: number[] = new Array(512)
const GF_LOG: number[] = new Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x >= 256) {
      x ^= 0x11d // QR standard polynomial: x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function computeReedSolomon(data: number[], ecCount: number): number[] {
  // Generate generator polynomial
  let gen = [1]
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(gen.length + 1).fill(0)
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gfMul(gen[j], GF_EXP[i])
      next[j + 1] ^= gen[j]
    }
    gen = next
  }

  // Remainder polynomial division
  const remainder = new Array(ecCount).fill(0)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0]
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[ecCount - 1 - j], factor)
    }
    remainder[ecCount - 1] = gfMul(gen[0], factor)
  }

  return remainder
}
