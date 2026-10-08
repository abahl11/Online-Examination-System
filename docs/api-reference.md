# API Reference

- **Base URL:** `/api` (locally `http://localhost:5001/api`)
- **Interactive docs:** `/api-docs` (Swagger UI). The raw spec is at `/api-docs.json`.
- **Postman:** import [`TestDesk.postman_collection.json`](TestDesk.postman_collection.json)

## Conventions

**Auth.** Send `Authorization: Bearer <token>`. You get the token from `/auth/login` or `/auth/register`.

**Response shape.**
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 10, "total": 42, "pages": 5 } }
```
```json
{ "success": false, "message": "Please correct the highlighted fields", "code": "SESSION_REPLACED",
  "details": [{ "field": "email", "message": "Enter a valid email address" }] }
```

**List endpoints** accept these query parameters:

| Param | Meaning |
|---|---|
| `page` | Page number, starting at 1 |
| `limit` | 1–100, default 10 |
| `search` | Case-insensitive text search on the fields listed for each endpoint |
| `sort` | A field name. Prefix it with `-` for descending order, e.g. `sort=-createdAt`. Only whitelisted fields are accepted |

**Status codes.**

| Code | Meaning |
|---|---|
| 200 / 201 | Success |
| 400 | Bad id or malformed JSON |
| 401 | Not signed in, token expired, or the session was replaced |
| 403 | Your role is not allowed to do this |
| 404 | Not found |
| 409 | Conflict with the current state (e.g. exam not open, no attempts left) |
| 422 | Validation failed |
| 429 | Too many login attempts |
| 500 | Server error |

**`code` values on 401 errors:**

| Code | Meaning |
|---|---|
| `NO_TOKEN` | No token was sent |
| `TOKEN_INVALID` | The token is invalid or expired |
| `SESSION_REPLACED` | The account signed in on another device |
| `SIGNED_OUT` | The user signed out |
| `ACCOUNT_UNAVAILABLE` | The account was deactivated or deleted |

---

## Auth
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{ fullName, email, password }` → student account + token |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }`. Ends any other session of this user |
| POST | `/auth/logout` | any | Ends the current session |
| GET | `/auth/me` | any | Current user |

Login and register are rate-limited to 20 requests per 15 minutes per IP.

## Users & roles (admin)
| Method | Path | Notes |
|---|---|---|
| GET | `/users` | Search: `fullName`, `email`. Filters: `role`, `isActive`. Sort: `fullName`, `email`, `createdAt`, `lastLoginAt` |
| POST | `/users` | `{ fullName, email, password, role, isActive? }` |
| GET | `/users/:id` | |
| PATCH | `/users/:id` | `{ fullName?, role?, isActive?, password? }`. A role change, deactivation or password reset ends the user's session |
| DELETE | `/users/:id` | Refused (409) if the user has exam history. Deactivate them instead |
| GET | `/roles` | The three roles |

## Courses
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/courses` | any | Instructors only see their own courses. Search: `title`, `code` |
| GET | `/courses/:id` | any | |
| POST | `/courses` | admin | `{ title, code, description? }` |
| PATCH | `/courses/:id` | admin | |
| DELETE | `/courses/:id` | admin | Only works when the course has no exams or questions |
| PUT | `/courses/:id/instructors` | admin | `{ instructorIds: [] }` replaces the assigned instructors |

## Question bank (instructor, admin)
| Method | Path | Notes |
|---|---|---|
| GET | `/questions` | Filters: `course`, `kind` (`mcq`/`coding`). Search: `prompt`. Sort: `createdAt`, `marks`, `kind` |
| POST | `/questions` | `{ course, kind, prompt, marks }`. MCQ: `options: [{ text, isCorrect }]` with 2–8 options and exactly one correct. Coding: optional `language` |
| GET | `/questions/:id` | Includes the options and which one is correct |
| PATCH | `/questions/:id` | Refused once the question is part of a published or closed exam |
| DELETE | `/questions/:id` | Same lock. The question is also removed from draft exam pools |

## Exams
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/exams` | any | Students only see published exams. Each item adds `attemptsUsed`, `attemptsLeft` and `liveAttemptId`. Staff can filter by `status` and `course` |
| GET | `/exams/:id` | any | Staff get the full question pool |
| POST | `/exams` | instructor, admin | See the exam fields below |
| PATCH | `/exams/:id` | instructor, admin | Draft exams only |
| DELETE | `/exams/:id` | instructor, admin | Only when nobody has attempted it |
| PATCH | `/exams/:id/status` | instructor, admin | `{ status }`. **published** needs at least one question. **draft** needs zero attempts. **closed** auto-submits running attempts |
| POST | `/exams/:id/publish-results` | instructor, admin | The exam must be closed, with no coding answers still pending review |
| GET | `/exams/:id/results` | instructor, admin | Filter: `reviewStatus`. Sort: `totalScore`, `percentage`, `createdAt`, `timeTakenSeconds` |
| GET | `/exams/:id/leaderboard` | any | Students can see it only after results are published |

Exam fields for `POST /exams`:
- **Required:** `title`, `course`, `durationMinutes`
- **Optional:** `description`, `questions[]`, `questionsPerAttempt` (0 = all), `negativeMark`, `maxAttempts`

## Attempts (student)
| Method | Path | Notes |
|---|---|---|
| POST | `/attempts` | `{ examId }`. Starts a new attempt or resumes the running one. Questions are drawn at random from the pool. Returns the paper and `secondsLeft` |
| GET | `/attempts/mine` | Exam history. Scores appear once results are published |
| GET | `/attempts/:id` | Paper, saved answers and time left. If time has run out, it submits automatically |
| PUT | `/attempts/:id/answers` | `{ question, selectedOption }` or `{ question, codeAnswer }`. Returns 409 with code `TIME_UP` after the deadline |
| POST | `/attempts/:id/submit` | `{ answers?: [...], auto?: boolean }`. Safe to call twice |

Correct answers are never sent to students.

## Results
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/results/mine` | student | Shows the numbers only for published exams |
| GET | `/results/:id` | owner student (after publication), course staff | Per-question breakdown |
| GET | `/results/:id/pdf` | same as above | PDF result sheet |
| PATCH | `/results/:id/review` | instructor, admin | `{ grades: [{ question, marks, feedback }] }` grades coding answers and recalculates the totals and leaderboard |

## Reports & audit (admin)
| Method | Path | Notes |
|---|---|---|
| GET | `/reports/overview` | Users by role, courses, exams by status, attempts, average %, pending reviews |
| GET | `/reports/exams` | Per exam: attempts, average %, highest and lowest score. Search: `title` |
| GET | `/audit-logs` | Filters: `action` (matches a prefix, e.g. `exam.`), `entity`, `actor`. Search: action, entity, role, IP |

---

## Example: a full exam round

```http
POST /api/auth/login
{ "email": "meera@example.com", "password": "Teach@12345" }

POST /api/exams                       (instructor token)
{ "title": "Quiz 2", "course": "<courseId>", "durationMinutes": 10,
  "questions": ["<q1>", "<q2>", "<q3>"], "questionsPerAttempt": 2, "negativeMark": 0.25 }

PATCH /api/exams/<examId>/status      { "status": "published" }

POST /api/attempts                    (student token)  { "examId": "<examId>" }
PUT  /api/attempts/<attemptId>/answers { "question": "<q1>", "selectedOption": "<optionId>" }
POST /api/attempts/<attemptId>/submit  { }

PATCH /api/exams/<examId>/status      (instructor)  { "status": "closed" }
POST  /api/exams/<examId>/publish-results

GET /api/results/<resultId>/pdf       (student)
```
