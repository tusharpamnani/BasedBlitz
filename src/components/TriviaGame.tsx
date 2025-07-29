"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect } from "wagmi";
import { ShareButton } from "./ui/Share";

// Toast notification component
const Toast = ({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor =
    type === "success"
      ? "bg-green-500"
      : type === "error"
      ? "bg-red-500"
      : "bg-blue-500";

  return (
    <div
      className={`fixed top-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm`}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium">{message}</span>
        <button
          onClick={onClose}
          className="ml-2 text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Trivia questions
const TRIVIA_QUESTIONS = [
  {
    id: 1,
    question: "What is the capital of France?",
    correctAnswer: "Paris",
    options: ["London", "Berlin", "Paris", "Madrid"],
  },
  {
    id: 2,
    question: "Which planet is known as the Red Planet?",
    correctAnswer: "Mars",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
  },
  {
    id: 3,
    question: "What is 2 + 2?",
    correctAnswer: "4",
    options: ["3", "4", "5", "6"],
  },
  {
    id: 4,
    question: "Who painted the Mona Lisa?",
    correctAnswer: "Leonardo da Vinci",
    options: [
      "Vincent van Gogh",
      "Pablo Picasso",
      "Leonardo da Vinci",
      "Michelangelo",
    ],
  },
  {
    id: 5,
    question: "What is the largest ocean on Earth?",
    correctAnswer: "Pacific Ocean",
    options: [
      "Atlantic Ocean",
      "Indian Ocean",
      "Pacific Ocean",
      "Arctic Ocean",
    ],
  },
];

interface GameState {
  currentQuestion: (typeof TRIVIA_QUESTIONS)[0] | null;
  timeLeft: number;
  isAnswering: boolean;
  selectedAnswer: string;
  isCorrect: boolean | null;
  roundId: number;
  showResult: boolean;
}

interface PlayerStats {
  score: number;
  streak: number;
}

interface LeaderboardEntry {
  fid: number;
  username: string;
  score: number;
  streak: number;
  lastPlayed: string;
}

export default function TriviaGame() {
  // Farcaster user context
  const [context, setContext] = useState<any>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Helper function to get the best available wallet address
  const getBestWalletAddress = useCallback(() => {
    // Priority: connected wallet > context wallet > null
    if (connectedWalletAddress && isConnected) {
      return connectedWalletAddress;
    }
    return null;
  }, [connectedWalletAddress, isConnected]);

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    currentQuestion: null,
    timeLeft: 30,
    isAnswering: false,
    selectedAnswer: "",
    isCorrect: null,
    roundId: 0,
    showResult: false,
  });

  const [playerStats, setPlayerStats] = useState<PlayerStats>({
    score: 0,
    streak: 0,
  });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [pendingTokens, setPendingTokens] = useState<string>("0");
  const [isClaiming, setIsClaiming] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Farcaster SDK
  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        setContext(context);
        setIsSDKLoaded(true);

        // Load player stats if user is authenticated
        if (context?.user?.fid) {
          await loadPlayerStats(context.user.fid);
        }
      } catch (error) {
        console.error("Failed to load Farcaster context:", error);
        setIsSDKLoaded(true); // Continue without context for testing
      }
    };

    load();
  }, []);

  // Load player stats and pending tokens
  const loadPlayerStats = async (fid: number) => {
    try {
      // Load player stats from leaderboard
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get",
          limit: 100, // Get all entries to find the user
          fid: fid,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.leaderboard) {
          // Find the user's entry in the leaderboard
          const userEntry = data.leaderboard.find(
            (entry: any) => entry.fid === fid
          );
          if (userEntry) {
            setPlayerStats({
              score: userEntry.score || 0,
              streak: userEntry.streak || 0,
            });
          }
        }
      }

      // Load pending tokens
      const pendingResponse = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getPending",
          fid: fid,
        }),
      });

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        if (pendingData.success && pendingData.pendingAmount) {
          setPendingTokens(pendingData.pendingAmount.toString());
        }
      }
    } catch (error) {
      console.error("Failed to load player stats:", error);
    }
  };

  // Refresh player stats
  const refreshPlayerStats = useCallback(() => {
    if (context?.user?.fid) {
      loadPlayerStats(context.user.fid);
    }
  }, [context?.user?.fid]);

  // Start a new round
  const startNewRound = useCallback(() => {
    const randomQuestion =
      TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    const newRoundId = gameState.roundId + 1;

    setGameState({
      currentQuestion: randomQuestion,
      timeLeft: 30,
      isAnswering: true,
      selectedAnswer: "",
      isCorrect: null,
      roundId: newRoundId,
      showResult: false,
    });

    showToast(`🎯 Question ${newRoundId}: Get ready!`, "info");
  }, [gameState.roundId]);

  // Submit answer
  const submitAnswer = useCallback(async () => {
    if (!gameState.currentQuestion || !gameState.selectedAnswer) {
      showToast("Please select an answer!", "error");
      return;
    }

    const isCorrect =
      gameState.selectedAnswer === gameState.currentQuestion.correctAnswer;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Update game state
    setGameState((prev) => ({
      ...prev,
      isAnswering: false,
      isCorrect,
      showResult: true,
    }));

    // Update player stats
    const newStats = {
      score: isCorrect ? playerStats.score + 1 : playerStats.score,
      streak: isCorrect ? playerStats.streak + 1 : 0,
    };
    setPlayerStats(newStats);

    // Save game result and potentially mint tokens if user is authenticated
    if (context?.user?.fid) {
      try {
        const response = await fetch("/api/game-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username,
            score: newStats.score,
            streak: newStats.streak,
            roundId: gameState.roundId,
            isCorrect,
            question: gameState.currentQuestion?.question,
            selectedAnswer: gameState.selectedAnswer,
            correctAnswer: gameState.currentQuestion?.correctAnswer,
            context, // Pass the full context to get user's actual wallet
            walletAddress: getBestWalletAddress(), // Include connected wallet address
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Show token reward message if tokens were minted
            if (result.tokenReward || result.participationReward) {
              showToast(result.message, "success");

              // Add tokens to pending claims instead of immediate minting
              const tokenAmount = result.tokenReward
                ? result.tokenAmount
                : result.participationAmount;
              if (tokenAmount && parseFloat(tokenAmount) > 0) {
                try {
                  await fetch("/api/leaderboard", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "addPending",
                      fid: context.user.fid,
                      amount: tokenAmount,
                    }),
                  });

                  // Update pending tokens display
                  setPendingTokens((prev) => {
                    const current = parseFloat(prev) || 0;
                    const newAmount = current + parseFloat(tokenAmount);
                    return newAmount.toString();
                  });

                  showToast(
                    `${tokenAmount} $BLITZ added to pending claims! Claim them from the leaderboard.`,
                    "info"
                  );
                } catch (error) {
                  console.error("Failed to add pending tokens:", error);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to save game result:", error);
      }
    }

    // Show result
    if (isCorrect) {
      showToast(
        `🎉 Correct! Score: ${newStats.score}, Streak: ${newStats.streak}`,
        "success"
      );
    } else {
      showToast(
        `❌ Wrong! Answer: ${gameState.currentQuestion.correctAnswer}`,
        "error"
      );
    }
  }, [gameState, playerStats, context]);

  // Timer effect
  useEffect(() => {
    if (gameState.isAnswering && gameState.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          if (prev.timeLeft <= 1) {
            // Time's up - auto submit if answer selected
            if (prev.selectedAnswer) {
              setTimeout(() => submitAnswer(), 100);
            } else {
              // No answer selected - mark as wrong
              setTimeout(async () => {
                setGameState((current) => ({
                  ...current,
                  isAnswering: false,
                  isCorrect: false,
                  showResult: true,
                }));
                setPlayerStats((currentStats) => ({
                  ...currentStats,
                  streak: 0,
                }));
                showToast("⏰ Time's up! No answer selected.", "error");

                // Save game result for timeout case
                if (context?.user?.fid) {
                  try {
                    const response = await fetch("/api/game-result", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        fid: context.user.fid,
                        username: context.user.username,
                        score: playerStats.score,
                        streak: 0, // Reset streak on timeout
                        roundId: gameState.roundId,
                        isCorrect: false,
                        question: gameState.currentQuestion?.question,
                        selectedAnswer: "",
                        correctAnswer: gameState.currentQuestion?.correctAnswer,
                        context, // Pass the full context to get user's actual wallet
                      }),
                    });

                    if (response.ok) {
                      const result = await response.json();
                      if (
                        result.success &&
                        (result.tokenReward || result.participationReward)
                      ) {
                        showToast(result.message, "success");

                        // Add tokens to pending claims instead of immediate minting
                        const tokenAmount = result.tokenReward
                          ? result.tokenAmount
                          : result.participationAmount;
                        if (tokenAmount && parseFloat(tokenAmount) > 0) {
                          try {
                            await fetch("/api/leaderboard", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "addPending",
                                fid: context.user.fid,
                                amount: tokenAmount,
                              }),
                            });

                            // Update pending tokens display
                            setPendingTokens((prev) => {
                              const current = parseFloat(prev) || 0;
                              const newAmount =
                                current + parseFloat(tokenAmount);
                              return newAmount.toString();
                            });

                            showToast(
                              `${tokenAmount} $BLITZ added to pending claims! Claim them from the leaderboard.`,
                              "info"
                            );
                          } catch (error) {
                            console.error(
                              "Failed to add pending tokens:",
                              error
                            );
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error(
                      "Failed to save game result on timeout:",
                      error
                    );
                  }
                }
              }, 100);
            }
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [
    gameState.isAnswering,
    gameState.timeLeft,
    gameState.selectedAnswer,
    submitAnswer,
  ]);

  // Share result on Farcaster
  // Cast configuration for sharing
  const cast = {
    text: gameState.showResult
      ? gameState.isCorrect
        ? `🎉 Just got it right in Based Blitz! Score: ${playerStats.score}, Streak: ${playerStats.streak} 🔥`
        : `🤔 Tough question in Based Blitz! Current score: ${playerStats.score}. Can you beat me?`
      : "🎮 Playing Based Blitz! Test your knowledge and earn $BLITZ tokens!",
    embeds: ["https://triviablitz.xyz"],
  };

  // Loading state for share button
  const [isShareLoading, setIsShareLoading] = useState(false);

  const shareResult = async () => {
    if (!gameState.showResult) return;

    try {
      setIsShareLoading(true);
      const resultText = gameState.isCorrect
        ? `🎉 Just got it right in Based Blitz! Score: ${playerStats.score}, Streak: ${playerStats.streak} 🔥`
        : `🤔 Tough question in Based Blitz! Current score: ${playerStats.score}. Can you beat me?`;

      if (sdk.actions && "openUrl" in sdk.actions) {
        await sdk.actions.openUrl(
          `https://warpcast.com/~/compose?text=${encodeURIComponent(
            resultText
          )}&embeds[]=https://triviablitz.xyz`
        );
      } else {
        // Fallback for testing
        console.log("Would share:", resultText);
        showToast("✅ Share prepared! (Demo mode)", "success");
      }
    } catch (error) {
      console.error("Share failed:", error);
      showToast("Share failed", "error");
    } finally {
      setIsShareLoading(false);
    }
  };

  // Load leaderboard
  const loadLeaderboard = async () => {
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", limit: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      // Fallback mock data
      setLeaderboard([
        {
          fid: 1,
          username: "alice",
          score: 15,
          streak: 5,
          lastPlayed: "2 min ago",
        },
        {
          fid: 2,
          username: "bob",
          score: 12,
          streak: 3,
          lastPlayed: "5 min ago",
        },
        {
          fid: 3,
          username: "charlie",
          score: 10,
          streak: 2,
          lastPlayed: "8 min ago",
        },
      ]);
    }
  };

  // Claim pending tokens
  const claimTokens = async () => {
    if (!context?.user?.fid || isClaiming) return;

    setIsClaiming(true);
    try {
      const response = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "claim",
          fid: context.user.fid,
          context,
          walletAddress: getBestWalletAddress(), // Include connected wallet address
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          showToast(result.message, "success");
          setPendingTokens("0");
          // Refresh stats after claiming
          refreshPlayerStats();
        } else {
          showToast(result.error || "Failed to claim tokens", "error");
        }
      } else {
        showToast("Failed to claim tokens", "error");
      }
    } catch (error) {
      console.error("Failed to claim tokens:", error);
      showToast("Failed to claim tokens", "error");
    } finally {
      setIsClaiming(false);
    }
  };

  // Realtime leaderboard updates
  useEffect(() => {
    if (showLeaderboard) {
      // Load initial data
      loadLeaderboard();

      // Set up realtime updates every 5 seconds
      const interval = setInterval(() => {
        loadLeaderboard();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [showLeaderboard]);

  // Auto-connection effect (similar to WalletTab.tsx)
  useEffect(() => {
    // Check if we're in a Farcaster client environment
    const isInFarcasterClient =
      typeof window !== "undefined" &&
      (window.location.href.includes("warpcast.com") ||
        window.location.href.includes("farcaster") ||
        window.ethereum?.isFarcaster ||
        context?.client);

    if (
      context?.user?.fid &&
      !isConnected &&
      connectors.length > 0 &&
      isInFarcasterClient
    ) {
      console.log(
        "TriviaGame: Attempting auto-connection with Farcaster context..."
      );
      console.log("- User FID:", context.user.fid);
      console.log(
        "- Available connectors:",
        connectors.map((c: any, i: number) => `${i}: ${c.name}`)
      );
      console.log("- Using connector:", connectors[0].name);
      console.log("- In Farcaster client:", isInFarcasterClient);

      // Use the first connector (farcasterFrame) for auto-connection
      try {
        connect({ connector: connectors[0] });
      } catch (error) {
        console.error("TriviaGame: Auto-connection failed:", error);
      }
    } else {
      console.log("TriviaGame: Auto-connection conditions not met:");
      console.log("- Has context:", !!context?.user?.fid);
      console.log("- Is connected:", isConnected);
      console.log("- Has connectors:", connectors.length > 0);
      console.log("- In Farcaster client:", isInFarcasterClient);
    }
  }, [context?.user?.fid, isConnected, connectors, connect, context?.client]);

  // Load player stats when user context is available
  useEffect(() => {
    if (context?.user?.fid) {
      loadPlayerStats(context.user.fid);
    }
  }, [context?.user?.fid]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Based Blitz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow-lg max-w-md mx-auto min-h-screen">
      {/* Toast notifications */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-blue-600 mb-2">
          🧠 Based Blitz
        </h1>
        {context?.user && (
          <p className="text-sm text-gray-600">
            Welcome, @{context.user.username}!
          </p>
        )}
      </div>

      {/* Wallet Status */}
      <div className="w-full max-w-sm mb-4">
        <div
          className={`p-3 rounded-lg border ${
            isConnected
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-yellow-50 border-yellow-300 text-yellow-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {isConnected ? "✅ Wallet Connected" : "⚠️ No Wallet Connected"}
              </p>
              {connectedWalletAddress && (
                <p className="text-xs mt-1 opacity-75">
                  {connectedWalletAddress.slice(0, 6)}...
                  {connectedWalletAddress.slice(-4)}
                </p>
              )}
            </div>
            {!isConnected && (
              <p className="text-xs opacity-75">
                Connect wallet to claim tokens
              </p>
            )}
          </div>
        </div>
      </div>

      {/* How to Play Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-bold mb-3 text-gray-800">How to Play:</h3>
        <ul className="text-sm space-y-2 text-left">
          <li className="flex items-center gap-2">
            <span className="text-blue-500">⏰</span>
            Answer questions within 30 seconds
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-500">✅</span>
            Select the correct option
          </li>
          <li className="flex items-center gap-2">
            <span className="text-yellow-500">🏆</span>
            +1 point per correct answer
          </li>
          <li className="flex items-center gap-2">
            <span className="text-purple-500">🔥</span>
            Build your streak!
          </li>
          <li className="flex items-center gap-2">
            <span className="text-pink-500">📤</span>
            Share your results
          </li>
        </ul>
      </div>

      {/* Timer */}
      {gameState.isAnswering && (
        <div
          className={`text-2xl font-bold mb-4 ${
            gameState.timeLeft <= 5
              ? "text-red-500 animate-pulse"
              : "text-blue-600"
          }`}
        >
          ⏰ {gameState.timeLeft}s
        </div>
      )}

      {/* Current Question */}
      {gameState.currentQuestion && (
        <div className="w-full max-w-sm">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-bold text-blue-600 mb-2">
              Question #{gameState.roundId}
            </h3>
            <p className="text-gray-800 mb-4">
              {gameState.currentQuestion.question}
            </p>

            {/* Answer Options */}
            {gameState.isAnswering && (
              <div className="space-y-2 mb-4">
                {gameState.currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() =>
                      setGameState((prev) => ({
                        ...prev,
                        selectedAnswer: option,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      gameState.selectedAnswer === option
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white hover:bg-blue-50 border-gray-300"
                    }`}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </button>
                ))}

                <button
                  onClick={submitAnswer}
                  disabled={!gameState.selectedAnswer}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 mt-4"
                >
                  Submit Answer
                </button>
              </div>
            )}

            {/* Result */}
            {gameState.showResult && (
              <div
                className={`text-center p-3 rounded-lg ${
                  gameState.isCorrect ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <p
                  className={`font-bold text-lg mb-2 ${
                    gameState.isCorrect ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {gameState.isCorrect ? "🎉 Correct!" : "❌ Wrong!"}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Answer: {gameState.currentQuestion.correctAnswer}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={startNewRound}
          disabled={gameState.isAnswering}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {gameState.isAnswering ? "Round in Progress" : "Start New Round"}
        </button>
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="bg-gray-500 text-white px-4 py-3 rounded-lg font-bold hover:bg-gray-600"
        >
          🏆
        </button>
      </div>

      {/* Share Result Button */}
      <ShareButton
        buttonText="Share Result"
        cast={cast}
        isLoading={isShareLoading}
      />

      {/* Home Screen with Player Stats */}
      {!gameState.currentQuestion && (
        <div className="text-center text-gray-600 max-w-sm space-y-6">
          {/* Player Stats Section */}
          {context?.user && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-bold text-blue-600 mb-4">
                🎯 Your Stats
              </h3>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-sm text-gray-600">Total Score</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {playerStats.score}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <p className="text-sm text-gray-600">Best Streak</p>
                  <p className="text-2xl font-bold text-green-600">
                    {playerStats.streak}
                  </p>
                </div>
              </div>

              {/* Pending Tokens */}
              {parseFloat(pendingTokens) > 0 && (
                <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-yellow-800">
                        💰 Pending Tokens
                      </p>
                      <p className="text-sm text-yellow-700">
                        {pendingTokens} $BLITZ
                      </p>
                    </div>
                    <button
                      onClick={claimTokens}
                      disabled={isClaiming}
                      className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 disabled:bg-gray-400"
                    >
                      {isClaiming ? "Claiming..." : "Claim"}
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    setShowLeaderboard(!showLeaderboard);
                    // Refresh stats when toggling leaderboard
                    if (!showLeaderboard) {
                      refreshPlayerStats();
                    }
                  }}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
                >
                  🏆 Leaderboard
                </button>
                <button
                  onClick={startNewRound}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  🎮 Play Now
                </button>
              </div>
            </div>
          )}

          {/* Quick Start Button for Non-Authenticated Users */}
          {!context?.user && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700 mb-3">
                Connect your wallet to track your progress and earn $BLITZ
                tokens!
              </p>
              <button
                onClick={startNewRound}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700"
              >
                🎮 Start Playing
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leaderboard */}
      {showLeaderboard && (
        <div className="w-full max-w-sm bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-bold text-blue-600 mb-3">
            🏆 Leaderboard
          </h3>

          {/* Pending Tokens Section */}
          {parseFloat(pendingTokens) > 0 && (
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-yellow-800">💰 Pending Tokens</p>
                  <p className="text-sm text-yellow-700">
                    {pendingTokens} $BLITZ
                  </p>
                </div>
                <button
                  onClick={claimTokens}
                  disabled={isClaiming}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 disabled:bg-gray-400"
                >
                  {isClaiming ? "Claiming..." : "Claim Tokens"}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.fid}
                className="flex justify-between items-center bg-white p-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-600">
                    #{index + 1}
                  </span>
                  <div>
                    <p className="font-medium">@{entry.username}</p>
                    <p className="text-sm text-gray-600">
                      Streak: {entry.streak}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{entry.score} pts</p>
                  <p className="text-xs text-gray-500">{entry.lastPlayed}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Realtime indicator */}
          <div className="text-center mt-3">
            <p className="text-xs text-gray-500">🔄 Updates every 5 seconds</p>
          </div>
        </div>
      )}
    </div>
  );
}
