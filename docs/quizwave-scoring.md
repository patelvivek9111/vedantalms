# QuizWave competitive scoring

## Root-cause analysis (previous limitations)

| Issue | Impact |
|-------|--------|
| Ad-hoc formula in socket handler (`500 * (1 - time/max) + streak*50`) | Not Kahoot-like; streak was additive not multiplicative |
| Scoring embedded in transport layer | Hard to test, tune, or extend |
| Minimal player payload | No rank movement, feedback labels, or breakdown |
| Leaderboard rebuilt in multiple places | Inconsistent fields, extra sorts |
| No persisted streak / rank history on participant | Streak recomputed each answer; no climb tracking |
| Client could infer partial scoring | Risk of drift if UI ever computed points |

## Architecture

```
quizwave.socket.js          → validates answer, calls processAnswer()
quizScoringEngine.js        → scores, streaks, ranks, leaderboards, game summary
quizwaveScoringConfig.js    → tunable constants
quizwaveSessionEngine.js    → FSM unchanged; uses buildLeaderboard / computeGameSummary
```

Clients **only render** `quizwave:player-result` / `quizwave:answer-received` and snapshot `leaderboard`.

## Formula (deterministic)

```
basePoints = 1000
timeFactor = remainingTime / totalQuestionTime
speedBonus = floor(basePoints * timeFactor * 0.5)
effectiveStreak = min(streakBeforeAnswer, 5)
streakMultiplier = min(1 + effectiveStreak * 0.1, 1.5)
points = round((basePoints + speedBonus) * streakMultiplier * questionTypeMultiplier)
```

Incorrect / no answer → `0` points, `streak = 0`.

## Streak rules

- **Before** scoring: `streakBefore` = consecutive correct answers in prior questions.
- **After** correct: `participant.streak = streakBefore + 1`.
- **After** incorrect: `participant.streak = 0`.
- Milestones: 3 → On Fire, 5 → Unstoppable, 8 → Quiz Master.

## Rank movement

1. `previousRank` = rank before points applied.
2. Update score and save answer.
3. `currentRank` = rank after points.
4. `rankDelta = previousRank - currentRank` (positive = moved up).

## Socket flow

| Phase | Events |
|-------|--------|
| QUESTION_ACTIVE | Student submits → `quizwave:answer` |
| On accept | `quizwave:player-result` + `quizwave:answer-received` (student only) |
| | `quizwave:answer-submitted` (teacher room, no personal card) |
| QUESTION_LOCKED → ANSWER_REVEAL | `quizwave:game-state` |
| SCOREBOARD | `quizwave:leaderboard-update` + snapshot top 5 |
| FINISHED | `quizwave:quiz-ended` with `gameSummary` + MVP badges |

## Anti-cheat

- Answers only in `QUESTION_ACTIVE`.
- One answer per question per participant.
- Server `phaseStartedAt` for response time (client time clamped).
- Reject invalid option indices and duplicate submissions.

## Files changed

- `config/quizwaveScoringConfig.js`
- `services/quizScoringEngine.js`
- `models/quizwave.model.js` (participant scoring fields)
- `socket/quizwave.socket.js`
- `services/quizwaveSessionEngine.js`
- `frontend/src/types/quizwaveScoring.ts`, `quizwaveGameState.ts`
- `frontend/src/components/quizwave/StudentAnswerFeedbackView.tsx`
- `frontend/src/components/quizwave/StudentGameScreen.tsx`
- `frontend/src/components/quizwave/QuizSessionControl.tsx`
- `tests/quizScoringEngine.test.js`

## Manual test checklist

1. Two students join; teacher starts quiz.
2. Student A answers correctly in &lt;2s → high points (≈1400+).
3. Student B answers correctly near timer end → noticeably fewer points.
4. Student A answers wrong → 0 points, streak resets; feedback shows rank.
5. Student A gets 3 correct in a row → “On Fire 🔥” on result screen.
6. SCOREBOARD phase → teacher sees top 5 with ↑/↓ deltas.
7. End quiz → MVP badges and accuracy stats on finish screen.
8. Restart server mid-game not required; scores identical on reconnect sync.
