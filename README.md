# TestDesk — Online Examination System

TestDesk is the backend for an online exam platform, built with **Node.js, Express and MongoDB**.

- **Admins** manage users and courses, and assign instructors to courses.
- **Instructors** write questions (MCQ and coding), create timed exams and publish results.
- **Students** take exams, then see their score, download a PDF result and check the leaderboard.

**Documents:** the API documentation, ER diagram and database schema are in the `docs/` folder. See [Documentation](#documentation) below for what each one is and how to open it.

---

## How to get and test this project

The project runs with **Docker**, so you don't need to install Node.js or MongoDB, or create any settings file.

**You need:** [Git](https://git-scm.com/downloads) and [Docker Desktop](https://www.docker.com/products/docker-desktop/). Docker Desktop must be open and running.

**1. Download the project**
```bash
git clone <repo-url>
cd <project-folder>
```

**2. Start it**
```bash
docker compose up --build
```
The first start takes a few minutes while Docker downloads what it needs. It's ready when the log shows `TestDesk running on port 5001`.

**3. Open the API docs (Swagger)**

Go to **<http://localhost:5001/api-docs>**.

**4. Sign in inside Swagger**
1. Open **Auth → POST /auth/login** and click **Try it out**.
2. Send:
   ```json
   { "email": "admin@testdesk.dev", "password": "Admin@12345" }
   ```
3. Copy the `token` from the response.
4. Click **Authorize** at the top of the page and paste the token.

Every API can now be tried from the page. To act as another role, log in with one of the accounts below and authorize again with that token.

**5. Stop it**

Press `Ctrl + C` in the terminal, or run `docker compose down`. To start again from fresh demo data, run `docker compose down -v` and then step 2 again.

> **Port 5001 already in use?** In `docker-compose.yml`, change the left number in `"5001:5001"` (for example to `"5050:5001"`), then open `http://localhost:5050/api-docs` instead.

**Other ways to test**
- **Postman:** import `docs/TestDesk.postman_collection.json` and run the folders in order. Tokens and ids fill in automatically.
- **Browser:** <http://localhost:5001> has simple web pages for clicking through the app with the same logins.

---

## Demo data

On first start, the app adds a small set of sample data so there's something to test straight away.

**Logins**

| Role | Email | Password |
|---|---|---|
| Admin | admin@testdesk.dev | Admin@12345 |
| Instructor | meera@testdesk.dev | Teach@12345 |
| Student | aarav@testdesk.dev | Learn@12345 |
| Student | sara@testdesk.dev | Learn@12345 |

**What's included**
- **2 courses:**
  - *JavaScript Fundamentals (JS101)*, taught by Meera
  - *Database Systems (DB201)*, with no instructor yet, so you can try assigning one
- **9 questions** in JS101: 8 MCQs (2 marks each) and 1 coding question (5 marks)
- **JavaScript Warm-up Test:** finished, with results published
  - Aarav scored 8/8 and Sara scored 3.5/8, so the scores, PDF, leaderboard and reports already have data
- **JavaScript Basics — Quiz 1:** open now for students to take
  - 6 random questions from a pool of 9
  - 15 minutes, 2 attempts, −0.5 for each wrong MCQ

**A quick test flow**
1. As **Aarav**: start *Quiz 1* (`POST /attempts`), answer questions (`PUT /attempts/{id}/answers`), then submit (`POST /attempts/{id}/submit`).
2. As **Meera**: close the quiz (`PATCH /exams/{id}/status`), mark any coding answer (`PATCH /results/{id}/review`), then publish results (`POST /exams/{id}/publish-results`).
3. As **Aarav**: see the score (`GET /results/mine`), download the PDF (`GET /results/{id}/pdf`) and view the leaderboard (`GET /exams/{id}/leaderboard`).
4. As **Admin**: see reports (`GET /reports/overview`) and audit logs (`GET /audit-logs`).

---

## How it works (in short)

- **Login:** uses JWT tokens, and each role can only use its own APIs. Signing in on a second device signs out the first one.
- **Random papers:** each attempt picks a random set of questions from the exam's pool.
- **Timer:** every attempt has a deadline. When time runs out, the exam is submitted automatically.
- **Marking:**
  - Right MCQ: full marks
  - Wrong MCQ: minus the exam's negative mark
  - Blank: 0
  - Coding answer: marked by the instructor
  - The total never goes below 0.
- **Results:** students see scores only after the instructor publishes them. Each student's best score goes on the leaderboard.
- **Audit log:** records important actions such as logins, changes and submissions.

---

## Project structure

```
src/
  server.js        starts the app
  app.js           Express setup (security, docs, routes)
  boot/            settings, logger, database, first admin + demo data
  data/            MongoDB models (one per table)
  features/        one folder per module: auth, users, courses, questions,
                   exams, attempts, results, reports, audit
  engine/          marking, random paper, timer, PDF result
  middleware/      login check, role check, validation, error handling
  helpers/         shared helpers (pagination/search/sort, audit log, …)
public/            simple web pages for trying the app
tests/             unit tests
docs/              database schema, ER diagram, API reference, Postman collection
```

---

## Documentation

All the written documents are in the **`docs/`** folder of this repository.

### API documentation
There are three ways to read the API documentation:

1. **Swagger (interactive)** at <http://localhost:5001/api-docs>, while the app is running.
   - Lists every endpoint with its request body, parameters and possible responses.
   - Lets you call each API from the browser (see step 4 above to sign in).
   - The raw OpenAPI file is at <http://localhost:5001/api-docs.json>.
2. **API reference (written)** in [`docs/api-reference.md`](docs/api-reference.md).
   - Every endpoint grouped by module, with which role can use it.
   - Also covers the request/response format, error codes, pagination/search/sort and a full example flow.
   - Readable on GitHub without running anything.
3. **Postman collection** in [`docs/TestDesk.postman_collection.json`](docs/TestDesk.postman_collection.json).
   - Import it into Postman and run the folders in order (1 → 10).
   - Logins save their tokens, and new records save their ids for the next requests automatically.

### ER diagram
- **File:** [`docs/er-diagram.md`](docs/er-diagram.md)
- **What it shows:** all 10 tables (Users, Roles, Courses, Exams, Questions, Options, Student Attempts, Results, Leaderboard, Audit Logs) with their fields and the links between them.
- **How to view it:** it's written in Mermaid, which **GitHub draws as a picture automatically**, so just open the file on GitHub. Outside GitHub, copy the code block into <https://mermaid.live> to see or download it as an image.

### Database schema
- **File:** [`docs/database-schema.md`](docs/database-schema.md)
- **What it has:** one table per collection, listing every field, its type and what it is for, plus the indexes and unique rules.
- **Where it lives in code:** the matching MongoDB models are in `src/data/`.

### Tests
- **Run with:** `npm test` (needs Node.js; no database needed).
- **What they check:** 44 unit tests for marking, random papers, the timer, validation, login/session checks and error responses.

### Running without Docker (optional)
You need Node.js 18+ and MongoDB.
1. Run `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Run `npm run dev`.
4. Open <http://localhost:5001/api-docs>.
