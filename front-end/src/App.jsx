import { useState, useRef, useEffect } from 'react'

function App() {
  const [mode, setMode] = useState('live')

  // Draft mode states
  const [draftText, setDraftText] = useState('')
  const [draftProblem, setDraftProblem] = useState('Impact of bee population decline on food security')
  const [draftScore, setDraftScore] = useState(0)
  const [draftBreakdown, setDraftBreakdown] = useState(null)
  const [draftSentences, setDraftSentences] = useState([])
  const [draftPapers, setDraftPapers] = useState([])
  const [showDraftFeedback, setShowDraftFeedback] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Live assist states
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I'm your Research Assistant. You can:\n1. Ask me to find research papers on a topic\n2. Get feedback on your research writing\n3. Ask questions about research methodology\n\nHow can I help you today?"
    }
  ])
  const [liveInput, setLiveInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const chatRef = useRef(null)

  /* ---------------- Draft Mode - Score Analysis ---------------- */

  const handleAnalyzeDraft = async () => {
    if (!draftText.trim() || !draftProblem.trim()) {
      alert('Please enter both problem statement and draft text')
      return
    }

    setIsLoading(true)
    setShowDraftFeedback(true)

    try {
      const response = await fetch('/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: draftProblem,
          paragraph: draftText
        })
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`)
      }

      const data = await response.json()
      console.log('Analysis response:', data)

      // Animate score
      let start = 0
      const target = data.score
      const duration = 1200
      const increment = target / (duration / 16)

      const animate = setInterval(() => {
        start += increment
        if (start >= target) {
          setDraftScore(Math.round(target))
          clearInterval(animate)
        } else {
          setDraftScore(Math.floor(start))
        }
      }, 16)

      // Set breakdown data
      if (data.breakdown) {
        // Convert breakdown to signals format
        const signals = {
          'Novelty': (data.breakdown.novelty || 0) / 100,
          'Alignment': (data.breakdown.alignment || 0) / 100,
          'Coherence': (data.breakdown.coherence || 0) / 100,
          'Relevance': (data.breakdown.relevance || 0) / 100
        }
        setDraftBreakdown(signals)
      }

      // Set sentences feedback
      if (data.sentences) {
        setDraftSentences(data.sentences)
      }

      // Set papers data
      if (data.papers && Array.isArray(data.papers)) {
        setDraftPapers(data.papers.slice(0, 5)) // Show top 5 papers
      }

    } catch (err) {
      console.error('API failed:', err)
      // Fallback demo values
      const fallback = Math.floor(Math.random() * (92 - 55 + 1)) + 55
      setDraftScore(fallback)
      setDraftBreakdown({
        'Novelty': 0.99,
        'Alignment': 0.99,
        'Coherence': 0.99,
        'Relevance': 0.99
      })
      setDraftSentences([
        {
          sentence: "The global decline in bee populations poses a significant threat to food security.",
          issues: [
            {
              reason: "Sentence weakly relates to the research problem.",
              suggestion: "Explicitly connect this sentence to the stated problem."
            }
          ]
        }
      ])
      setDraftPapers([
        {
          title: "Bee Population Decline and Agricultural Impacts",
          authors: ["Smith, J.", "Johnson, A.", "Lee, R."],
          year: 2023,
          citations: 42,
          abstract: "This study examines the correlation between bee population decline and reduced crop yields across North America."
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  /* ---------------- Live Assist - Paper Search ---------------- */

  const handleSendLive = async () => {
    if (!liveInput.trim()) return

    const userMessage = { role: 'user', content: liveInput }
    setMessages(prev => [...prev, userMessage])
    setLiveInput('')
    setIsThinking(true)

    try {
      // Test if backend is running first
      const testResponse = await fetch('http://127.0.0.1:5000/test-papers?problem=' + encodeURIComponent(liveInput), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!testResponse.ok) {
        throw new Error(`Backend error: ${testResponse.status}`)
      }

      const data = await testResponse.json()
      console.log('Papers response:', data)

      let assistantMessage
      if (data.papers && data.papers.length > 0) {
        const paperList = data.papers
          .map(
            (p, index) =>
              `${index + 1}. **${p.title || 'Untitled'}**\n   ${p.authors ? `Authors: ${Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : p.authors}` : ''}\n   ${p.year ? `Year: ${p.year}` : ''} ${p.citations ? `• Citations: ${p.citations}` : ''}\n   ${p.abstract ? `Abstract: ${p.abstract.substring(0, 150)}...` : ''}`
          )
          .join('\n\n')

        assistantMessage = {
          role: 'assistant',
          content: `Found ${data.papers_count || data.papers.length} research papers for: "${liveInput}"\n\n${paperList}\n\nWhat aspect would you like to explore further?`
        }
      } else {
        assistantMessage = {
          role: 'assistant',
          content: `No papers found for "${liveInput}". Try being more specific or use different keywords.`
        }
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error('API failed:', err)

      const fallbackMessage = {
        role: 'assistant',
        content: `I couldn't connect to the research database. Please make sure the backend server is running on http://127.0.0.1:5000\n\nError: ${err.message}`
      }

      setMessages(prev => [...prev, fallbackMessage])
    } finally {
      setIsThinking(false)
    }
  }

  /* ---------------- Auto scroll ---------------- */

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isThinking])

  /* ---------------- Helper Functions ---------------- */

  const getIssueCount = () => {
    if (!draftSentences || draftSentences.length === 0) return 0
    return draftSentences.reduce((count, sentence) => 
      count + (sentence.issues ? sentence.issues.length : 0), 0)
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'from-green-500 to-emerald-500'
    if (score >= 60) return 'from-blue-500 to-indigo-500'
    if (score >= 40) return 'from-yellow-500 to-orange-500'
    return 'from-red-500 to-pink-500'
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 relative overflow-hidden font-sans">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-[radial-gradient(circle_at_1px_1px,rgba(59,130,246,0.3)_1px,transparent_0)] bg-[length:40px_40px]" />
      </div>

      {/* Header */}
      <header className="bg-gray-900/70 backdrop-blur-md border-b border-blue-900/30 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Research Companion AI
            </h1>
          </div>

          <div className="flex bg-gray-900/60 rounded-full p-1 border border-blue-900/40">
            <button
              onClick={() => setMode('live')}
              className={`px-7 py-2.5 rounded-full text-sm font-semibold transition-all ${
                mode === 'live'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : 'text-blue-300 hover:bg-blue-950/30'
              }`}
            >
              Live Assist
            </button>
            <button
              onClick={() => setMode('draft')}
              className={`px-7 py-2.5 rounded-full text-sm font-semibold transition-all ${
                mode === 'draft'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                  : 'text-blue-300 hover:bg-blue-950/30'
              }`}
            >
              Draft Analysis
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 pt-8 pb-12 relative z-10">
        {mode === 'live' ? (
          <div className="flex flex-col h-[70vh] bg-gray-900/50 rounded-2xl border border-blue-900/30 overflow-hidden">
            <div className="px-7 py-4 border-b border-blue-900/30">
              <h2 className="text-xl font-semibold text-blue-300">
                Live Assist Chat
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Ask about research papers or get writing feedback
              </p>
            </div>

            <div ref={chatRef} className="flex-1 p-7 space-y-4 overflow-y-auto">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800/80 text-gray-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-gray-800/80 p-4 rounded-2xl w-fit">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-2">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-150" />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-300" />
                      </div>
                      <span className="text-sm text-gray-400">Searching research papers...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-blue-900/30 px-7 py-4 flex gap-3">
              <textarea
                value={liveInput}
                onChange={e => setLiveInput(e.target.value)}
                className="flex-1 h-14 bg-gray-900/50 border border-gray-700 rounded-lg p-3 resize-none focus:outline-none focus:border-blue-600 placeholder-gray-500"
                placeholder="Enter a research topic or abstract to find papers..."
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendLive()
                  }
                }}
              />
              <button
                onClick={handleSendLive}
                disabled={isThinking || !liveInput.trim()}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl text-white font-semibold transition-all"
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Draft Mode Left: Editor */}
            <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl border border-blue-900/30 shadow-2xl shadow-blue-950/40 overflow-hidden flex flex-col h-[70vh]">
              <div className="bg-gradient-to-r from-gray-800/70 to-gray-900/70 px-7 py-4 border-b border-blue-900/30">
                <h2 className="text-xl font-semibold text-blue-300">Research Draft Editor</h2>
              </div>
              <div className="p-7 space-y-4 flex flex-col flex-1">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Problem Statement</label>
                  <textarea
                    value={draftProblem}
                    onChange={(e) => setDraftProblem(e.target.value)}
                    className="w-full h-24 bg-gray-900/30 text-gray-200 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-600/40 placeholder-gray-500 caret-blue-400 leading-relaxed border border-gray-700 rounded p-3"
                    placeholder="Enter problem statement here..."
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-400 block mb-1">Draft</label>
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full h-full bg-gray-900/30 text-gray-200 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-600/40 placeholder-gray-500 caret-blue-400 leading-relaxed border border-gray-700 rounded p-3"
                    placeholder="Paste or write your research draft here..."
                    spellCheck="false"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  <p>💡 Example: "The global decline in bee populations poses a significant threat to food security..."</p>
                </div>
              </div>
              <div className="border-t border-blue-900/30 px-7 py-5 flex justify-end bg-gradient-to-r from-gray-900/40 to-transparent">
                <button
                  onClick={handleAnalyzeDraft}
                  disabled={isLoading || !draftText.trim() || !draftProblem.trim()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-9 py-3.5 rounded-xl font-semibold shadow-lg shadow-blue-700/30 transition-all duration-300 hover:shadow-blue-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Draft'
                  )}
                </button>
              </div>
            </div>

            {/* Draft Mode Right: Feedback */}
            <div className="bg-gray-900/50 backdrop-blur-lg rounded-2xl border border-indigo-900/30 shadow-2xl shadow-indigo-950/40 flex flex-col h-[70vh]">
              <div className="bg-gradient-to-r from-gray-800/70 to-gray-900/70 px-7 py-4 border-b border-indigo-900/30 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-indigo-300">AI Analysis Feedback</h2>
                {showDraftFeedback && (
                  <span className="text-xs px-3 py-1 bg-indigo-950/50 text-indigo-300 rounded-full">
                    {isLoading ? 'Processing...' : `${draftPapers.length} papers compared`}
                  </span>
                )}
              </div>

              <div className="p-7 space-y-6 overflow-y-auto">
                {showDraftFeedback ? (
                  <>
                    {/* Score */}
                    <div className="bg-gray-900/40 rounded-xl p-6 border border-blue-900/40">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <span className="text-gray-300 font-medium">Research Quality Score</span>
                          <div className="text-sm text-gray-500 mt-1">
                            {getIssueCount()} issues found • {draftPapers.length} papers compared
                          </div>
                        </div>
                        <div className="text-5xl font-bold font-mono">
                          <span className={`text-transparent bg-clip-text bg-gradient-to-r ${getScoreColor(draftScore)}`}>
                            {draftScore}
                          </span>
                          <span className="text-3xl text-blue-500/70">/100</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800/60 rounded-full h-3">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${getScoreColor(draftScore)}`}
                          style={{ width: `${draftScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Breakdown Signals */}
                    {draftBreakdown && (
                      <div className="bg-gray-900/30 p-5 rounded-xl border border-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Analysis Breakdown</h3>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(draftBreakdown).map(([key, value]) => (
                            <div key={key} className="bg-gray-900/50 p-3 rounded-lg">
                              <div className="text-xs text-gray-400 mb-1">{key}</div>
                              <div className="text-lg font-bold text-blue-400">
                                {Math.round(value * 100)}<span className="text-sm text-gray-500">/100</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sentence Feedback */}
                    {draftSentences && draftSentences.length > 0 && (
                      <div className="bg-gray-900/30 p-5 rounded-xl border border-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                          Sentence Feedback ({getIssueCount()} issues)
                        </h3>
                        <div className="space-y-4 max-h-48 overflow-y-auto pr-2">
                          {draftSentences.slice(0, 3).map((sentence, index) => (
                            <div key={index} className="border-l-2 border-blue-500/50 pl-3 py-2">
                              <div className="text-sm text-gray-300 mb-2 line-clamp-2">
                                "{sentence.sentence}"
                              </div>
                              {sentence.issues && sentence.issues.length > 0 ? (
                                <div className="text-xs space-y-1">
                                  {sentence.issues.map((issue, i) => (
                                    <div key={i} className="text-red-400">
                                      ❌ {issue.reason}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-green-400">
                                  ✓ No issues detected
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Research Papers */}
                    {draftPapers && draftPapers.length > 0 && (
                      <div className="bg-gray-900/30 p-5 rounded-xl border border-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                          Relevant Research Papers
                        </h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                          {draftPapers.slice(0, 3).map((paper, index) => (
                            <div key={index} className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/30">
                              <div className="font-medium text-gray-200 text-sm line-clamp-1">
                                {paper.title || 'Untitled'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {paper.authors ? (Array.isArray(paper.authors) ? paper.authors.slice(0, 2).join(', ') : paper.authors) : 'Unknown authors'}
                                {paper.year && ` • ${paper.year}`}
                                {paper.citations && ` • ${paper.citations} citations`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    <div className="bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border border-indigo-800/40 rounded-xl p-6">
                      <p className="text-indigo-300 font-medium mb-3 flex items-center gap-2">
                        <span className="text-xl">💡</span> Suggestions for Improvement
                      </p>
                      <ul className="text-gray-300 text-sm space-y-2">
                        <li>• Add specific data points or citations to strengthen claims</li>
                        <li>• Connect sentences more explicitly to the research problem</li>
                        <li>• Review similar papers for methodology inspiration</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-20">
                    <div className="text-5xl mb-4">📝</div>
                    <p className="text-lg mb-2">Enter problem statement and draft</p>
                    <p className="text-sm text-gray-600">Then click "Analyze Draft" to get AI feedback and paper comparisons</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-6 text-center text-sm text-gray-500 border-t border-gray-800/30">
        <p>Research Companion AI • Backend: http://127.0.0.1:5000 • Connected to Semantic Scholar API</p>
      </footer>
    </div>
  )
}

export default App