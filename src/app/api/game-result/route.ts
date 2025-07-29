// /api/game-result/route.ts or pages/api/game-result.ts

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// Your contract details
const BLITZ_TOKEN_ADDRESS = "0x0de0C9880f32F20F09EFb126E0d36A94f70572B0"; // Your Sepolia contract
const PRIVATE_KEY = process.env.REWARD_WALLET_PRIVATE_KEY!; // Backend wallet that can mint
const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY";

// Simplified ABI for minting tokens
const BLITZ_TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
];

// Reward amounts (in tokens)
const REWARDS = {
  CORRECT_ANSWER: ethers.parseEther("10"), // 10 BLITZ for correct answer
  PARTICIPATION: ethers.parseEther("1"), // 1 BLITZ for participation
  STREAK_BONUS: ethers.parseEther("5"), // 5 BLITZ bonus per 5-streak
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fid,
      username,
      walletAddress,
      score,
      streak,
      roundId,
      isCorrect,
      question,
      selectedAnswer,
      correctAnswer,
      context, // Add context to get user's actual wallet
    } = body;

    // Validate required fields
    if (!fid || !username) {
      return NextResponse.json(
        { success: false, error: "Missing user information" },
        { status: 400 }
      );
    }

    // Get the actual user's wallet address from context
    const userWalletAddress = getActualUserWallet(context, walletAddress, fid);

    let tokenReward = false;
    let tokenAmount = "0";
    let participationReward = false;
    let participationAmount = "0";

    // Calculate reward amounts (but don't mint immediately)
    let rewardAmount = ethers.parseEther("0");

    if (isCorrect) {
      // Base reward for correct answer
      rewardAmount = REWARDS.CORRECT_ANSWER;

      // Streak bonus (every 5 correct in a row)
      if (streak > 0 && streak % 5 === 0) {
        rewardAmount += REWARDS.STREAK_BONUS;
      }

      tokenReward = true;
      tokenAmount = ethers.formatEther(rewardAmount);
    } else {
      // Participation reward for trying
      rewardAmount = REWARDS.PARTICIPATION;
      participationReward = true;
      participationAmount = ethers.formatEther(rewardAmount);
    }

    // Note: Tokens are now added to pending claims instead of immediate minting
    // Users can claim them from the leaderboard interface

    // Save game result to database (implement your DB logic here)
    await saveGameResult({
      fid,
      username,
      walletAddress: userWalletAddress,
      score,
      streak,
      roundId,
      isCorrect,
      question,
      selectedAnswer,
      correctAnswer,
      tokenReward: tokenReward || participationReward,
      tokenAmount: isCorrect ? tokenAmount : participationAmount,
      timestamp: new Date(),
    });

    // Update leaderboard with new stats
    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_URL || "http://localhost:3000"
        }/api/leaderboard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            fid,
            username,
            score,
            streak,
            walletAddress: userWalletAddress,
            context,
          }),
        }
      );
    } catch (error) {
      console.error("Failed to update leaderboard:", error);
    }

    return NextResponse.json({
      success: true,
      tokenReward,
      tokenAmount,
      participationReward,
      participationAmount,
      message: isCorrect
        ? `Correct! ${tokenAmount} $BLITZ earned${
            streak % 5 === 0 && streak > 0 ? " (with streak bonus!)" : ""
          }`
        : `Good try! ${participationAmount} $BLITZ for participation`,
    });
  } catch (error) {
    console.error("Game result API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process game result" },
      { status: 500 }
    );
  }
}

// Helper function to get the actual user's wallet address
function getActualUserWallet(
  context: any,
  providedWalletAddress: string | undefined,
  fid: number
): string | null {
  // Priority order for wallet address:
  // 1. Provided wallet address (if explicitly passed) - this is the connected wallet from frontend
  // 2. User's connected wallet from context
  // 3. User's verified addresses from context
  // 4. Farcaster custody address (if available)

  // If a wallet address was explicitly provided, use it (this comes from wagmi useAccount)
  if (providedWalletAddress && ethers.isAddress(providedWalletAddress)) {
    console.log(`Using provided wallet address: ${providedWalletAddress}`);
    return providedWalletAddress;
  }

  // Try to get user's connected wallet from context
  if (
    context?.user?.connectedWallet &&
    ethers.isAddress(context.user.connectedWallet)
  ) {
    console.log(
      `Using context connected wallet: ${context.user.connectedWallet}`
    );
    return context.user.connectedWallet;
  }

  // Try to get user's verified addresses from context
  if (context?.user?.verified_addresses) {
    const { verified_addresses } = context.user;

    // Try primary ETH address first
    if (
      verified_addresses.primary?.eth_address &&
      ethers.isAddress(verified_addresses.primary.eth_address)
    ) {
      console.log(
        `Using primary verified address: ${verified_addresses.primary.eth_address}`
      );
      return verified_addresses.primary.eth_address;
    }

    // Try first ETH address from the array
    if (
      verified_addresses.eth_addresses &&
      verified_addresses.eth_addresses.length > 0
    ) {
      const firstEthAddress = verified_addresses.eth_addresses[0];
      if (ethers.isAddress(firstEthAddress)) {
        console.log(`Using first verified address: ${firstEthAddress}`);
        return firstEthAddress;
      }
    }
  }

  // Try to get Farcaster custody address
  if (
    context?.user?.custody_address &&
    ethers.isAddress(context.user.custody_address)
  ) {
    console.log(
      `Using Farcaster custody address: ${context.user.custody_address}`
    );
    return context.user.custody_address;
  }

  // No valid wallet found
  console.warn(`No valid wallet found for user ${fid}`);
  return null;
}

// Database function to save game results
async function saveGameResult(data: any) {
  // Implement your database logic here
  // This could be PostgreSQL, MongoDB, etc.

  console.log("Saving game result:", data);

  // Example with a hypothetical database:
  /*
  await db.gameResults.create({
    data: {
      fid: data.fid,
      username: data.username,
      walletAddress: data.walletAddress,
      score: data.score,
      streak: data.streak,
      roundId: data.roundId,
      isCorrect: data.isCorrect,
      question: data.question,
      selectedAnswer: data.selectedAnswer,
      correctAnswer: data.correctAnswer,
      tokenReward: data.tokenReward,
      tokenAmount: data.tokenAmount,
      createdAt: data.timestamp,
    }
  });
  */
}

// Alternative: If using Pages Router
/*
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  // Same logic as above...
}
*/
