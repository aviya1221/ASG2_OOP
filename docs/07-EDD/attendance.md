# EDD-Attendance: Attendance

- Component: SDD §2.3 Face tools, §2.4 Attendance, §2.9 Notifications
- Requirements: REQ-07 to REQ-19, NFR-03, NFR-04, NFR-09, NFR-10
- Use cases: UC-01, UC-06

## 1. Module and class design

`FaceEngine`, `FaceStore`, `AttendanceResponder` and `AttendanceSheet` run in the browser, and the rest on our server.

```mermaid
classDiagram
    class FaceEngine {
        +load() void
        +findFaces(photo) FoundFace
        +makePrint(photo, face) FacePrint
    }
    class FaceStore {
        +save(print, hash) void
        +load() StoredFace
    }
    class AttendanceResponder {
        +respondToOpenRounds() void
    }
    class AttendanceSheet {
        +load(lessonId) SheetRow
        +download(rows) void
    }
    class AttendanceRoutes {
        +registerFace(request) Response
        +startRound(request) Response
        +respond(request) Response
        +subscribe(request) Response
    }
    class AttendanceService {
        -threshold: number
        +registerFace(studentId, hash, optOut) string
        +startRound(lessonId, teacherId, photos) Round
        +respond(lessonId, studentId, print, hash) Result
    }
    class FaceMatcher {
        +best(print, faces) FaceMatch
    }
    class AttendanceRules {
        +decide(hashFits, score, threshold) Decision
    }
    class ClassFaceCache {
        -entries: Map
        +get(lessonId) ClassFace
        +put(lessonId, faces, expiresAt) void
    }
    class AttendanceRepository {
        +saveRound(lessonId, photos, expiresAt) Round
        +findRound(lessonId) Round
        +loadFaces(lessonId) ClassFace
        +findHash(studentId) string
        +saveHash(studentId, hash, optOut) void
        +addReplacement(studentId, hash) void
        +findResult(lessonId, studentId) Result
        +saveResult(lessonId, studentId, result) void
        +recordMatch(lessonId, studentId, match) Result
    }
    class NotificationService {
        +subscribe(studentId, subscription) void
        +notifyCourse(lessonId) void
    }
    AttendanceResponder "1" --> "1" FaceStore
    AttendanceResponder ..> AttendanceRoutes : HTTPS
    AttendanceRoutes "1" --> "1" AttendanceService
    AttendanceRoutes "1" --> "1" NotificationService
    AttendanceService "1" --> "1" FaceMatcher
    AttendanceService "1" --> "1" AttendanceRules
    AttendanceService "1" --> "1" ClassFaceCache
    AttendanceService "1" --> "1" AttendanceRepository
    AttendanceService "1" --> "1" NotificationService
```

## 2. Algorithms and data structures

**Face-print, in the browser.** YuNet finds the faces at confidence 0.5, in a photo of up to 12 MP, and SFace turns each aligned face into 128 numbers. The photo never leaves the phone.

**Hash.** SHA-256 over the bytes of the face-print. The phone calculates it at registration, and the server on every response.

**Result (REQ-13).** The server takes the highest cosine similarity against every face of the round, and then:

1. If the hash does not fit, the result is `review`, with no comparison.
2. If the best score is below the threshold, the result is `not_found`.
3. Otherwise the database function `record_attendance_match` locks that face. If no other student matched it, the result is `present`. If one did, they all get `conflict`, even a student who already had `present`.
4. A student who sent nothing has no row, and the sheet shows `no_response` after the hour.

**The sheet.** The view `attendance_sheet` merges results with row-and-seat requests and sets the flag of REQ-17. A teacher's decision changes only the request.

**Deleting.** A student's face-print is overwritten right after the comparison (NFR-09). A database job runs every minute and deletes the class face-prints of finished rounds, and `ClassFaceCache` drops them at the same moment (NFR-10).

**Replacing a face (REQ-09).** A teacher approves the new hash from the page, and a database trigger applies it.

**Notifications.** After the round is saved, the server sends Web Push messages with the `web-push` library.

**The life of a round:**

```mermaid
stateDiagram-v2
    [*] --> Open: teacher sends the photos [during the lesson] / notify the course
    Open --> Closed: 1 hour passes / delete the class face-prints
    Closed --> [*]
```

## 3. Database schema and data formats

## 4. Sequence diagrams for key flows

The teacher photographs the class:

```mermaid
sequenceDiagram
    actor Teacher
    participant Engine as FaceEngine
    participant Routes as AttendanceRoutes
    participant Service as AttendanceService
    participant Repo as AttendanceRepository
    participant Notify as NotificationService
    Teacher->>+Engine: findFaces(photo) and makePrint(photo, face)
    Engine-->>-Teacher: faces and face-prints
    Teacher->>+Routes: POST /attendance/class
    Routes->>+Service: startRound(lessonId, teacherId, photos)
    Service->>+Repo: saveRound(lessonId, photos, expiresAt)
    Repo-->>-Service: round
    Service-)Notify: notifyCourse(lessonId)
    Service-->>-Routes: round
    Routes-->>-Teacher: 201, expiresAt
```

A student responds, with no further action:

```mermaid
sequenceDiagram
    actor Student
    participant Responder as AttendanceResponder
    participant Store as FaceStore
    participant Routes as AttendanceRoutes
    participant Service as AttendanceService
    participant Cache as ClassFaceCache
    participant Matcher as FaceMatcher
    participant Rules as AttendanceRules
    participant Repo as AttendanceRepository
    Student->>+Responder: opens the site
    Responder->>+Store: load()
    Store-->>-Responder: face-print and hash
    Responder->>+Routes: POST /attendance/response
    Routes->>+Service: respond(lessonId, studentId, print, hash)
    Service->>+Repo: findHash(studentId)
    Repo-->>-Service: saved hash
    Service->>+Cache: get(lessonId)
    Cache-->>-Service: class faces
    Service->>+Matcher: best(print, faces)
    Matcher-->>-Service: match
    Service->>+Rules: decide(hashFits, score, threshold)
    Rules-->>-Service: matched
    Service->>+Repo: recordMatch(lessonId, studentId, match)
    Repo-->>-Service: present or conflict
    Note over Service: overwrites the face-print with zeros
    Service-->>-Routes: result
    Routes-->>-Responder: 200, result
    Responder-->>-Student: shows the result
```

The teacher downloads the sheet, which is written in the browser:

```mermaid
sequenceDiagram
    actor Teacher
    participant Sheet as AttendanceSheet
    participant View as attendance_sheet view
    participant Excel as write-excel-file
    Teacher->>+Sheet: presses download
    Sheet->>+View: reads the rows of the lesson
    View-->>-Sheet: one row per student
    Sheet->>+Excel: writes the rows, every cell as text
    Excel-->>-Sheet: file
    Sheet-->>-Teacher: saves the file
```

## 5. Error handling and edge cases

## 6. Configuration and performance budget

## 7. Alternatives considered and trade-offs

## 8. Testing and rollout plan
