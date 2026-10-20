/** Picture card for a win or a badge. Shared with the link. No outside service. */

export function bragCardFile(line: string): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null)
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  const sky = ctx.createLinearGradient(0, 0, 0, 630)
  sky.addColorStop(0, '#1b3f86')
  sky.addColorStop(1, '#07122a')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, 1200, 630)
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)'
  ctx.lineWidth = 12
  ctx.strokeRect(36, 36, 1128, 558)
  ctx.fillStyle = '#ffd166'
  ctx.font = '700 42px Nunito, sans-serif'
  ctx.fillText("Roman's Game", 80, 140)
  ctx.fillStyle = '#f4fbff'
  ctx.font = '800 64px Nunito, sans-serif'
  wrap(ctx, line, 80, 280, 1040, 78)
  ctx.font = '700 32px Nunito, sans-serif'
  ctx.fillStyle = 'rgba(244, 251, 255, 0.8)'
  ctx.fillText('Can you beat it?', 80, 520)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }
      resolve(new File([blob], 'roman-brag.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, line: number) {
  const words = text.split(' ')
  let row = ''
  let top = y
  for (const word of words) {
    const trial = row ? `${row} ${word}` : word
    if (ctx.measureText(trial).width > max && row) {
      ctx.fillText(row, x, top)
      row = word
      top += line
    } else {
      row = trial
    }
  }
  if (row) ctx.fillText(row, x, top)
}
