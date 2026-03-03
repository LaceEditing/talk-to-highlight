import { ratio } from 'fuzzball'

// ── Tuning constants ──────────────────────────────────────────────────────

/** Minimum fuzzball similarity score (0–100) to consider a word matched */
const MATCH_THRESHOLD = 65

/** Higher threshold for very short words (≤2 chars) that match everywhere */
const SHORT_WORD_THRESHOLD = 92

/** Normal look-ahead window from the pointer */
const LOOK_AHEAD = 10

/** Bonus score added to the candidate sitting right at the pointer */
const PROXIMITY_BONUS = 18

/** Score penalty subtracted per word of distance from the pointer */
const DISTANCE_PENALTY = 3

/**
 * Maximum number of doc words a *single* spoken word is allowed to skip
 * without multi-word sequence confirmation.
 */
const MAX_UNCONFIRMED_SKIP = 2

/** Minimum consecutive spoken→doc matches needed to confirm a bigger skip */
const MIN_SEQUENCE_FOR_SKIP = 2

/** Consecutive misses before we enter wider recovery mode */
const MISS_STREAK_FOR_RECOVERY = 5

/** How far ahead to search during recovery (requires sequence confirmation) */
const RECOVERY_LOOK_AHEAD = 30

/** Minimum sequence length accepted during recovery */
const MIN_RECOVERY_SEQUENCE = 3

// ── State ─────────────────────────────────────────────────────────────────

export interface MatcherState {
  /** Index of the next document word we expect the reader to say */
  pointer: number
  /** Every word whose index is ≤ highlightedUpTo is highlighted */
  highlightedUpTo: number
  /** Consecutive spoken words that failed to match anything */
  missStreak: number
}

export function createMatcherState(): MatcherState {
  return { pointer: 0, highlightedUpTo: -1, missStreak: 0 }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * Compute a distance-penalised match score.
 * Candidates right at the pointer get a sizeable bonus so that repeated
 * words further ahead don't accidentally win.
 */
function weightedScore(spoken: string, docWord: string, distance: number): number {
  const raw = ratio(spoken, docWord)
  const bonus = distance === 0 ? PROXIMITY_BONUS : 0
  return Math.max(0, raw + bonus - distance * DISTANCE_PENALTY)
}

/**
 * Starting from `spokenStart` in the spoken array and `docStart` in the
 * document, count how many consecutive spoken words match consecutive
 * (allowing at most 1 skip) document words.  Used to confirm that a
 * candidate position is where the reader genuinely is.
 */
function sequenceMatchLength(
  spokenWords: string[],
  spokenStart: number,
  docWords: { normalized: string }[],
  docStart: number,
): number {
  let matched = 0
  let dIdx = docStart

  for (let s = spokenStart; s < spokenWords.length && dIdx < docWords.length; s++) {
    const sp = normalize(spokenWords[s])
    if (!sp) continue // skip empty tokens

    // Allow skipping up to 1 doc word (small filler / misrecognition)
    let found = false
    for (let skip = 0; skip <= 1 && dIdx + skip < docWords.length; skip++) {
      if (ratio(sp, docWords[dIdx + skip].normalized) >= MATCH_THRESHOLD) {
        dIdx = dIdx + skip + 1
        matched++
        found = true
        break
      }
    }
    if (!found) break
  }
  return matched
}

// ── Main entry point ──────────────────────────────────────────────────────

/**
 * Feed a batch of newly-spoken words into the matcher.
 * Returns an updated (immutable) state.
 */
export function processSpokenWords(
  spokenWords: string[],
  docWords: { normalized: string }[],
  state: MatcherState,
): MatcherState {
  let { pointer, highlightedUpTo, missStreak } = state

  for (let si = 0; si < spokenWords.length; si++) {
    if (pointer >= docWords.length) break

    const normalizedSpoken = normalize(spokenWords[si])
    if (!normalizedSpoken) continue

    // Short words (a, I, an, …) need a near-exact or positional match
    const threshold =
      normalizedSpoken.length <= 2 ? SHORT_WORD_THRESHOLD : MATCH_THRESHOLD

    // ── Phase 1: normal look-ahead with distance weighting ────────────
    const lookEnd = Math.min(pointer + LOOK_AHEAD, docWords.length)

    let bestScore = 0
    let bestIdx = -1

    for (let i = pointer; i < lookEnd; i++) {
      const score = weightedScore(normalizedSpoken, docWords[i].normalized, i - pointer)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    if (bestScore >= threshold && bestIdx !== -1) {
      const skip = bestIdx - pointer

      if (skip <= MAX_UNCONFIRMED_SKIP) {
        // Close match — accept immediately
        pointer = bestIdx + 1
        highlightedUpTo = bestIdx
        missStreak = 0
        continue
      }

      // Bigger skip — require multi-word sequence confirmation
      const remaining = spokenWords.length - si
      if (remaining >= MIN_SEQUENCE_FOR_SKIP) {
        const seqLen = sequenceMatchLength(spokenWords, si, docWords, bestIdx)
        if (seqLen >= MIN_SEQUENCE_FOR_SKIP) {
          pointer = bestIdx + 1
          highlightedUpTo = bestIdx
          missStreak = 0
          continue
        }
      }

      // If raw (unweighted) score is very high AND the word is long
      // enough to be unambiguous, accept it even without sequence proof.
      const rawScore = ratio(normalizedSpoken, docWords[bestIdx].normalized)
      if (rawScore >= 90 && normalizedSpoken.length >= 5) {
        pointer = bestIdx + 1
        highlightedUpTo = bestIdx
        missStreak = 0
        continue
      }

      // Otherwise ignore this candidate — too risky
    }

    // ── Phase 2: recovery after prolonged misses ──────────────────────
    if (missStreak >= MISS_STREAK_FOR_RECOVERY) {
      const recoveryEnd = Math.min(pointer + RECOVERY_LOOK_AHEAD, docWords.length)
      let bestRecIdx = -1
      let bestRecSeq = 0

      for (let i = pointer; i < recoveryEnd; i++) {
        if (ratio(normalizedSpoken, docWords[i].normalized) >= MATCH_THRESHOLD) {
          const seqLen = sequenceMatchLength(spokenWords, si, docWords, i)
          if (seqLen >= MIN_RECOVERY_SEQUENCE && seqLen > bestRecSeq) {
            bestRecSeq = seqLen
            bestRecIdx = i
          }
        }
      }

      if (bestRecIdx !== -1) {
        pointer = bestRecIdx + 1
        highlightedUpTo = bestRecIdx
        missStreak = 0
        continue
      }
    }

    // No match — bump the miss counter
    missStreak++
  }

  return { pointer, highlightedUpTo, missStreak }
}
