"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect } from "wagmi";
import { Quiz, QuizQuestion } from "~/lib/types";

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

interface QuizPlayerProps {
  quiz: Quiz;
  onBack: () => void;
}

interface PlayerState {
  currentQuestionIndex: number;
  score: number;
  streak: number;
  timeLeft: number;
  selectedAnswer: string;
  isAnswering: boolean;
  showResult: boolean;
  isCorrect: boolean | null;
  completed: boolean;
}

export default function QuizPlayer({ quiz, onBack }: QuizPlayerProps) {
  // Farcaster user context
  const [context, setContext] = useState<any>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Quiz state
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentQuestionIndex: 0,
    score: 0,
    streak: 0,
    timeLeft: 30,
    selectedAnswer: "",
    isAnswering: true,
    showResult: false,
    isCorrect: null,
    completed: false,
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

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

  // Load quiz questions
  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/quizzes?action=questions&quizId=${quiz.id}`);
        const data = await response.json();
        if (data.success && data.questions) {
          setQuestions(data.questions);
        } else {
          // Fallback to sample questions if no questions found
          const sampleQuestions: QuizQuestion[] = [
            {
              id: "q1",
              quizId: quiz.id,
              question: "What is the primary purpose of blockchain technology?",
              options: ["To create digital currencies", "To provide decentralized trust", "To speed up transactions", "To reduce costs"],
              correctAnswer: "To provide decentralized trust",
              points: 10,
              timeLimit: 30,
              order: 0,
            },
            {
              id: "q2",
              quizId: quiz.id,
              question: "Which consensus mechanism does Bitcoin use?",
              options: ["Proof of Stake", "Proof of Work", "Delegated Proof of Stake", "Proof of Authority"],
              correctAnswer: "Proof of Work",
              points: 10,
              timeLimit: 30,
              order: 1,
            },
            {
              id: "q3",
              quizId: quiz.id,
              question: "What does DeFi stand for?",
              options: ["Decentralized Finance", "Digital Finance", "Distributed Finance", "Direct Finance"],
              correctAnswer: "Decentralized Finance",
              points: 10,
              timeLimit: 30,
              order: 2,
            },
          ];
          setQuestions(sampleQuestions);
        }
      } catch (error) {
        console.error("Failed to load quiz questions:", error);
        showToast("Failed to load quiz questions", "error");
      } finally {
        setLoading(false);
      }
    };

    if (quiz.id) {
      loadQuestions();
    }
  }, [quiz.id]);

  // Timer effect
  useEffect(() => {
    if (playerState.isAnswering && playerState.timeLeft > 0) {
      const timer = setInterval(() => {
        setPlayerState((prev) => {
          if (prev.timeLeft <= 1) {
            // Time's up - auto submit
            setTimeout(() => submitAnswer(), 100);
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [playerState.isAnswering, playerState.timeLeft]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const submitAnswer = useCallback(async () => {
    if (!playerState.selectedAnswer) {
      showToast("Please select an answer!", "error");
      return;
    }

    const currentQuestion = questions[playerState.currentQuestionIndex];
    const isCorrect =
      playerState.selectedAnswer === currentQuestion.correctAnswer;

    // Update player state
    setPlayerState((prev) => ({
      ...prev,
      isAnswering: false,
      isCorrect,
      showResult: true,
      score: isCorrect ? prev.score + currentQuestion.points : prev.score,
      streak: isCorrect ? prev.streak + 1 : 0,
    }));

    // Submit answer to API
    if (context?.user?.fid) {
      try {
        await fetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submit-answer",
            quizId: quiz.id,
            questionId: currentQuestion.id,
            selectedAnswer: playerState.selectedAnswer,
            timeSpent: 30 - playerState.timeLeft,
            fid: context.user.fid,
          }),
        });
      } catch (error) {
        console.error("Failed to submit answer:", error);
      }
    }

    // Show result
    if (isCorrect) {
      showToast(`🎉 Correct! +${currentQuestion.points} points`, "success");
    } else {
      showToast(`❌ Wrong! Answer: ${currentQuestion.correctAnswer}`, "error");
    }
  }, [playerState, questions, context, quiz.id]);

  const nextQuestion = () => {
    const nextIndex = playerState.currentQuestionIndex + 1;
    if (nextIndex >= questions.length) {
      // Quiz completed
      setPlayerState((prev) => ({ ...prev, completed: true }));
      completeQuiz();
    } else {
      // Move to next question
      setPlayerState((prev) => ({
        ...prev,
        currentQuestionIndex: nextIndex,
        timeLeft: 30,
        selectedAnswer: "",
        isAnswering: true,
        showResult: false,
        isCorrect: null,
      }));
    }
  };

  const completeQuiz = async () => {
    if (context?.user?.fid) {
      try {
        await fetch("/api/quizzes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "complete",
            quizId: quiz.id,
            fid: context.user.fid,
          }),
        });
        showToast("Quiz completed! Check your rank and rewards.", "success");
      } catch (error) {
        console.error("Failed to complete quiz:", error);
      }
    }
  };

  if (!isSDKLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Quiz...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[playerState.currentQuestionIndex];

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-lg shadow-lg max-w-md mx-auto min-h-screen">
      {/* Toast notifications */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={closeToast} />
      )}

      {/* Header */}
      <div className="text-center mb-4">
        <button
          onClick={onBack}
          className="absolute top-4 left-4 text-blue-600 hover:text-blue-800"
        >
          ← Back to Marketplace
        </button>
        <h1 className="text-2xl font-bold text-blue-600 mb-2">{quiz.title}</h1>
        <p className="text-sm text-gray-600">{quiz.description}</p>
      </div>

      {/* Progress */}
      <div className="w-full max-w-sm mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Question {playerState.currentQuestionIndex + 1} of{" "}
            {questions.length}
          </span>
          <span className="text-sm font-medium">
            Score: {playerState.score} | Streak: {playerState.streak}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${
                ((playerState.currentQuestionIndex + 1) / questions.length) *
                100
              }%`,
            }}
          ></div>
        </div>
      </div>

      {/* Quiz Completed */}
      {playerState.completed ? (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            🎉 Quiz Completed!
          </h2>
          <div className="bg-green-50 p-6 rounded-lg mb-4">
            <p className="text-lg font-bold mb-2">
              Final Score: {playerState.score}
            </p>
            <p className="text-sm text-gray-600">
              Best Streak: {playerState.streak}
            </p>
          </div>
          <button
            onClick={onBack}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700"
          >
            Back to Marketplace
          </button>
        </div>
      ) : (
        /* Current Question */
        <div className="w-full max-w-sm">
          <div className="bg-blue-50 p-4 rounded-lg mb-4">
            {/* Timer */}
            <div
              className={`text-2xl font-bold mb-4 text-center ${
                playerState.timeLeft <= 5
                  ? "text-red-500 animate-pulse"
                  : "text-blue-600"
              }`}
            >
              ⏰ {playerState.timeLeft}s
            </div>

            <h3 className="text-lg font-bold text-blue-600 mb-4">
              {currentQuestion?.question}
            </h3>

            {/* Answer Options */}
            {playerState.isAnswering && (
              <div className="space-y-2 mb-4">
                {currentQuestion?.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() =>
                      setPlayerState((prev) => ({
                        ...prev,
                        selectedAnswer: option,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      playerState.selectedAnswer === option
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white hover:bg-blue-50 border-gray-300"
                    }`}
                  >
                    {String.fromCharCode(65 + index)}. {option}
                  </button>
                ))}

                <button
                  onClick={submitAnswer}
                  disabled={!playerState.selectedAnswer}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 mt-4"
                >
                  Submit Answer
                </button>
              </div>
            )}

            {/* Result */}
            {playerState.showResult && (
              <div
                className={`text-center p-3 rounded-lg ${
                  playerState.isCorrect ? "bg-green-100" : "bg-red-100"
                }`}
              >
                <p
                  className={`font-bold text-lg mb-2 ${
                    playerState.isCorrect ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {playerState.isCorrect ? "🎉 Correct!" : "❌ Wrong!"}
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Answer: {currentQuestion?.correctAnswer}
                </p>
                <button
                  onClick={nextQuestion}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
                >
                  {playerState.currentQuestionIndex + 1 >= questions.length
                    ? "Finish Quiz"
                    : "Next Question"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
