# Database Schema

TestDesk uses **MongoDB** through Mongoose. There is one collection per table in the brief. The collection names match those tables exactly.

| Brief table | Collection | Mongoose model | File |
|---|---|---|---|
| Users | `users` | `User` | `src/data/User.js` |
| Roles | `roles` | `Role` | `src/data/Role.js` |
| Courses | `courses` | `Course` | `src/data/Course.js` |
| Exams | `exams` | `Exam` | `src/data/Exam.js` |
| Questions | `questions` | `Question` | `src/data/Question.js` |
| Options | `options` | `Option` | `src/data/Option.js` |
| Student Attempts | `student_attempts` | `Attempt` | `src/data/Attempt.js` |
| Results | `results` | `Result` | `src/data/Result.js` |
| Leaderboard | `leaderboard` | `LeaderboardEntry` | `src/data/LeaderboardEntry.js` |
| Audit Logs | `audit_logs` | `AuditLog` | `src/data/AuditLog.js` |

Every document has `_id` (ObjectId). All collections except `audit_logs` also have `createdAt` and `updatedAt`. Audit logs only get `createdAt`, because an audit entry is never edited.

---

## roles
| Field | Type | Notes |
|---|---|---|
| name | String, unique | `admin`, `instructor` or `student` |
| label | String | Display name |
| description | String | |

The three roles are created (upserted) every time the server starts.

## users
| Field | Type | Notes |
|---|---|---|
| fullName | String | required, max 80 |
| email | String, **unique** | stored lower-case |
| passwordHash | String | bcrypt hash; never returned by the API |
| role | ObjectId → roles | required, indexed |
| isActive | Boolean | `false` blocks sign-in and ends the current session |
| sessionId | String \| null | Id of the one session allowed for this user. A new login rotates it, which invalidates older JWTs |
| lastLoginAt | Date | |

## courses
| Field | Type | Notes |
|---|---|---|
| title | String | required |
| code | String, **unique** | upper-case, e.g. `CS201` |
| description | String | |
| instructors | [ObjectId → users] | Instructors assigned by an admin (indexed) |
| createdBy | ObjectId → users | |

## questions
| Field | Type | Notes |
|---|---|---|
| course | ObjectId → courses | required |
| author | ObjectId → users | the instructor who created it |
| kind | String | `mcq` or `coding` |
| prompt | String | the question text |
| marks | Number | default 1 |
| language | String | coding questions only, e.g. `javascript` |

Index: `{ course, kind }`. The virtual field `options` populates from the `options` collection.

## options
| Field | Type | Notes |
|---|---|---|
| question | ObjectId → questions | indexed |
| text | String | |
| isCorrect | Boolean | Exactly one option per MCQ is `true` (checked by validation) |
| position | Number | original order |

## exams
| Field | Type | Notes |
|---|---|---|
| title, description | String | |
| course | ObjectId → courses | |
| createdBy | ObjectId → users | |
| questions | [ObjectId → questions] | the **pool** to draw from |
| questionsPerAttempt | Number | `0` = use the whole pool |
| durationMinutes | Number | timer length |
| negativeMark | Number | marks taken off for each wrong MCQ |
| maxAttempts | Number | attempts allowed per student |
| status | String | `draft` → `published` → `closed` |
| resultsPublished | Boolean | students see scores only after this is set |
| resultsPublishedAt | Date | |

Index: `{ course, status }`.

## student_attempts
| Field | Type | Notes |
|---|---|---|
| exam | ObjectId → exams | |
| student | ObjectId → users | |
| attemptNumber | Number | 1, 2, … per student per exam |
| paper | [{ question, optionOrder: [ObjectId] }] | the randomly drawn questions in display order, with each MCQ's option ids |
| answers | [{ question, selectedOption, codeAnswer, savedAt }] | saved one at a time while the exam runs |
| startedAt | Date | |
| deadline | Date | `startedAt + durationMinutes` |
| submittedAt | Date | |
| status | String | `in_progress`, `submitted`, `auto_submitted` |

Indexes:
- `{ student, exam }`
- `{ status, deadline }`, used by the auto-submit sweep
- **partial unique** `{ exam, student }` where `status = in_progress`, so a student can never have two running attempts of the same exam

## results
| Field | Type | Notes |
|---|---|---|
| attempt | ObjectId → student_attempts, **unique** | one result per attempt |
| exam, student | ObjectId | |
| maxScore, mcqScore, codingScore, totalScore | Number | `totalScore` never drops below 0 |
| percentage | Number | rounded to 2 decimals |
| correctCount, wrongCount, unansweredCount | Number | |
| timeTakenSeconds | Number | |
| reviewStatus | String | `auto` (MCQ only), `pending` (coding answers waiting), `reviewed` |
| lines | [MarkLine] | per-question breakdown (below) |

**MarkLine:** `question`, `kind`, `prompt`, `maxMarks`, `marksAwarded`, `outcome` (`correct` / `wrong` / `unanswered` / `pending` / `reviewed`), `selectedOption`, `selectedText`, `correctText`, `codeAnswer`, `feedback`.
The prompt and option texts are copied into the result. That way a result still reads correctly even if the question is edited later.

Indexes: `{ exam, totalScore: -1 }`, `{ student, createdAt: -1 }`.

## leaderboard
| Field | Type | Notes |
|---|---|---|
| exam, student | ObjectId | **unique together** |
| bestResult | ObjectId → results | |
| bestScore, bestPercentage | Number | the student's best attempt |
| timeTakenSeconds | Number | used to break ties (faster ranks higher) |
| attemptsUsed | Number | |

This row is rebuilt whenever a result is created or reviewed. Rank is the sort order `bestScore desc, timeTakenSeconds asc`.

## audit_logs
| Field | Type | Notes |
|---|---|---|
| actor | ObjectId → users \| null | `null` for guests (e.g. failed logins) |
| actorRole | String | |
| action | String | dotted name, e.g. `auth.login`, `exam.publish_results`, `attempt.auto_submit` |
| entity, entityId | String, ObjectId | what was touched |
| details | Mixed | small JSON payload |
| ip, userAgent | String | |
| createdAt | Date | indexed (newest first) |
