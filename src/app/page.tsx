"use client";

import { useState } from "react";
import TriviaGame from "~/components/TriviaGame";
import QuizMarketplace from "~/components/QuizMarketplace";
import CreateQuiz from "~/components/CreateQuiz";

type ActiveView = "trivia" | "marketplace" | "create";

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("marketplace");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Navigation Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-blue-600">
                🧠 Quiz Blitz
              </h1>
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveView("marketplace")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === "marketplace"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🏆 Marketplace
                </button>
                <button
                  onClick={() => setActiveView("trivia")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === "trivia"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🎮 Quick Play
                </button>
                <button
                  onClick={() => setActiveView("create")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === "create"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  🎯 Create Quiz
                </button>
              </div>
            </div>
            {/* <div className="text-sm text-gray-500">
              Powered by Farcaster & $BLITZ
            </div> */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {activeView === "marketplace" && <QuizMarketplace />}
        {activeView === "trivia" && <TriviaGame />}
        {activeView === "create" && <CreateQuiz />}
      </div>
    </div>
  );
}
