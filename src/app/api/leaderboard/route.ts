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

// In-memory storage for demo (replace with database in production)
const leaderboardData: Array<{
  fid: number;
  username: string;
  score: number;
  streak: number;
  lastPlayed: string;
  walletAddress?: string;
  pendingTokens?: string;
}> = [];

// Pending token claims
const pendingClaims: Map<number, { amount: string; timestamp: Date }> =
  new Map();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      limit = 10,
      fid,
      username,
      score,
      streak,
      walletAddress,
      context,
      amount,
    } = body;

    switch (action) {
      case "get":
        // Return leaderboard data
        const sortedLeaderboard = [...leaderboardData]
          .sort((a, b) => b.score - a.score || b.streak - a.streak)
          .slice(0, limit);

        return NextResponse.json({
          success: true,
          leaderboard: sortedLeaderboard,
        });

      case "update":
        // Update player stats in leaderboard
        if (!fid || !username) {
          return NextResponse.json(
            { success: false, error: "Missing user information" },
            { status: 400 }
          );
        }

        const existingIndex = leaderboardData.findIndex(
          (entry) => entry.fid === fid
        );
        const userWallet = getActualUserWallet(context, walletAddress, fid);
        const updatedEntry = {
          fid,
          username,
          score: score || 0,
          streak: streak || 0,
          lastPlayed: new Date().toLocaleString(),
          walletAddress: userWallet || undefined,
        };

        if (existingIndex >= 0) {
          leaderboardData[existingIndex] = updatedEntry;
        } else {
          leaderboardData.push(updatedEntry);
        }

        return NextResponse.json({
          success: true,
          message: "Leaderboard updated",
        });

      case "claim":
        // Claim pending tokens
        if (!fid || !context) {
          return NextResponse.json(
            { success: false, error: "Missing user information" },
            { status: 400 }
          );
        }

        const userWalletAddress = getActualUserWallet(
          context,
          walletAddress,
          fid
        );
        const pendingClaim = pendingClaims.get(fid);

        if (!pendingClaim) {
          return NextResponse.json(
            { success: false, error: "No pending tokens to claim" },
            { status: 400 }
          );
        }

        if (!userWalletAddress || !ethers.isAddress(userWalletAddress)) {
          return NextResponse.json(
            { success: false, error: "No valid wallet address found" },
            { status: 400 }
          );
        }

        try {
          // Setup provider and signer
          const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
          const signer = new ethers.Wallet(PRIVATE_KEY, provider);
          const blitzContract = new ethers.Contract(
            BLITZ_TOKEN_ADDRESS,
            BLITZ_TOKEN_ABI,
            signer
          );

          // Mint tokens to user
          const amount = ethers.parseEther(pendingClaim.amount);
          const tx = await blitzContract.mint(userWalletAddress, amount);
          await tx.wait(); // Wait for confirmation

          // Remove from pending claims
          pendingClaims.delete(fid);

          console.log(
            `Claimed ${pendingClaim.amount} BLITZ for user ${fid} to ${userWalletAddress}`
          );

          return NextResponse.json({
            success: true,
            transactionHash: tx.hash,
            message: `Successfully claimed ${pendingClaim.amount} $BLITZ!`,
          });
        } catch (contractError) {
          console.error("Token claiming failed:", contractError);
          return NextResponse.json(
            { success: false, error: "Failed to claim tokens" },
            { status: 500 }
          );
        }

      case "addPending":
        // Add pending tokens for claiming
        if (!fid || !amount) {
          return NextResponse.json(
            { success: false, error: "Missing user information or amount" },
            { status: 400 }
          );
        }

        pendingClaims.set(fid, { amount, timestamp: new Date() });

        return NextResponse.json({
          success: true,
          message: `${amount} $BLITZ added to pending claims`,
        });

      case "getPending":
        // Get pending tokens for a user
        if (!fid) {
          return NextResponse.json(
            { success: false, error: "Missing user FID" },
            { status: 400 }
          );
        }

        const userPendingClaim = pendingClaims.get(fid);
        const pendingAmount = userPendingClaim ? userPendingClaim.amount : "0";

        return NextResponse.json({
          success: true,
          pendingAmount,
        });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Leaderboard API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process leaderboard request" },
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
