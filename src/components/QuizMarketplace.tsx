"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect } from "wagmi";
import { Quiz, QuizMarketplace as MarketplaceData } from "~/lib/types";
import QuizPlayer from "./QuizPlayer";

// Utility functions moved outside component
const formatTime = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "easy":
      return "text-green-600 bg-green-100";
    case "medium":
      return "text-yellow-600 bg-yellow-100";
    case "hard":
      return "text-red-600 bg-red-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
      return "text-green-600 bg-green-100";
    case "completed":
      return "text-blue-600 bg-blue-100";
    case "draft":
      return "text-gray-600 bg-gray-100";
    default:
      return "text-gray-600 bg-gray-100";
  }
};

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

export default function QuizMarketplace() {
  // Farcaster user context
  const [context, setContext] = useState<any>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Marketplace state
  const [marketplace, setMarketplace] = useState<MarketplaceData>({
    featuredQuizzes: [],
    trendingQuizzes: [],
    categories: [],
    totalQuizzes: 0,
    totalParticipants: 0,
    totalRewardsDistributed: "0",
  });

  const [activeTab, setActiveTab] = useState<
    "featured" | "trending" | "categories" | "my-quizzes"
  >("featured");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);

  // Helper function to get the best available wallet address
  const getBestWalletAddress = useCallback(() => {
    if (connectedWalletAddress && isConnected) {
      return connectedWalletAddress;
    }
    return null;
  }, [connectedWalletAddress, isConnected]);

  // Initialize Farcaster SDK
  useEffect(() => {
    const load = async () => {
      try {
        const context = await sdk.context;
        setContext(context);
        setIsSDKLoaded(true);
      } catch (error) {
        console.error("Failed to load Farcaster context:", error);
        setIsSDKLoaded(true);
      }
    };

    load();
  }, []);

  // Load marketplace data
  const loadMarketplaceData = useCallback(async () => {
    setLoading(true);
    try {
      console.log("Loading marketplace data...");

      // Load featured quizzes
      console.log("Fetching featured quizzes...");
      const featuredResponse = await fetch("/api/quizzes?action=featured");
      const featuredData = await featuredResponse.json();
      console.log("Featured response:", featuredData);

      // Load trending quizzes
      console.log("Fetching trending quizzes...");
      const trendingResponse = await fetch("/api/quizzes?action=trending");
      const trendingData = await trendingResponse.json();
      console.log("Trending response:", trendingData);

      // Load all quizzes for categories
      console.log("Fetching all quizzes...");
      const allQuizzesResponse = await fetch("/api/quizzes?action=list");
      const allQuizzesData = await allQuizzesResponse.json();
      console.log("All quizzes response:", allQuizzesData);

      // Load user's quizzes if authenticated
      let userQuizzes: Quiz[] = [];
      if (context?.user?.fid) {
        console.log("Fetching user's quizzes...");
        try {
          const userQuizzesResponse = await fetch(
            `/api/quizzes?action=list&hostFid=${context.user.fid}`
          );
          const userQuizzesData = await userQuizzesResponse.json();
          if (userQuizzesData.success) {
            userQuizzes = userQuizzesData.quizzes || [];
            console.log("User's quizzes:", userQuizzes);
          }
        } catch (error) {
          console.error("Failed to load user's quizzes:", error);
        }
      }

      // Extract unique categories and cast to string[]
      const categories = [
        ...new Set(allQuizzesData.quizzes.map((q: Quiz) => q.category)),
      ] as string[];

      console.log("Setting marketplace data:", {
        featuredQuizzes: featuredData.featuredQuizzes || [],
        trendingQuizzes: trendingData.trendingQuizzes || [],
        categories,
        totalQuizzes: allQuizzesData.total || 0,
        totalParticipants: allQuizzesData.quizzes.reduce(
          (sum: number, q: Quiz) => sum + q.currentParticipants,
          0
        ),
        myQuizzes: userQuizzes,
      });

      setMarketplace({
        featuredQuizzes: featuredData.featuredQuizzes || [],
        trendingQuizzes: trendingData.trendingQuizzes || [],
        categories,
        totalQuizzes: allQuizzesData.total || 0,
        totalParticipants: allQuizzesData.quizzes.reduce(
          (sum: number, q: Quiz) => sum + q.currentParticipants,
          0
        ),
        totalRewardsDistributed: "0", // TODO: Calculate from results
      });
      setMyQuizzes(userQuizzes);
    } catch (error) {
      console.error("Failed to load marketplace data:", error);
      showToast("Failed to load marketplace data", "error");

      // Set fallback data to prevent infinite loading
      setMarketplace({
        featuredQuizzes: [],
        trendingQuizzes: [],
        categories: [],
        totalQuizzes: 0,
        totalParticipants: 0,
        totalRewardsDistributed: "0",
      });
    } finally {
      setLoading(false);
    }
  }, [context?.user?.fid]);

  // Load data on mount
  useEffect(() => {
    if (isSDKLoaded) {
      loadMarketplaceData();
    }
  }, [isSDKLoaded, loadMarketplaceData]);

  // Auto-connection effect
  useEffect(() => {
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
      console.log("QuizMarketplace: Attempting auto-connection...");
      try {
        connect({ connector: connectors[0] });
      } catch (error) {
        console.error("QuizMarketplace: Auto-connection failed:", error);
      }
    }
  }, [context?.user?.fid, isConnected, connectors, connect, context?.client]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleBackFromQuiz = () => {
    setIsPlayingQuiz(false);
    setSelectedQuiz(null);
    // Refresh marketplace data
    loadMarketplaceData();
  };

  const joinQuiz = async (quiz: Quiz) => {
    if (!context?.user?.fid) {
      showToast("Please connect your wallet to join quizzes", "error");
      return;
    }

    if (!isConnected) {
      showToast("Please connect your wallet to join quizzes", "error");
      return;
    }

    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          quizId: quiz.id,
          fid: context.user.fid,
          username: context.user.username,
          walletAddress: getBestWalletAddress(),
        }),
      });

      const result = await response.json();
      if (result.success) {
        showToast("Successfully joined quiz! Starting quiz...", "success");
        // Navigate to quiz player
        setSelectedQuiz(quiz);
        setIsPlayingQuiz(true);
      } else {
        showToast(result.error || "Failed to join quiz", "error");
      }
    } catch (error) {
      console.error("Failed to join quiz:", error);
      showToast("Failed to join quiz", "error");
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Quiz Marketplace...</p>
        </div>
      </div>
    );
  }

  // Show quiz player if playing a quiz
  if (isPlayingQuiz && selectedQuiz) {
    return <QuizPlayer quiz={selectedQuiz} onBack={handleBackFromQuiz} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow-lg max-w-4xl mx-auto min-h-screen">
      {/* Toast notifications */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-blue-600 mb-2">
          🏆 Quiz Marketplace
        </h1>
        <p className="text-gray-600">
          Create, join, and compete in quizzes to earn $BLITZ tokens!
        </p>
        <button
          onClick={loadMarketplaceData}
          disabled={loading}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Loading..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Wallet Status */}
      <div className="w-full max-w-2xl mb-6">
        <div
          className={`p-4 rounded-lg border ${
            context?.user
              ? "bg-green-50 border-green-300 text-green-800"
              : "bg-yellow-50 border-yellow-300 text-yellow-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {context?.user
                  ? "✅ Connected to Farcaster"
                  : "⚠️ Not Connected"}
              </p>
              {context?.user && (
                <p className="text-xs mt-1 opacity-75">
                  @{context.user.username}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs opacity-75">
                {isConnected
                  ? "Wallet Connected"
                  : "Connect wallet to join quizzes"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Marketplace Stats */}
      <div className="w-full max-w-2xl mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">
              {marketplace.totalQuizzes}
            </p>
            <p className="text-sm text-gray-600">Total Quizzes</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">
              {marketplace.totalParticipants}
            </p>
            <p className="text-sm text-gray-600">Participants</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-purple-600">
              {marketplace.categories.length}
            </p>
            <p className="text-sm text-gray-600">Categories</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">
              {marketplace.totalRewardsDistributed}
            </p>
            <p className="text-sm text-gray-600">BLITZ Distributed</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("featured")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "featured"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Featured
          </button>
          <button
            onClick={() => setActiveTab("trending")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "trending"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Trending
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "categories"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Categories
          </button>
          {context?.user && (
            <button
              onClick={() => setActiveTab("my-quizzes")}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === "my-quizzes"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              My Quizzes
            </button>
          )}
        </div>
      </div>

      {/* Quiz List */}
      <div className="w-full max-w-2xl">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>Loading quizzes...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "featured" && (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Featured Quizzes
                </h2>
                {marketplace.featuredQuizzes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No featured quizzes available</p>
                    <p className="text-sm mt-2">
                      Create the first quiz to get featured!
                    </p>
                  </div>
                ) : (
                  marketplace.featuredQuizzes.map((quiz) => (
                    <QuizCard key={quiz.id} quiz={quiz} onJoin={joinQuiz} />
                  ))
                )}
              </>
            )}

            {activeTab === "trending" && (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Trending Quizzes
                </h2>
                {marketplace.trendingQuizzes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No trending quizzes available</p>
                  </div>
                ) : (
                  marketplace.trendingQuizzes.map((quiz) => (
                    <QuizCard key={quiz.id} quiz={quiz} onJoin={joinQuiz} />
                  ))
                )}
              </>
            )}

            {activeTab === "categories" && (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  Categories
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  {marketplace.categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`p-4 rounded-lg border transition-colors ${
                        selectedCategory === category
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <p className="font-medium">{category}</p>
                    </button>
                  ))}
                </div>
                {selectedCategory && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4">
                      {selectedCategory} Quizzes
                    </h3>
                    {/* TODO: Load quizzes by category */}
                    <div className="text-center py-8 text-gray-500">
                      <p>Category filtering coming soon!</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "my-quizzes" && (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-4">
                  My Quizzes
                </h2>
                {myQuizzes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>You haven&apos;t created any quizzes yet</p>
                    <p className="text-sm mt-2">
                      Create your first quiz to see it here!
                    </p>
                  </div>
                ) : (
                  myQuizzes.map((quiz) => (
                    <QuizCard key={quiz.id} quiz={quiz} onJoin={joinQuiz} />
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Quiz Button */}
      <div className="w-full max-w-2xl mt-8">
        <button
          onClick={() => {
            // TODO: Navigate to quiz creation
            showToast("Quiz creation coming soon!", "info");
          }}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          🎯 Create Your Own Quiz
        </button>
      </div>
    </div>
  );
}

// Quiz Card Component
function QuizCard({
  quiz,
  onJoin,
}: {
  quiz: Quiz;
  onJoin: (quiz: Quiz) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800 mb-2">{quiz.title}</h3>
          <p className="text-gray-600 text-sm mb-3">{quiz.description}</p>

          <div className="flex items-center gap-4 mb-4">
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                quiz.difficulty
              )}`}
            >
              {quiz.difficulty}
            </span>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                quiz.status
              )}`}
            >
              {quiz.status}
            </span>
            <span className="text-xs text-gray-500">
              by @{quiz.hostUsername}
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">{quiz.prizePool}</p>
          <p className="text-xs text-gray-500">BLITZ Prize</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <p className="text-gray-500">Entry Fee</p>
          <p className="font-medium">{quiz.entryFee} BLITZ</p>
        </div>
        <div>
          <p className="text-gray-500">Participants</p>
          <p className="font-medium">
            {quiz.currentParticipants}/{quiz.maxParticipants}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Category</p>
          <p className="font-medium">{quiz.category}</p>
        </div>
        <div>
          <p className="text-gray-500">Created</p>
          <p className="font-medium">{formatTime(quiz.createdAt)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onJoin(quiz)}
          disabled={
            quiz.status !== "active" ||
            quiz.currentParticipants >= quiz.maxParticipants
          }
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {quiz.status === "active" ? "Join Quiz" : "Coming Soon"}
        </button>
        <button
          onClick={() => {
            // TODO: View quiz details
          }}
          className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
        >
          View Details
        </button>
      </div>
    </div>
  );
}
