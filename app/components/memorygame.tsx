"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAccount } from "wagmi";
import sdk from "@farcaster/miniapp-sdk";

/**
 * Fixed BaseMemoryGame component with MiniKit transaction after each level
 * - After each level completion, shows transaction modal
 * - User can pay fee or skip to next level
 * - Properly integrated with game flow
 */

type Pair = { term: string; definition: string };

interface Card {
  id: string;
  content: string;
  pairId: number;
  isFlipped: boolean;
  isMatched: boolean;
}

const LEVEL_DATA: Record<number, { theme: string; lesson: string; pairs: Pair[]; quiz: { question: string; options: string[]; answer: number } }> = {
  1: {
    theme: "Base L2 Foundations",
    lesson:
      "Base leverages the OP Stack to provide Ethereum security with significantly lower fees. It utilizes 'Bedrock' architecture for modularity.",
    pairs: [
      { term: "Bedrock", definition: "Current modular architecture of the OP Stack." },
      { term: "L2 Finality", definition: "When a transaction is finalized on L1 Ethereum." },
      { term: "Sequencer", definition: "The node responsible for ordering L2 transactions." },
      { term: "EIP-4844", definition: "Proto-Danksharding using blobs for cheaper data." },
    ],
    quiz: {
      question: "Which Ethereum upgrade introduced 'Blobs' to reduce L2 fees?",
      options: ["The Merge", "EIP-1559", "EIP-4844", "Shapella"],
      answer: 2,
    },
  },
  2: {
    theme: "Paymaster Protocol",
    lesson:
      "Paymasters allow decentralized applications to sponsor gas fees for their users, enabling a 'gasless' onboarding experience.",
    pairs: [
      { term: "Gas Sponsorship", definition: "Paymaster pays the gas fee for the user." },
      { term: "Verifying Paymaster", definition: "Validates UserOps using an off-chain service." },
      { term: "Deposit", definition: "Funds held by Paymaster in the EntryPoint." },
      { term: "ERC-20 Paymaster", definition: "Allows paying gas in tokens like USDC." },
      { term: "CDP Paymaster", definition: "Coinbase's managed gas sponsorship service." },
    ],
    quiz: {
      question: "What is the primary function of a Paymaster in Account Abstraction?",
      options: ["Ordering transactions", "Sponsoring user gas fees", "Mining new blocks", "Storing user private keys"],
      answer: 1,
    },
  },
};

const TOTAL_LEVELS = 20;
for (let i = 3; i <= TOTAL_LEVELS; i++) {
  if (LEVEL_DATA[i]) continue;
  const complexity = i > 15 ? "Extreme" : i > 10 ? "Advanced" : "Intermediate";
  LEVEL_DATA[i] = {
    theme: `${complexity} Protocol - Layer ${i}`,
    lesson: `Layer ${i} deepens the integration of autonomous agents and Paymaster sponsorship logic. High security is non-negotiable.`,
    pairs: Array.from({ length: Math.min(6, 4 + Math.floor(i / 3)) }).map((_, idx) => ({
      term: `Logic Hook ${i}-${idx + 1}`,
      definition: `Custom execution ${i}-${idx + 1} triggered on transaction.`,
    })),
    quiz: {
      question: `Layer ${i} Security Check: How are Agentic sessions secured?`,
      options: ["Plaintext storage", "Scoped Session Keys", "No security", "Public visibility"],
      answer: 1,
    },
  };
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* SSR-safe localStorage helpers */
const safeGetNumber = (key: string, fallback: number): number => {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const v = parseInt(raw, 10);
  return Number.isNaN(v) ? fallback : v;
};
const safeGetString = (key: string, fallback: string): string => {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) ?? fallback;
};

const BaseMemoryGame: React.FC = () => {
  const [level, setLevel] = useState<number>(() => safeGetNumber("base_level", 1));
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [score, setScore] = useState<number>(() => safeGetNumber("base_score", 0));
  const [hints, setHints] = useState<number>(() => safeGetNumber("base_hints", 3));
  const [quizzesSolved, setQuizzesSolved] = useState<number>(() => safeGetNumber("base_quizzes", 0));

  // Wallet connection from wagmi
  const { address, isConnected, connector } = useAccount();

  // Game states
  const [showQuiz, setShowQuiz] = useState(false);
  const [showLesson, setShowLesson] = useState(false);
  const [gameComplete, setGameComplete] = useState(false);

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => safeGetString("base_theme", "dark") === "dark");
  const [streak, setStreak] = useState<number>(() => safeGetNumber("base_streak", 0));
  const [canGM, setCanGM] = useState<boolean>(false);

  const timersRef = useRef<number[]>([]);
  const flipBackDelay = useMemo(() => Math.max(250, 1000 - level * 40), [level]);

  const initLevel = useCallback((lvl: number) => {
    const data = LEVEL_DATA[lvl];
    const gameCards: Card[] = [];
    data.pairs.forEach((pair, index) => {
      gameCards.push({ id: `t-${lvl}-${index}`, content: pair.term, pairId: index, isFlipped: false, isMatched: false });
      gameCards.push({ id: `d-${lvl}-${index}`, content: pair.definition, pairId: index, isFlipped: false, isMatched: false });
    });
    setCards(shuffle(gameCards));
    setFlippedIndices([]);
    setShowLesson(false);
    if (typeof window !== "undefined") localStorage.setItem("base_level", String(lvl));
  }, []);

  useEffect(() => {
    // theme & gm initialization
    const savedTheme = safeGetString("base_theme", "dark");
    if (savedTheme === "light") setIsDarkMode(false);

    const lastGM = safeGetString("base_last_gm", "");
    const savedStreak = safeGetNumber("base_streak", 0);
    const today = new Date().toDateString();

    if (lastGM !== today) {
      setCanGM(true);
      if (lastGM) {
        const lastDate = new Date(lastGM);
        const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays > 1) {
          if (typeof window !== "undefined") localStorage.setItem("base_streak", "0");
          setStreak(0);
        } else {
          setStreak(savedStreak);
        }
      }
    } else {
      setCanGM(false);
      setStreak(savedStreak);
    }

    // ensure defaults
    if (typeof window !== "undefined") {
      localStorage.setItem("base_score", String(score));
      localStorage.setItem("base_hints", String(hints));
      localStorage.setItem("base_quizzes", String(quizzesSolved));
    }

    initLevel(level);

    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("base_score", String(score));
  }, [score]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("base_hints", String(hints));
  }, [hints]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("base_quizzes", String(quizzesSolved));
  }, [quizzesSolved]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("base_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((v) => !v);

  const handleGM = () => {
    if (!canGM) return;
    const newStreak = streak + 1;
    setStreak(newStreak);
    setCanGM(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("base_streak", String(newStreak));
      localStorage.setItem("base_last_gm", new Date().toDateString());
    }
    setScore((s) => s + 500);
    setHints((h) => h + 1);
  };

  const handleCardClick = (index: number) => {
    if (flippedIndices.length === 2) return;
    const c = cards[index];
    if (!c || c.isFlipped || c.isMatched) return;

    const newCards = [...cards];
    newCards[index] = { ...c, isFlipped: true };
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [i1, i2] = newFlipped;
      const a = newCards[i1];
      const b = newCards[i2];

      if (a.pairId === b.pairId) {
        const id = window.setTimeout(() => {
          const matched = [...newCards];
          matched[i1] = { ...matched[i1], isMatched: true };
          matched[i2] = { ...matched[i2], isMatched: true };
          setCards(matched);
          setFlippedIndices([]);
          setScore((s) => s + 30 * level);

          if (matched.every((c) => c.isMatched)) {
            setShowQuiz(true);
          }
        }, 200);
        timersRef.current.push(id);
      } else {
        const id = window.setTimeout(() => {
          const reset = [...newCards];
          reset[i1] = { ...reset[i1], isFlipped: false };
          reset[i2] = { ...reset[i2], isFlipped: false };
          setCards(reset);
          setFlippedIndices([]);
        }, flipBackDelay);
        timersRef.current.push(id);
      }
    }
  };

  const useHint = () => {
    if (hints <= 0 || flippedIndices.length > 0) return;
    setHints((h) => h - 1);
    const unmatchedIdx = cards.findIndex((c) => !c.isMatched && !c.isFlipped);
    if (unmatchedIdx === -1) return;
    const pairId = cards[unmatchedIdx].pairId;
    const indices = cards.reduce<number[]>((acc, c, idx) => (c.pairId === pairId ? acc.concat(idx) : acc), []);
    const hinted = [...cards];
    indices.forEach((i) => (hinted[i] = { ...hinted[i], isFlipped: true }));
    setCards(hinted);

    const id = window.setTimeout(() => {
      const reset = [...hinted];
      indices.forEach((i) => {
        if (!reset[i].isMatched) reset[i] = { ...reset[i], isFlipped: false };
      });
      setCards(reset);
    }, 1200);
    timersRef.current.push(id);
  };

  const handleQuizAnswer = async (idx: number) => {
    if (idx === LEVEL_DATA[level].quiz.answer) {
      const nextSolved = quizzesSolved + 1;
      setQuizzesSolved(nextSolved);
      setScore((s) => s + level * 200);
      if (nextSolved % 5 === 0) setHints((h) => h + 2);

      // Close quiz modal and show transaction modal
      setShowQuiz(false);
      setShowTransactionModal(true);
    } else {
      initLevel(level);
      setShowQuiz(false);
    }
  };

  // MiniKit Transaction Handler - Using Farcaster SDK directly
  const handleTransaction = async () => {
    try {
      setTransactionStatus('loading');

      // Create a small transaction (0.0001 ETH to a test address)
      const result = await sdk.actions.sendTransaction({
        chainId: 8453, // Base mainnet
        to: '0x0000000000000000000000000000000000000000', // Replace with your address
        value: '0x9184e72a', // 0.0001 ETH in hex
        data: '0x', // No data
      });

      if (result && result.transactionHash) {
        setTransactionHash(result.transactionHash);
        setTransactionStatus('success');

        // Add bonus score for completing transaction
        setScore((s) => s + 1000);

        // Move to next level after 2 seconds
        setTimeout(() => {
          proceedToNextLevel();
        }, 2000);
      } else {
        throw new Error("Transaction failed");
      }
    } catch (error) {
      console.error("Transaction error:", error);
      setTransactionStatus('error');
    }
  };

  const handleConnect = async () => {
    try {
      // Connect wallet using wagmi connector
      if (connector) {
        await connector.connect();
      }
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const skipTransaction = () => {
    // User skips transaction, proceed without bonus
    proceedToNextLevel();
  };

  const proceedToNextLevel = () => {
    if (level < TOTAL_LEVELS) {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      initLevel(nextLvl);
      setShowTransactionModal(false);
      setTransactionStatus('idle');
      setTransactionHash(null);
    } else {
      setGameComplete(true);
      setShowTransactionModal(false);
    }
  };

  const progressPercent = (level / TOTAL_LEVELS) * 100;

  const onCardKey = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(idx);
    }
  };

  // Calculate responsive grid columns based on number of pairs
  const getGridColumns = () => {
    const pairsCount = LEVEL_DATA[level].pairs.length;
    if (pairsCount <= 4) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4";
    if (pairsCount === 5) return "grid-cols-2 sm:grid-cols-3 md:grid-cols-5";
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
  };

  return (
    <>
      {/* Inline CSS for card flip animation */}
      <style jsx global>{`
        .card-container {
          perspective: 1000px;
          cursor: pointer;
          min-height: 140px;
          width: 100%;
        }
        
        .card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          text-align: center;
          transition: transform 0.6s;
          transform-style: preserve-3d;
          border-radius: 12px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        
        .card-flipped {
          transform: rotateY(180deg);
        }
        
        .card-front, .card-back {
          position: absolute;
          width: 100%;
          height: 100%;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .card-front {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }
        
        .card-back {
          background: linear-gradient(135deg, #0066ff 0%, #00c2ff 100%);
          color: white;
          transform: rotateY(180deg);
        }
        
        .card-matched {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          transform: rotateY(180deg);
        }
        
        /* Responsive adjustments */
        @media (max-width: 640px) {
          .card-container {
            min-height: 120px;
          }
          .card-front, .card-back {
            padding: 0.75rem;
          }
        }
        
        @media (max-width: 480px) {
          .card-container {
            min-height: 100px;
          }
        }
        
        /* Hover effects */
        @media (hover: hover) {
          .card-container:hover .card-inner:not(.card-flipped) {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
          }
        }
        
        /* Touch device optimizations */
        @media (max-width: 768px) {
          .card-inner {
            transition: transform 0.4s;
          }
        }
      `}</style>

      <div className={`min-h-screen p-4 md:p-8 flex flex-col items-center relative z-10 transition-colors duration-300 ${isDarkMode ? "bg-[#000814] text-white" : "bg-white text-slate-900"}`}>
        {/* Header */}
        <div className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${canGM ? "bg-orange-500 animate-pulse" : "bg-emerald-500"}`} aria-hidden />
            <span className="text-xs font-semibold tracking-wider opacity-70">Status: {canGM ? "Awaiting GM" : "Protocol Synced"}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Wallet Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
              <span className="text-xs">
                {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Wallet Disconnected"}
              </span>
            </div>
            
            <button onClick={toggleTheme} aria-pressed={!isDarkMode} className="px-3 py-2 rounded-full border text-sm">{isDarkMode ? "Switch to Light" : "Switch to Dark"}</button>
          </div>
        </div>

        {/* Meta */}
        <header className="w-full max-w-7xl flex flex-col lg:flex-row justify-between items-start gap-4 mb-8">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 shadow-inner">
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center font-bold">BD</div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">baseagent.docs.eth</p>
              <p className="text-xs opacity-60 font-mono uppercase tracking-wide">Verified Documentation Hub</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={handleGM} disabled={!canGM} className={`px-4 py-3 rounded-xl font-semibold ${canGM ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>Daily Check-in</button>
            <div className="p-3 rounded-xl bg-white/5 text-center"><p className="text-xs uppercase opacity-60">Streak</p><p className="font-bold text-2xl">{streak}</p></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><p className="text-xs uppercase opacity-60">Score</p><p className="font-bold text-2xl">{score}</p></div>
            <div className="p-3 rounded-xl bg-white/5 text-center"><p className="text-xs uppercase opacity-60">Level</p><p className="font-bold text-2xl">{level}</p></div>
          </div>
        </header>

        {/* Progress */}
        <div className="w-full max-w-5xl mb-6 px-2">
          <div className="flex justify-between text-xs font-semibold uppercase opacity-70 mb-2">
            <span>Layer {level} / {TOTAL_LEVELS}</span>
            <span>{Math.round(progressPercent)}% synced</span>
          </div>
          <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${progressPercent}%`, background: "linear-gradient(90deg,#0066ff,#00c2ff)" }} />
          </div>
        </div>

        {/* Board */}
        <main className="w-full max-w-6xl flex-grow">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
            <div>
              <h2 className="text-3xl font-extrabold uppercase">{LEVEL_DATA[level].theme}</h2>
              <p className="text-sm opacity-70 mt-1">{LEVEL_DATA[level].lesson}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowLesson(true)} className="px-4 py-2 border rounded-md">Read Docs</button>
              <button onClick={useHint} disabled={hints <= 0} className={`px-4 py-2 rounded-md ${hints > 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}>Hint ({hints})</button>
            </div>
          </div>

          <section aria-label="memory game board" className={`grid gap-4 ${getGridColumns()}`}>
            {cards.map((card, idx) => (
              <div 
                key={card.id} 
                className="card-container"
                onClick={() => handleCardClick(idx)}
                onKeyDown={(e) => onCardKey(e, idx)}
                tabIndex={0}
                role="button"
                aria-label={`card ${idx + 1} ${card.isMatched ? "matched" : card.isFlipped ? "flipped" : "face down"}`}
              >
                <div className={`card-inner ${card.isFlipped || card.isMatched ? "card-flipped" : ""}`}>
                  <div className="card-front">
                    <div className="text-sm uppercase font-semibold opacity-80">
                      {card.isMatched ? "✓ Matched" : "Tap to reveal"}
                    </div>
                  </div>
                  <div className={`card-back ${card.isMatched ? "card-matched" : ""}`}>
                    <div className="text-sm font-bold leading-tight">{card.content}</div>
                  </div>
                </div>
              </div>
            ))}
          </section>
        </main>

        {/* Quiz Modal */}
        {showQuiz && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="max-w-lg w-full bg-white/5 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-extrabold mb-4">Layer {level} Quiz</h3>
              <p className="text-lg mb-6">{LEVEL_DATA[level].quiz.question}</p>
              <div className="space-y-3">
                {LEVEL_DATA[level].quiz.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuizAnswer(idx)}
                    className="w-full p-4 text-left rounded-lg border hover:bg-white/5 transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
              <button onClick={() => setShowQuiz(false)} className="mt-6 px-4 py-2 border rounded-md">Cancel</button>
            </div>
          </div>
        )}

        {/* Transaction Modal - Shows after quiz completion */}
        {showTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="max-w-md w-full bg-white/5 backdrop-blur-lg rounded-2xl p-8">
              <h3 className="text-2xl font-extrabold mb-4">🎉 Level {level} Completed!</h3>
              
              <div className="mb-6 p-4 rounded-lg bg-blue-900/20 border border-blue-500/20">
                <p className="text-center mb-2">Complete transaction to unlock:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">✓ +1000 Bonus Points</li>
                  <li className="flex items-center gap-2">✓ Layer {level + 1} Access</li>
                  <li className="flex items-center gap-2">✓ Transaction Badge</li>
                </ul>
              </div>

              {transactionStatus === 'idle' && (
                <>
                  <div className="mb-6 p-4 rounded-lg bg-white/5">
                    <div className="flex justify-between mb-2">
                      <span className="opacity-70">Transaction Fee:</span>
                      <span className="font-bold">~$0.01 - $0.05</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">Network:</span>
                      <span className="font-bold">Base</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={!isConnected ? handleConnect : handleTransaction}
                      disabled={transactionStatus === 'loading'}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {!isConnected ? "Connect Wallet & Pay Fee" : "Pay Fee & Continue"}
                    </button>
                    
                    <button
                      onClick={skipTransaction}
                      className="w-full py-4 border rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Skip & Continue Without Bonus
                    </button>
                  </div>
                </>
              )}

              {transactionStatus === 'loading' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-lg">Processing Transaction...</p>
                  <p className="text-sm opacity-70 mt-2">Please confirm in your wallet</p>
                </div>
              )}

              {transactionStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-green-400">Transaction Successful!</p>
                  <p className="text-sm opacity-70 mt-2">+1000 Bonus Points Added</p>
                  {transactionHash && (
                    <a 
                      href={`https://basescan.org/tx/${transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View on BaseScan →
                    </a>
                  )}
                </div>
              )}

              {transactionStatus === 'error' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-red-400">Transaction Failed</p>
                  <p className="text-sm opacity-70 mt-2">Please try again or skip</p>
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={handleTransaction}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={skipTransaction}
                      className="w-full py-3 border rounded-lg"
                    >
                      Skip & Continue
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documentation Modal */}
        {showLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="max-w-2xl w-full bg-white/5 rounded-2xl p-8">
              <h3 className="text-2xl font-extrabold">Layer {level} Documentation</h3>
              <p className="mt-4 opacity-80">{LEVEL_DATA[level].lesson}</p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setShowLesson(false)} className="px-4 py-2 bg-blue-600 text-white rounded-md">Initialize Challenge</button>
                <button onClick={() => setShowLesson(false)} className="px-4 py-2 border rounded-md">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Game Complete Modal */}
        {gameComplete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="max-w-lg w-full bg-gradient-to-br from-blue-900/30 to-purple-900/30 backdrop-blur-lg rounded-2xl p-8 text-center">
              <h3 className="text-3xl font-extrabold mb-4">🎊 Mission Complete!</h3>
              <p className="text-xl mb-2">You have mastered all {TOTAL_LEVELS} layers</p>
              <p className="opacity-80 mb-6">Final Score: {score}</p>
              
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-xs uppercase opacity-60">Levels</p>
                  <p className="text-2xl font-bold">{TOTAL_LEVELS}/{TOTAL_LEVELS}</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-xs uppercase opacity-60">Quizzes</p>
                  <p className="text-2xl font-bold">{quizzesSolved}</p>
                </div>
                <div className="p-4 rounded-lg bg-white/5">
                  <p className="text-xs uppercase opacity-60">Streak</p>
                  <p className="text-2xl font-bold">{streak}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setGameComplete(false);
                  setLevel(1);
                  initLevel(1);
                }}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold text-lg"
              >
                Play Again
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-8 w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-4 text-sm opacity-70">
          <div className="p-4 rounded-lg bg-white/5">
            <p className="font-bold">Paymasters</p>
            <p className="mt-1 text-xs">The core layer for gasless user experiences on Base.</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5">
            <p className="font-bold">AI Agents</p>
            <p className="mt-1 text-xs">Autonomous onchain logic via Smart Wallets.</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5">
            <p className="font-bold">CDP SDK</p>
            <p className="mt-1 text-xs">Simplifying Paymaster and Smart Account deployments.</p>
          </div>
        </footer>
      </div>
    </>
  );
};

export default BaseMemoryGame;