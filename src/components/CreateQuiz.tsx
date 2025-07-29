"use client";

import { useState, useEffect, useCallback } from "react";
import { sdk } from "@farcaster/frame-sdk";
import { useAccount, useConnect } from "wagmi";
import { CreateQuizRequest } from "~/lib/types";

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

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
  timeLimit: number;
}

const CATEGORIES = [
  "General Knowledge",
  "Science & Technology",
  "History",
  "Geography",
  "Sports",
  "Entertainment",
  "Literature",
  "Art & Culture",
  "Mathematics",
  "Current Events",
];

export default function CreateQuiz() {
  // Farcaster user context
  const [context, setContext] = useState<any>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);

  // Wallet integration
  const { address: connectedWalletAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
    entryFee: "0",
    prizePool: "100",
    maxParticipants: 50,
    startTime: "",
    endTime: "",
  });

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: "",
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 10,
    timeLimit: 30,
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
      console.log("CreateQuiz: Attempting auto-connection...");
      try {
        connect({ connector: connectors[0] });
      } catch (error) {
        console.error("CreateQuiz: Auto-connection failed:", error);
      }
    }
  }, [context?.user?.fid, isConnected, connectors, connect, context?.client]);

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const addQuestion = () => {
    if (
      !currentQuestion.question ||
      currentQuestion.options.some((opt) => !opt) ||
      !currentQuestion.correctAnswer
    ) {
      showToast("Please fill in all question fields", "error");
      return;
    }

    const newQuestion: Question = {
      ...currentQuestion,
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    setQuestions((prev) => [...prev, newQuestion]);
    setCurrentQuestion({
      id: "",
      question: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 10,
      timeLimit: 30,
    });

    showToast("Question added!", "success");
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
    showToast("Question removed", "info");
  };

  const handleQuestionChange = (field: string, value: any) => {
    setCurrentQuestion((prev) => ({ ...prev, [field]: value }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...currentQuestion.options];
    newOptions[index] = value;
    setCurrentQuestion((prev) => ({ ...prev, options: newOptions }));
  };

  const createQuiz = async () => {
    if (!context?.user?.fid) {
      showToast("Please connect your wallet to create a quiz", "error");
      return;
    }

    if (!isConnected) {
      showToast("Please connect your wallet to create a quiz", "error");
      return;
    }

    // Validate form
    if (!formData.title || !formData.description || !formData.category) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    if (questions.length === 0) {
      showToast("Please add at least one question", "error");
      return;
    }

    if (!formData.startTime || !formData.endTime) {
      showToast("Please set start and end times", "error");
      return;
    }

    setLoading(true);
    try {
      const quizData: CreateQuizRequest = {
        ...formData,
        questions: questions.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points,
          timeLimit: q.timeLimit,
        })),
        hostFid: context.user.fid,
        hostUsername: context.user.username,
        hostWalletAddress: getBestWalletAddress() || "",
      };

      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          ...quizData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        showToast("Quiz created successfully!", "success");
        // Reset form
        setFormData({
          title: "",
          description: "",
          category: "",
          difficulty: "medium",
          entryFee: "0",
          prizePool: "100",
          maxParticipants: 50,
          startTime: "",
          endTime: "",
        });
        setQuestions([]);
      } else {
        showToast(result.error || "Failed to create quiz", "error");
      }
    } catch (error) {
      console.error("Failed to create quiz:", error);
      showToast("Failed to create quiz", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading Quiz Creator...</p>
        </div>
      </div>
    );
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
          🎯 Create Your Quiz
        </h1>
        <p className="text-gray-600">
          Design engaging quizzes and earn rewards from participants!
        </p>
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
                  : "Connect wallet to create quizzes"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Details Form */}
      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quiz Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quiz Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter quiz title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleFormChange("category", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => handleFormChange("difficulty", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Participants
              </label>
              <input
                type="number"
                value={formData.maxParticipants}
                onChange={(e) =>
                  handleFormChange("maxParticipants", parseInt(e.target.value))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                max="1000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Entry Fee (BLITZ)
              </label>
              <input
                type="number"
                value={formData.entryFee}
                onChange={(e) => handleFormChange("entryFee", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prize Pool (BLITZ)
              </label>
              <input
                type="number"
                value={formData.prizePool}
                onChange={(e) => handleFormChange("prizePool", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => handleFormChange("startTime", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => handleFormChange("endTime", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleFormChange("description", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Describe your quiz..."
            />
          </div>
        </div>

        {/* Questions Section */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Questions ({questions.length})
          </h2>

          {/* Add Question Form */}
          <div className="bg-white p-4 rounded-lg border mb-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              Add New Question
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question *
                </label>
                <textarea
                  value={currentQuestion.question}
                  onChange={(e) =>
                    handleQuestionChange("question", e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="Enter your question..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Points
                  </label>
                  <input
                    type="number"
                    value={currentQuestion.points}
                    onChange={(e) =>
                      handleQuestionChange("points", parseInt(e.target.value))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    max="100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time Limit (seconds)
                  </label>
                  <input
                    type="number"
                    value={currentQuestion.timeLimit}
                    onChange={(e) =>
                      handleQuestionChange(
                        "timeLimit",
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="5"
                    max="300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Options *
                </label>
                <div className="space-y-2">
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        value={option}
                        checked={currentQuestion.correctAnswer === option}
                        onChange={(e) =>
                          handleQuestionChange("correctAnswer", e.target.value)
                        }
                        className="text-blue-600"
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          handleOptionChange(index, e.target.value)
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Option ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={addQuestion}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Add Question
              </button>
            </div>
          </div>

          {/* Questions List */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-800">
                Added Questions
              </h3>
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="bg-white p-4 rounded-lg border"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-800">
                      Question {index + 1}: {question.question}
                    </h4>
                    <button
                      onClick={() => removeQuestion(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>
                      Points: {question.points} | Time: {question.timeLimit}s
                    </p>
                    <p>Correct Answer: {question.correctAnswer}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Quiz Button */}
        <button
          onClick={createQuiz}
          disabled={loading || !context?.user || !isConnected}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-lg font-bold hover:from-blue-700 hover:to-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Creating Quiz..." : "Create Quiz"}
        </button>
      </div>
    </div>
  );
}
