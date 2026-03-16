import { useState, useRef } from 'react'
import { jsPDF } from 'jspdf'

// ── Utils ────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildCard(min, max, centerFree) {
  const needed = centerFree ? 24 : 25
  const pool = []
  for (let i = min; i <= max; i++) pool.push(i)
  if (pool.length < needed) {
    alert(`数字の範囲が足りません。${needed}個以上必要ですが現在 ${pool.length} 個です。`)
    return null
  }
  const nums = shuffle(pool).slice(0, needed)
  return Array.from({ length: 25 }, (_, i) =>
    centerFree && i === 12 ? null : nums.pop()
  )
}

// ── PDF generation (canvas → jsPDF) ─────────────────────

const PW = 1748, PH = 1240

function drawCard(ctx, cells, x, y, w, h) {
  const cellW = w / 5, cellH = cellW
  const HEADER_H = h - cellH * 5

  ctx.fillStyle = 'white'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#1E293B'
  ctx.fillRect(x, y, w, HEADER_H)

  const headers = ['B', 'I', 'N', 'G', 'O']
  ctx.fillStyle = 'white'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${Math.round(HEADER_H * 0.72)}px Arial, sans-serif`
  for (let i = 0; i < 5; i++) {
    ctx.fillText(headers[i], x + cellW * i + cellW / 2, y + HEADER_H / 2)
  }

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cx = x + cellW * col
      const cy = y + HEADER_H + cellH * row
      const val = cells[row * 5 + col]

      if (val === null) {
        ctx.fillStyle = '#FFF3E0'
        ctx.fillRect(cx, cy, cellW, cellH)
        ctx.fillStyle = '#BF360C'
        ctx.font = `500 ${Math.round(cellH * 0.38)}px Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('FREE', cx + cellW / 2, cy + cellH / 2)
      } else {
        ctx.fillStyle = 'white'
        ctx.fillRect(cx, cy, cellW, cellH)
        ctx.fillStyle = '#0F172A'
        const text = String(val)
        let fs = Math.round(cellH * 0.85)
        ctx.font = `700 ${fs}px Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        while (ctx.measureText(text).width > cellW * 0.86 && fs > 20) {
          fs -= 2
          ctx.font = `700 ${fs}px Arial, sans-serif`
        }
        ctx.fillText(text, cx + cellW / 2, cy + cellH / 2)
      }

      ctx.strokeStyle = '#CBD5E1'
      ctx.lineWidth = 2
      ctx.strokeRect(cx, cy, cellW, cellH)
    }
  }

  ctx.strokeStyle = '#1E293B'
  ctx.lineWidth = 5
  ctx.strokeRect(x, y, w, h)
}

function createPDF(cards) {
  const VPAD = 170
  const cellW = Math.floor((PH - 2 * VPAD) / 5.8)
  const cardW = cellW * 5
  const headerH = Math.round(cellW * 0.8)
  const cardH = headerH + cellW * 5
  const HPAD = Math.floor((PW / 2 - cardW) / 2)
  const GAP = HPAD * 2
  const cardY = VPAD + Math.round((PH - 2 * VPAD - cardH) / 2)

  const dataURLs = []

  for (let i = 0; i < cards.length; i += 2) {
    const canvas = document.createElement('canvas')
    canvas.width = PW
    canvas.height = PH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, PW, PH)
    drawCard(ctx, cards[i], HPAD, cardY, cardW, cardH)
    if (cards[i + 1]) {
      drawCard(ctx, cards[i + 1], HPAD + cardW + GAP, cardY, cardW, cardH)
      const cutX = Math.round(HPAD + cardW + GAP / 2)
      ctx.save()
      ctx.strokeStyle = '#444'
      ctx.lineWidth = 2
      ctx.setLineDash([14, 9])
      ctx.beginPath()
      ctx.moveTo(cutX, 0)
      ctx.lineTo(cutX, PH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()
    }
    dataURLs.push(canvas.toDataURL('image/png'))
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  dataURLs.forEach((url, i) => {
    if (i > 0) doc.addPage()
    doc.addImage(url, 'PNG', 0, 0, 297, 210)
  })

  const blob = doc.output('blob')
  window.open(URL.createObjectURL(blob), '_blank')
}

// ── Components ───────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div className="m3-field">
      <label>{label}</label>
      {children}
    </div>
  )
}

function BingoCard({ cells }) {
  const headers = ['B', 'I', 'N', 'G', 'O']
  return (
    <div className="bingo-card">
      <div className="bingo-header">
        {headers.map(h => (
          <div key={h} className="bingo-header-cell">{h}</div>
        ))}
      </div>
      <div className="bingo-grid">
        {cells.map((val, i) =>
          val === null
            ? <div key={i} className="bingo-cell free-cell">FREE</div>
            : <div key={i} className="bingo-cell">{val}</div>
        )}
      </div>
    </div>
  )
}

function Slider({ cards, current, onPrev, onNext, onPDF, pdfLoading }) {
  const touchStartX = useRef(null)

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 50) onPrev()
    else if (dx < -50) onNext()
    touchStartX.current = null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.07),0 4px 12px rgba(0,0,0,.05)' }}>
        {/* Nav */}
        <div className="flex items-center justify-between mb-3 px-1">
          <button
            onClick={onPrev}
            disabled={current === 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl font-bold disabled:opacity-30"
            style={{ background: '#334155', touchAction: 'manipulation' }}
          >‹</button>
          <span className="text-sm font-medium" style={{ color: '#475569' }}>
            {current + 1} / {cards.length}
          </span>
          <button
            onClick={onNext}
            disabled={current === cards.length - 1}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl font-bold disabled:opacity-30"
            style={{ background: '#334155', touchAction: 'manipulation' }}
          >›</button>
        </div>

        {/* Slide track — transform based, works on PC and mobile */}
        <div style={{ overflow: 'hidden', borderRadius: 12 }}>
          <div
            style={{
              display: 'flex',
              transform: `translateX(-${current * 100}%)`,
              transition: 'transform 0.28s cubic-bezier(.4,0,.2,1)',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {cards.map((cells, i) => (
              <div
                key={i}
                style={{ flex: '0 0 100%', display: 'flex', justifyContent: 'center', padding: '16px 0' }}
              >
                <BingoCard cells={cells} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PDF button */}
      <button
        onClick={onPDF}
        disabled={pdfLoading}
        className="w-full rounded-lg text-white font-medium text-sm disabled:opacity-70"
        style={{
          height: 44,
          background: '#0F172A',
          boxShadow: '0 1px 2px rgba(0,0,0,.3),0 2px 6px rgba(0,0,0,.15)',
          touchAction: 'manipulation',
          fontFamily: "'Google Sans', sans-serif",
          letterSpacing: '.25px',
          cursor: pdfLoading ? 'default' : 'pointer',
        }}
      >
        {pdfLoading
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg className="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              作成中…
            </span>
          : 'PDF 出力'
        }
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div
      className="bg-white rounded-2xl flex flex-col items-center justify-center py-20"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,.07),0 4px 12px rgba(0,0,0,.05)', color: '#CBD5E1' }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="9" x2="9" y2="21" />
        <line x1="15" y1="9" x2="15" y2="21" />
        <line x1="3" y1="15" x2="21" y2="15" />
      </svg>
      <p className="mt-4 text-sm font-medium" style={{ color: '#94A3B8' }}>設定して生成ボタンを押してください</p>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────

export default function App() {
  const [min, setMin] = useState(1)
  const [max, setMax] = useState(75)
  const [count, setCount] = useState(2)
  const [center, setCenter] = useState('number')
  const [cards, setCards] = useState([])
  const [current, setCurrent] = useState(0)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleGenerate = () => {
    if (isNaN(min) || isNaN(max) || min >= max) {
      alert('最小値は最大値より小さくしてください。')
      return
    }
    const centerFree = center === 'free'
    const result = []
    for (let i = 0; i < count; i++) {
      const card = buildCard(min, max, centerFree)
      if (!card) return
      result.push(card)
    }
    setCards(result)
    setCurrent(0)
  }

  const handlePDF = () => {
    if (!cards.length) return
    setPdfLoading(true)
    setTimeout(() => {
      createPDF(cards)
      setPdfLoading(false)
    }, 50)
  }

  const prev = () => setCurrent(c => Math.max(0, c - 1))
  const next = () => setCurrent(c => Math.min(cards.length - 1, c + 1))

  return (
    <div className="min-h-screen" style={{ background: '#F1F5F9' }}>
      {/* Header */}
      <header style={{ background: '#1E293B', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest" style={{ color: '#64748B' }}>BINGO CARD GENERATOR</p>
            <h1 className="text-white text-2xl font-medium tracking-wide" style={{ lineHeight: 1.2 }}>ビンゴカード生成</h1>
          </div>
          <p className="text-xs pb-0.5 hidden sm:block" style={{ color: '#475569' }}>A4横 / 2枚組 PDF出力</p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

          {/* Settings */}
          <div className="lg:sticky lg:top-6">
            <div className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,.07),0 4px 12px rgba(0,0,0,.05)' }}>
              <p className="text-xs font-medium tracking-widest mb-5" style={{ color: '#94A3B8' }}>SETTINGS</p>
              <div className="grid grid-cols-2 gap-4 mb-5">
                <Field label="最小値">
                  <input type="number" value={min} min="1" max="999"
                    onChange={e => setMin(parseInt(e.target.value, 10))} />
                </Field>
                <Field label="最大値">
                  <input type="number" value={max} min="1" max="999"
                    onChange={e => setMax(parseInt(e.target.value, 10))} />
                </Field>
                <Field label="生成枚数">
                  <input type="number" value={count} min="1" max="100"
                    onChange={e => setCount(parseInt(e.target.value, 10))} />
                </Field>
                <Field label="中央マス">
                  <select value={center} onChange={e => setCenter(e.target.value)}>
                    <option value="free">FREE</option>
                    <option value="number">数字</option>
                  </select>
                </Field>
              </div>
              <button
                onClick={handleGenerate}
                className="w-full rounded-lg text-white font-medium text-sm"
                style={{
                  height: 44,
                  background: '#334155',
                  boxShadow: '0 1px 2px rgba(0,0,0,.25),0 2px 6px rgba(0,0,0,.12)',
                  fontFamily: "'Google Sans', sans-serif",
                  letterSpacing: '.25px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                生成
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            {cards.length === 0
              ? <EmptyState />
              : <Slider
                  cards={cards}
                  current={current}
                  onPrev={prev}
                  onNext={next}
                  onPDF={handlePDF}
                  pdfLoading={pdfLoading}
                />
            }
          </div>

        </div>
      </main>
    </div>
  )
}
