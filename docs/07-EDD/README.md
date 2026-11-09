# Detailed Design (EDD)

<!--
LECTURER GUIDELINES: EDD, ENGINEERING DESIGN DOCUMENT (lecture 02a, slides 3, 9, 13-17, 22)
(Hidden on GitHub, visible when editing.)

Assignment step 7: "Define low-level class diagrams and sequence diagrams."

"EDD: the engineering detail of one component."
Answers: How is this component built?
Written by: component engineer. Read by: implementers, reviewers.
When: before coding each part. Changes often, per feature.
Cheat sheet: how one part is built, and why this way.
Scope: ONE component or feature, so write one EDD file per main component
(copy _template.md).

What goes in an EDD (slide 13):
1. Module and class design
2. Algorithms and data structures
3. Database schema and data formats
4. Sequence diagrams for key flows
5. Error handling and edge cases
6. Configuration and performance budget
7. Alternatives considered and trade-offs
8. Testing and rollout plan

CLASS DIAGRAM (slide 14), notation:
  Box: name, attributes, operations
  + / - : public / private
  Italic name: abstract class
  Hollow triangle: inheritance ("is a")
  Filled diamond: composition (part of, same lifetime)
  1, 0..* : multiplicity of an association
Lecturer's example (loan domain):
  Person (- name: String, - email: String)
  Librarian is a Person (- staffId: String, + registerMember())
  Member is a Person (- memberId: String, - maxLoans: int = 5, + canBorrow(): bool)
  Book (- isbn: String, - title: String, + availableCopies(): int)
  Copy (- copyId: String, - status: CopyStatus, + isAvailable(): bool)
  Loan (- dueDate: Date, - returned: bool, + renew(), + isOverdue(): bool)
  Member 1 "borrows" 0..* Loan;  Loan 0..* "for" 1 Copy;  Book 1 has 1..* Copy

SEQUENCE DIAGRAM (slide 15), notation:
  Solid arrow, filled head: synchronous call
  Dashed arrow: return
  Narrow bar: activation (the object is busy)
  Dashed line: lifeline
Lecturer's example (creating a loan):
  :Client, :LoanController, :LoanService, :CopyRepository, :LoanRepository
  1: POST /loans (Client to LoanController)
  2: createLoan(m, c) (LoanController to LoanService)
  3: findById(copyId) (LoanService to CopyRepository), returns copy
  4: save(loan) (LoanService to LoanRepository), returns loanId
  loan is returned to the controller, which answers 201 Created
Sequence diagrams go in the EDD and the API docs (slide 9).

STATE MACHINE (slide 16): the states of one object and the events that
change them. Goes in the EDD and the STD (slide 9).
  Rounded box: state
  Arrow: transition labelled "event [guard] / action"
  Filled dot: initial state. Ringed dot: final state.
Lecturer's example (life of a book copy): Available, On loan, Overdue,
Reserved, Lost. borrow / return; due date passed; return / charge fine;
reserve / cancel; borrow [by reserving member]; after 60 days / bill member.

API DOCS (slide 17), "the contract for other developers":
  Answers: How do I call this interface? Written by developers, read by
  client developers, written with the code.
  1. Overview and authentication: base URL, versioning, how to get and send a token
  2. Endpoint reference: method, path, purpose, parameters and body
  3. Responses and errors: status codes with meaning and error format
  4. Examples: real request and response for each call
  5. Limits and changes: rate limits, pagination, changelog, deprecations
  Lecturer's example:
    POST /api/v1/loans   (Authorization: Bearer <token>)
    { "memberId": "M-1042", "bookId": "B-7781" }
    201 Created   { "loanId": "L-55120", "dueDate": "2026-10-30" }
    404 Not Found   unknown book
    409 Conflict    book already on loan
  Tools: OpenAPI / Swagger, Redoc, Postman collections.

CDR (lecture 03a, slide 7): the review package includes "an EDD for each
component", "interface specifications and API docs" and "database schema and
key algorithms".

FOR OUR PROJECT
Name each EDD (EDD-Attendance, EDD-Polls, ...) so the traceability matrix and
the STP/STD (step 8) can cite it. The STP plans unit tests per class from here.
Mermaid supports classDiagram, sequenceDiagram and stateDiagram-v2.
-->

## Domain model (class diagram)

<!-- The whole domain in one class diagram. Each EDD then zooms into its own classes. -->

```mermaid
classDiagram
    class User {
        -id: UUID
        -idNumber: String
        -name: String
        -role: Role
    }
    class Student
    class Teacher
    class Admin
    class Course {
        -number: String
        -name: String
        -weeklyHours: String
    }
    class Lesson {
        -lectureNumber: int
        -topic: String
        -startsAt: DateTime
        -endsAt: DateTime
        +hasEnded() bool
    }
    class FaceRegistration {
        -hash: String
        -optedOut: bool
    }
    class AttendanceRound {
        -expiresAt: DateTime
        +isOpen() bool
    }
    class ClassFace {
        -photoNo: int
        -faceNo: int
        -box: Box
        -print: FacePrint
    }
    class AttendanceResult {
        -result: ResultKind
        -score: float
    }
    class SeatRequest {
        -rowNo: int
        -seatNo: int
        -status: RequestStatus
    }
    class ForumMessage {
        -text: String
        -writerName: String
        -createdAt: DateTime
        -deletedAt: DateTime
    }
    class Survey {
        -kind: SurveyKind
        -status: SurveyStatus
        -allowChange: bool
        +isOpen() bool
    }
    class Question {
        -type: QuestionType
        -text: String
        -options: String
    }
    class Answer {
        -value: JSON
        -answeredAt: DateTime
    }
    class LessonSummary {
        -status: SummaryStatus
        -overview: String
        -topics: JSON
        -questions: JSON
        -board: JSON
    }
    class Homework {
        -title: String
        -fileUrl: String
    }
    class ReviewGuide {
        -sections: JSON
        -instructions: String
    }
    class HomeworkCheck {
        -checkNumber: int
        -sectionScores: JSON
        -overallScore: int
        -report: JSON
    }
    class PushSubscription {
        -endpoint: String
    }

    User <|-- Student
    User <|-- Teacher
    User <|-- Admin
    Teacher "1" --> "0..*" Course : teaches
    Student "0..*" -- "0..*" Course : enrolled in
    Course "1" *-- "1..*" Lesson
    Student "1" *-- "0..1" FaceRegistration
    Student "1" *-- "0..*" PushSubscription
    Lesson "1" *-- "0..1" AttendanceRound
    AttendanceRound "1" *-- "0..*" ClassFace
    Lesson "1" *-- "0..*" AttendanceResult
    Student "1" --> "0..*" AttendanceResult
    Lesson "1" *-- "0..*" SeatRequest
    Student "1" --> "0..*" SeatRequest
    Lesson "1" *-- "0..*" ForumMessage : forum
    ForumMessage "0..1" --> "0..*" ForumMessage : replies
    Lesson "1" *-- "0..*" Survey
    Survey "1" *-- "1..*" Question
    Survey "1" *-- "0..*" Answer
    Student "1" --> "0..*" Answer
    Lesson "1" *-- "0..1" LessonSummary
    Lesson "1" *-- "0..*" Homework
    Homework "1" *-- "1" ReviewGuide
    Homework "1" *-- "0..*" HomeworkCheck
    Student "1" --> "0..*" HomeworkCheck
```

## Component EDDs

| EDD | Component (SDD §) | File |
|-----|-------------------|------|
| EDD-Attendance | §2.3 Face tools, §2.4 Attendance, §2.9 Notifications | [attendance.md](attendance.md) |
| EDD-Forum | §2.5 Forum | [forum.md](forum.md) |
| EDD-Polls | §2.6 Polls and forms | [polls-and-forms.md](polls-and-forms.md) |
| EDD-LessonSummary | §2.7 Lesson summary | [lesson-summary.md](lesson-summary.md) |

<!-- To add one: copy _template.md to <component>.md and fill it in. -->

## API docs

<!-- Endpoints of the web app: overview and auth, endpoint reference, responses
and errors, examples, limits. Can move to its own file (api.md) when it grows. -->
