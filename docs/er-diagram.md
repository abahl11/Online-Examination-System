# ER Diagram

GitHub draws the Mermaid diagram below automatically. You can also paste it into <https://mermaid.live> to view or export it.

```mermaid
erDiagram
    ROLES ||--o{ USERS : "assigned to"
    USERS }o--o{ COURSES : "teaches (instructors[])"
    COURSES ||--o{ QUESTIONS : "question bank"
    USERS ||--o{ QUESTIONS : "authors"
    QUESTIONS ||--o{ OPTIONS : "has (MCQ)"
    COURSES ||--o{ EXAMS : "contains"
    EXAMS }o--o{ QUESTIONS : "pool (questions[])"
    USERS ||--o{ STUDENT_ATTEMPTS : "takes"
    EXAMS ||--o{ STUDENT_ATTEMPTS : "attempted in"
    STUDENT_ATTEMPTS ||--|| RESULTS : "produces"
    EXAMS ||--o{ RESULTS : "scored for"
    USERS ||--o{ RESULTS : "earns"
    EXAMS ||--o{ LEADERBOARD : "ranks"
    USERS ||--o{ LEADERBOARD : "best score of"
    RESULTS ||--o| LEADERBOARD : "bestResult"
    USERS ||--o{ AUDIT_LOGS : "performs"

    ROLES {
        ObjectId _id PK
        string name UK "admin | instructor | student"
        string label
        string description
    }
    USERS {
        ObjectId _id PK
        string fullName
        string email UK
        string passwordHash
        ObjectId role FK
        boolean isActive
        string sessionId "single active session"
        date lastLoginAt
    }
    COURSES {
        ObjectId _id PK
        string title
        string code UK
        string description
        ObjectId[] instructors FK
        ObjectId createdBy FK
    }
    QUESTIONS {
        ObjectId _id PK
        ObjectId course FK
        ObjectId author FK
        string kind "mcq | coding"
        string prompt
        number marks
        string language "coding only"
    }
    OPTIONS {
        ObjectId _id PK
        ObjectId question FK
        string text
        boolean isCorrect
        number position
    }
    EXAMS {
        ObjectId _id PK
        ObjectId course FK
        ObjectId createdBy FK
        ObjectId[] questions FK "pool"
        number questionsPerAttempt
        number durationMinutes
        number negativeMark
        number maxAttempts
        string status "draft | published | closed"
        boolean resultsPublished
    }
    STUDENT_ATTEMPTS {
        ObjectId _id PK
        ObjectId exam FK
        ObjectId student FK
        number attemptNumber
        array paper "randomly drawn questions"
        array answers
        date startedAt
        date deadline
        date submittedAt
        string status "in_progress | submitted | auto_submitted"
    }
    RESULTS {
        ObjectId _id PK
        ObjectId attempt FK, UK
        ObjectId exam FK
        ObjectId student FK
        number totalScore
        number maxScore
        number percentage
        string reviewStatus "auto | pending | reviewed"
        array lines "per-question marks"
    }
    LEADERBOARD {
        ObjectId _id PK
        ObjectId exam FK
        ObjectId student FK
        ObjectId bestResult FK
        number bestScore
        number bestPercentage
        number timeTakenSeconds
        number attemptsUsed
    }
    AUDIT_LOGS {
        ObjectId _id PK
        ObjectId actor FK
        string actorRole
        string action
        string entity
        ObjectId entityId
        mixed details
        string ip
        date createdAt
    }
```

## Reading the diagram

- An **instructor** is linked to courses through `courses.instructors`. They can only manage questions and exams of those courses.
- An **exam** holds a *pool* of questions. Each **attempt** draws `questionsPerAttempt` of them at random and stores that paper, so a reload shows the same paper.
- Each finished attempt has exactly **one result**. The **leaderboard** keeps one row per (exam, student), pointing at that student's best result.
