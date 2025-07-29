import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { Quiz, CreateQuizRequest } from "~/lib/types";

// In-memory storage for demo (replace with database in production)
const quizzes: Map<string, Quiz> = new Map();
const quizQuestions: Map<string, any[]> = new Map();
const quizParticipants: Map<string, any[]> = new Map();

// Initialize with sample quizzes
const initializeSampleQuizzes = () => {
  console.log("Initializing sample quizzes...");

  const sampleQuizzes = [
    {
      id: "quiz_1",
      title: "Crypto Knowledge Challenge",
      description:
        "Test your knowledge about cryptocurrencies, blockchain, and DeFi!",
      hostFid: 1234,
      hostUsername: "crypto_expert",
      hostWalletAddress: "0x1234567890123456789012345678901234567890",
      category: "Science & Technology",
      difficulty: "medium" as const,
      entryFee: "5",
      prizePool: "500",
      maxParticipants: 100,
      currentParticipants: 25,
      status: "active" as const,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      id: "quiz_2",
      title: "Farcaster Trivia",
      description: "How well do you know the Farcaster ecosystem?",
      hostFid: 5678,
      hostUsername: "farcaster_fan",
      hostWalletAddress: "0x2345678901234567890123456789012345678901",
      category: "General Knowledge",
      difficulty: "easy" as const,
      entryFee: "0",
      prizePool: "200",
      maxParticipants: 50,
      currentParticipants: 15,
      status: "active" as const,
      startTime: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      id: "quiz_3",
      title: "Web3 Development Master",
      description:
        "Advanced questions about smart contracts, dApps, and blockchain development",
      hostFid: 9101,
      hostUsername: "web3_dev",
      hostWalletAddress: "0x3456789012345678901234567890123456789012",
      category: "Science & Technology",
      difficulty: "hard" as const,
      entryFee: "10",
      prizePool: "1000",
      maxParticipants: 30,
      currentParticipants: 8,
      status: "active" as const,
      startTime: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  ];

  console.log("Sample quizzes to initialize:", sampleQuizzes.length);

  sampleQuizzes.forEach((quiz, index) => {
    console.log(`Initializing quiz ${index + 1}:`, quiz.id, quiz.title);
    quizzes.set(quiz.id, quiz);

    // Add sample questions for each quiz
    const sampleQuestions = [
      {
        id: `q_${quiz.id}_0`,
        quizId: quiz.id,
        question: "What is the primary purpose of blockchain technology?",
        options: [
          "To create digital currencies",
          "To provide decentralized trust",
          "To speed up transactions",
          "To reduce costs",
        ],
        correctAnswer: "To provide decentralized trust",
        points: 10,
        timeLimit: 30,
        order: 0,
      },
      {
        id: `q_${quiz.id}_1`,
        quizId: quiz.id,
        question: "Which consensus mechanism does Bitcoin use?",
        options: [
          "Proof of Stake",
          "Proof of Work",
          "Delegated Proof of Stake",
          "Proof of Authority",
        ],
        correctAnswer: "Proof of Work",
        points: 10,
        timeLimit: 30,
        order: 1,
      },
      {
        id: `q_${quiz.id}_2`,
        quizId: quiz.id,
        question: "What does DeFi stand for?",
        options: [
          "Decentralized Finance",
          "Digital Finance",
          "Distributed Finance",
          "Direct Finance",
        ],
        correctAnswer: "Decentralized Finance",
        points: 10,
        timeLimit: 30,
        order: 2,
      },
    ];

    quizQuestions.set(quiz.id, sampleQuestions);
    quizParticipants.set(quiz.id, []);
  });

  console.log(
    "Sample quizzes initialized. Total quizzes in memory:",
    quizzes.size
  );
  console.log("Available quiz IDs:", Array.from(quizzes.keys()));
};

// Initialize sample data
initializeSampleQuizzes();

// BLITZ Token contract details
const BLITZ_TOKEN_ADDRESS = "0x0de0C9880f32F20F09EFb126E0d36A94f70572B0";
const PRIVATE_KEY = process.env.REWARD_WALLET_PRIVATE_KEY!;
const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY";

const BLITZ_TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function transferFrom(address from, address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const quizId = searchParams.get("quizId");
    const category = searchParams.get("category");
    const status = searchParams.get("status");

    console.log("Quiz API GET request:", { action, quizId, category, status });

    switch (action) {
      case "debug":
        // Debug endpoint to check current state
        return NextResponse.json({
          success: true,
          totalQuizzes: quizzes.size,
          quizIds: Array.from(quizzes.keys()),
          sampleQuizzes: Array.from(quizzes.values()).slice(0, 3),
          quizzesMap: Object.fromEntries(quizzes),
        });

      case "test":
        // Simple test endpoint
        return NextResponse.json({
          success: true,
          message: "Quiz API is working",
          timestamp: new Date().toISOString(),
          quizzesCount: quizzes.size,
        });

      case "get":
        if (quizId) {
          const quiz = quizzes.get(quizId);
          if (!quiz) {
            return NextResponse.json(
              { success: false, error: "Quiz not found" },
              { status: 404 }
            );
          }
          return NextResponse.json({ success: true, quiz });
        }
        break;

      case "questions":
        if (quizId) {
          const questions = quizQuestions.get(quizId);
          if (!questions) {
            return NextResponse.json(
              { success: false, error: "Questions not found" },
              { status: 404 }
            );
          }
          return NextResponse.json({ success: true, questions });
        }
        break;

      case "list":
        let filteredQuizzes = Array.from(quizzes.values());

        if (category) {
          filteredQuizzes = filteredQuizzes.filter(
            (q) => q.category === category
          );
        }

        if (status) {
          filteredQuizzes = filteredQuizzes.filter((q) => q.status === status);
        }

        // Filter by host FID if provided
        const hostFid = searchParams.get("hostFid");
        if (hostFid) {
          const fid = parseInt(hostFid);
          filteredQuizzes = filteredQuizzes.filter((q) => q.hostFid === fid);
        }

        // Sort by creation date (newest first)
        filteredQuizzes.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return NextResponse.json({
          success: true,
          quizzes: filteredQuizzes,
          total: filteredQuizzes.length,
        });

      case "featured":
        const featuredQuizzes = Array.from(quizzes.values())
          .filter((q) => q.status === "active" && q.currentParticipants > 0)
          .sort((a, b) => b.currentParticipants - a.currentParticipants)
          .slice(0, 5);

        return NextResponse.json({
          success: true,
          featuredQuizzes,
        });

      case "trending":
        const trendingQuizzes = Array.from(quizzes.values())
          .filter((q) => q.status === "active")
          .sort((a, b) => {
            // Sort by prize pool and participants
            const aScore = parseFloat(a.prizePool) * a.currentParticipants;
            const bScore = parseFloat(b.prizePool) * b.currentParticipants;
            return bScore - aScore;
          })
          .slice(0, 10);

        return NextResponse.json({
          success: true,
          trendingQuizzes,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Quiz API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    console.log("Quiz API POST request:", { action, data });

    switch (action) {
      case "create":
        console.log("Creating quiz with data:", data);
        return await createQuiz(
          data as CreateQuizRequest & {
            hostFid: number;
            hostUsername: string;
            hostWalletAddress: string;
          }
        );

      case "join":
        console.log("Joining quiz with data:", data);
        return await joinQuiz(data);

      case "submit-answer":
        return await submitAnswer(data);

      case "complete":
        return await completeQuiz(data);

      case "claim-reward":
        return await claimReward(data);

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Quiz API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function createQuiz(
  data: CreateQuizRequest & {
    hostFid: number;
    hostUsername: string;
    hostWalletAddress: string;
  }
) {
  console.log("createQuiz called with data:", data);

  const {
    title,
    description,
    category,
    difficulty,
    entryFee,
    prizePool,
    maxParticipants,
    startTime,
    endTime,
    questions,
    hostFid,
    hostUsername,
    hostWalletAddress,
  } = data;

  console.log("Extracted fields:", {
    title,
    description,
    category,
    hostFid,
    hostUsername,
    questionsCount: questions?.length,
  });

  // Validate required fields
  if (!title || !description || !category || !hostFid || !hostUsername) {
    console.log("Validation failed - missing required fields");
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Validate entry fee and prize pool
  const entryFeeAmount = parseFloat(entryFee);
  const prizePoolAmount = parseFloat(prizePool);

  if (entryFeeAmount < 0 || prizePoolAmount < 0) {
    console.log("Validation failed - invalid amounts");
    return NextResponse.json(
      { success: false, error: "Invalid amounts" },
      { status: 400 }
    );
  }

  // Validate questions
  if (!questions || questions.length === 0) {
    console.log("Validation failed - no questions");
    return NextResponse.json(
      { success: false, error: "At least one question is required" },
      { status: 400 }
    );
  }

  console.log("All validations passed, creating quiz...");

  // Create quiz
  const quizId = `quiz_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const quiz: Quiz = {
    id: quizId,
    title,
    description,
    hostFid,
    hostUsername,
    hostWalletAddress,
    category,
    difficulty,
    entryFee,
    prizePool,
    maxParticipants,
    currentParticipants: 0,
    status: "active", // Changed from "draft" to "active"
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  console.log("Created quiz object:", quiz);

  // Store quiz
  quizzes.set(quizId, quiz);
  console.log("Stored quiz in memory");

  // Store questions
  const formattedQuestions = questions.map((q, index) => ({
    id: `q_${quizId}_${index}`,
    quizId,
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    points: q.points || 10,
    timeLimit: q.timeLimit || 30,
    order: index,
  }));
  quizQuestions.set(quizId, formattedQuestions);
  console.log("Stored questions in memory");

  // Initialize participants array
  quizParticipants.set(quizId, []);
  console.log("Initialized participants array");

  console.log("Quiz creation completed successfully");

  return NextResponse.json({
    success: true,
    quiz,
    message: "Quiz created successfully",
  });
}

async function joinQuiz(data: any) {
  const { quizId, fid, username, walletAddress } = data;

  console.log("Joining quiz:", { quizId, fid, username, walletAddress });

  const quiz = quizzes.get(quizId);
  if (!quiz) {
    console.log("Quiz not found:", quizId);
    console.log("Available quizzes:", Array.from(quizzes.keys()));
    return NextResponse.json(
      { success: false, error: "Quiz not found" },
      { status: 404 }
    );
  }

  if (quiz.status !== "active") {
    return NextResponse.json(
      { success: false, error: "Quiz is not active" },
      { status: 400 }
    );
  }

  if (quiz.currentParticipants >= quiz.maxParticipants) {
    return NextResponse.json(
      { success: false, error: "Quiz is full" },
      { status: 400 }
    );
  }

  // Check if user already joined
  const participants = quizParticipants.get(quizId) || [];
  const alreadyJoined = participants.find((p: any) => p.fid === fid);
  if (alreadyJoined) {
    return NextResponse.json(
      { success: false, error: "Already joined this quiz" },
      { status: 400 }
    );
  }

  // Add participant
  const participant = {
    id: `participant_${quizId}_${fid}`,
    quizId,
    fid,
    username,
    walletAddress,
    score: 0,
    streak: 0,
    answers: [],
    joinedAt: new Date(),
  };

  participants.push(participant);
  quizParticipants.set(quizId, participants);

  // Update quiz participant count
  quiz.currentParticipants += 1;
  quiz.updatedAt = new Date();
  quizzes.set(quizId, quiz);

  console.log("Successfully joined quiz:", { quizId, participant });

  return NextResponse.json({
    success: true,
    message: "Successfully joined quiz",
    participant,
  });
}

async function submitAnswer(data: any) {
  const { quizId, questionId, selectedAnswer, timeSpent, fid } = data;

  const quiz = quizzes.get(quizId);
  if (!quiz) {
    return NextResponse.json(
      { success: false, error: "Quiz not found" },
      { status: 404 }
    );
  }

  const participants = quizParticipants.get(quizId) || [];
  const participant = participants.find((p: any) => p.fid === fid);
  if (!participant) {
    return NextResponse.json(
      { success: false, error: "Not a participant" },
      { status: 400 }
    );
  }

  const questions = quizQuestions.get(quizId) || [];
  const question = questions.find((q: any) => q.id === questionId);
  if (!question) {
    return NextResponse.json(
      { success: false, error: "Question not found" },
      { status: 404 }
    );
  }

  // Check if already answered
  const alreadyAnswered = participant.answers.find(
    (a: any) => a.questionId === questionId
  );
  if (alreadyAnswered) {
    return NextResponse.json(
      { success: false, error: "Already answered this question" },
      { status: 400 }
    );
  }

  // Check answer
  const isCorrect = selectedAnswer === question.correctAnswer;
  const pointsEarned = isCorrect ? question.points : 0;

  // Create answer
  const answer = {
    id: `answer_${questionId}_${fid}`,
    participantId: participant.id,
    questionId,
    selectedAnswer,
    isCorrect,
    timeSpent,
    pointsEarned,
    answeredAt: new Date(),
  };

  // Update participant
  participant.answers.push(answer);
  participant.score += pointsEarned;
  participant.streak = isCorrect ? participant.streak + 1 : 0;

  // Update participants
  const participantIndex = participants.findIndex((p: any) => p.fid === fid);
  participants[participantIndex] = participant;
  quizParticipants.set(quizId, participants);

  return NextResponse.json({
    success: true,
    isCorrect,
    pointsEarned,
    newScore: participant.score,
    newStreak: participant.streak,
  });
}

async function completeQuiz(data: any) {
  const { quizId, fid } = data;

  const quiz = quizzes.get(quizId);
  if (!quiz) {
    return NextResponse.json(
      { success: false, error: "Quiz not found" },
      { status: 404 }
    );
  }

  const participants = quizParticipants.get(quizId) || [];
  const participant = participants.find((p: any) => p.fid === fid);
  if (!participant) {
    return NextResponse.json(
      { success: false, error: "Not a participant" },
      { status: 400 }
    );
  }

  // Mark as completed
  participant.completedAt = new Date();

  // Update participants
  const participantIndex = participants.findIndex((p: any) => p.fid === fid);
  participants[participantIndex] = participant;
  quizParticipants.set(quizId, participants);

  return NextResponse.json({
    success: true,
    message: "Quiz completed",
    finalScore: participant.score,
  });
}

async function claimReward(data: any) {
  const { quizId, fid, walletAddress } = data;

  const quiz = quizzes.get(quizId);
  if (!quiz) {
    return NextResponse.json(
      { success: false, error: "Quiz not found" },
      { status: 404 }
    );
  }

  const participants = quizParticipants.get(quizId) || [];
  const participant = participants.find((p: any) => p.fid === fid);
  if (!participant) {
    return NextResponse.json(
      { success: false, error: "Not a participant" },
      { status: 400 }
    );
  }

  // Calculate reward based on rank
  const sortedParticipants = participants
    .filter((p: any) => p.completedAt)
    .sort((a: any, b: any) => b.score - a.score);

  const rank = sortedParticipants.findIndex((p: any) => p.fid === fid) + 1;
  const totalParticipants = sortedParticipants.length;

  // Simple reward distribution: 50% to 1st, 30% to 2nd, 20% to 3rd
  let rewardAmount = "0";
  if (rank === 1 && totalParticipants >= 1) {
    rewardAmount = ethers.formatEther(
      (ethers.parseEther(quiz.prizePool) * 50n) / 100n
    );
  } else if (rank === 2 && totalParticipants >= 2) {
    rewardAmount = ethers.formatEther(
      (ethers.parseEther(quiz.prizePool) * 30n) / 100n
    );
  } else if (rank === 3 && totalParticipants >= 3) {
    rewardAmount = ethers.formatEther(
      (ethers.parseEther(quiz.prizePool) * 20n) / 100n
    );
  }

  if (parseFloat(rewardAmount) > 0) {
    // Mint tokens to winner
    try {
      const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
      const contract = new ethers.Contract(
        BLITZ_TOKEN_ADDRESS,
        BLITZ_TOKEN_ABI,
        wallet
      );

      const tx = await contract.mint(
        walletAddress,
        ethers.parseEther(rewardAmount)
      );
      await tx.wait();

      return NextResponse.json({
        success: true,
        message: `Reward claimed! You earned ${rewardAmount} BLITZ tokens`,
        rewardAmount,
        rank,
      });
    } catch (error) {
      console.error("Failed to mint tokens:", error);
      return NextResponse.json(
        { success: false, error: "Failed to claim reward" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: "No reward to claim",
    rewardAmount: "0",
    rank,
  });
}
