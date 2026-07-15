import "server-only";

import { usersCollection } from "@/lib/mongodb";
import { VOICE_BUDGET_SECONDS } from "@/lib/models";

/**
 * The per-user voice budget (ai_rules.md §9): 5 minutes of total recorded
 * duration per account, enforced with an atomic check-and-increment *before*
 * anything is uploaded, so a rejected recording never touches Blob storage.
 */

/**
 * Atomically reserve `seconds` of budget for a user. Returns `false` — reserving
 * nothing — when it would push them over the limit.
 *
 * The check and the increment are a single `findOneAndUpdate`: the filter only
 * matches when there's room (`totalVoiceSeconds <= limit - seconds`), so two
 * concurrent uploads can't both pass a stale check and jointly overspend — the
 * loser simply matches nothing.
 */
export async function reserveBudget(
  uid: string,
  seconds: number,
): Promise<boolean> {
  const users = await usersCollection();
  const result = await users.findOneAndUpdate(
    {
      firebaseUid: uid,
      totalVoiceSeconds: { $lte: VOICE_BUDGET_SECONDS - seconds },
    },
    { $inc: { totalVoiceSeconds: seconds }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return result !== null;
}

/**
 * Give `seconds` back — used both to roll back a reservation when the Blob
 * upload fails and to credit the account when a voice note is deleted. Clamped
 * at zero via an aggregation-pipeline update so a bookkeeping slip can never
 * leave a negative balance.
 */
export async function refundBudget(uid: string, seconds: number): Promise<void> {
  const users = await usersCollection();
  await users.updateOne({ firebaseUid: uid }, [
    {
      $set: {
        totalVoiceSeconds: {
          $max: [0, { $subtract: ["$totalVoiceSeconds", seconds] }],
        },
        updatedAt: new Date(),
      },
    },
  ]);
}
