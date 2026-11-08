# Use cases

<!--
LECTURER GUIDELINES: USE CASES (lecture 02a, slides 3, 7, 8, 9, 10, 11, 22)
(Hidden on GitHub, visible when editing.)

"Use cases: requirements as user goals."
Answers: How do users interact with it?
Written by: analyst, UX designer. Read by: developers, testers, client.
When: with the SRS (use cases are an SRS appendix).
Cheat sheet: how each actor reaches a goal, including the errors.

Use-case template (slide 7):
1. Name and ID: verb phrase, e.g. "UC-03 Borrow a book"
2. Actor: who starts it (a person or another system)
3. Preconditions: what must be true before it starts
4. Main success flow: numbered steps, actor and system alternating
5. Alternative flows: branches and errors, numbered from the step they leave
6. Postconditions: what is guaranteed when it ends

Lecturer's example:
  UC-03 Borrow a book
  Actor: Member
  Precondition: Member is logged in and has no overdue loans
  Main flow:
    1. Member scans the book barcode
    2. System checks the book is available
    3. System records the loan, due in 14 days
    4. System shows a receipt
  Alternative: 2a. Book is reserved by another member: system offers to join
               the waiting list
  Postcondition: Book status is "on loan"

Use case vs user story (slide 8):
  Use case
    Unit: a complete user goal with all its flows
    Best for: complex interactions, many exceptions, contracts
    Lives in: the SRS or a use-case model
    Typical size: one to three pages
  User story
    Unit: one small slice of value
    Best for: agile backlogs and sprint planning
    Lives in: issue tracker such as Jira or GitHub Issues
    Typical size: one sentence plus acceptance criteria

  Example user story with acceptance criteria:
    As a member, I want to renew a loan online so that I avoid a late fee.
      Given a loan with no reservations on the book
      When I click Renew
      Then the due date moves 14 days later and I get a confirmation email

Use-case diagram (slide 10), "who does what":
  Stick figure: an actor (a role outside the system)
  Oval: a use case (one user goal)
  Box: the system boundary
  Solid line: the actor takes part
  <<include>>: always performed as part of
  <<extend>>: optional, under a condition

Activity diagram (slide 11): the same content as the use-case text, but gaps
and missing branches are easier to spot in a picture.
  Filled dot: start. Ringed dot: end. Rounded box: action.
  Diamond: decision. [guard]: condition for taking a flow.
Both diagrams go in the SRS / use cases (slide 9).

FOR OUR PROJECT
Each use case lists the requirements it covers (REQ-nn), so the SRS
traceability matrix can fill its "Use case" column.
-->

## 1. Actors

| Actor | Description |
|-------|-------------|
| Admin | Builds the timetable: courses, their teachers, weekly hours and students |
| Teacher | Runs the lessons of their courses |
| Student | Takes part in the lessons of their courses from a phone |
| Google Gemini | An outside AI service that writes the lesson summary and reviews homework |

## 2. Use-case diagram

## 3. Use cases

<!-- Template for each use case:
### UC-nn: <verb phrase>
- Actor:
- Preconditions:
- Main success flow:
  1. ...
- Alternative flows:
  - 2a. ...
- Postconditions:
- Covers: REQ-nn, REQ-nn
-->

### UC-01: Take attendance in a lesson

- Actor: Teacher. Students also take part.
- Preconditions: The teacher is on the lesson page, and every student of the course has registered a face or opted out.
- Main success flow:
  1. The teacher opens the attendance tab and takes 1 to 3 photos of the class.
  2. The teacher's phone finds the faces and sends the server only the face-prints and their positions, never the photo.
  3. The system notifies every student of the course.
  4. A student opens the app within 1 hour.
  5. The student's phone sends the student's face-print and hash, with no further action by the student.
  6. The system checks the hash, compares the face-print with those from the photo, deletes the student's face-print and records a result.
  7. The teacher's attendance sheet updates with each result.
  8. The teacher downloads the sheet.
- Alternative flows:
  - 4a. The student does not open the app within 1 hour: the result is No response.
  - 5a. The student opted out of face recognition: the student goes straight to a row-and-seat request (7a).
  - 6a. The face-print does not fit the hash: the result is Review, with no comparison.
  - 6b. The best score is below the match threshold: the result is Not found.
  - 6c. Two or more students matched the same face: the result is Conflict, and the case passes to the teacher for follow-up.
  - 7a. A student who is not marked present after the hour enters a row and seat, and the teacher approves or rejects the request. Every request is recorded, and a student with a rejected request or 3 or more requests in the course is flagged.
- Postconditions: Every student of the course has one attendance result, and the server has deleted the face-prints from the photo within 1 hour.
- Covers: REQ-10 to REQ-19, NFR-03, NFR-04, NFR-09, NFR-10

### UC-02: Post a message in the forum

- Actor: Anyone linked to the lesson.
- Preconditions: The user is on the forum tab of the lesson.
- Main success flow:
  1. The user chooses a forum from the list, by lecture number.
  2. The user writes a new message or a reply to a message.
  3. The system saves the message in the forum of that lesson.
  4. The message appears for everyone linked to the lesson without reloading the page.
- Alternative flows:
  - 2a. A student chooses to hide their name from the class: the class sees the message with no name, and the teacher sees who wrote it.
  - 3a. There is no network: the message is not sent, and the user can try again.
  - 4a. The teacher deletes a message: it disappears for everyone.
- Postconditions: The message is saved in the forum of the lesson and cannot be edited.
- Covers: REQ-20, REQ-21, REQ-23 to REQ-29, NFR-02

### UC-03: Publish a poll or form and answer it

- Actor: Teacher. Students also take part.
- Preconditions: The teacher is in the forum of the lesson. For a poll, the lesson is in progress.
- Main success flow:
  1. The teacher writes a question with at least 2 answer options and publishes a poll in the forum.
  2. The system shows the poll to every student of the lesson.
  3. A student chooses an answer.
  4. Everyone linked to the lesson sees a chart that updates without reloading the page, and the teacher also sees who gave each answer.
  5. The teacher closes the poll, and it stays in the forum.
- Alternative flows:
  - 1a. Form: the teacher builds a form of one or more questions of the four types, before or during the lesson, and publishes it in the forum. A student answers it in a window over the forum, and only the teacher sees the answers.
  - 3a. The student answers again: the answer is refused, unless the teacher allowed another answer when creating the poll or form, and then it replaces the earlier one.
  - 3b. The poll or form is closed: the answer is refused.
  - 5a. A poll that is still open at the end of the lesson closes automatically.
- Postconditions: The poll or form and its results stay in the forum of the lesson.
- Covers: REQ-30 to REQ-39, REQ-60 to REQ-69, NFR-02

### UC-04: Get a lesson summary

- Actor: Teacher. Google Gemini also takes part.
- Preconditions: The lesson has ended, and the teacher has a recording of it.
- Main success flow:
  1. The teacher uploads the recording.
  2. The system sends the full video to Google Gemini and receives a transcript with speaker labels and a list of what was on the board.
  3. The system writes the four parts of the summary, and corrects spelling mistakes and garbled copying against the transcript and the board list.
  4. The system deletes the recording and opens the summary page. If the teacher did not enter a topic, the forum title takes it from the summary.
  5. Everyone linked to the lesson opens the summary from the button in the forum.
- Alternative flows:
  - 2a. The file is too large or a usage limit is reached: the system sends the sound alone.
  - 2b. The service does not answer: the teacher gets a message and can upload again.
  - 4a. The teacher edits the text of the summary, or uploads a new recording that creates a new summary.
- Postconditions: The summary page is open, and the recording has been deleted.
- Covers: REQ-40 to REQ-49, NFR-05

### UC-05: Publish a homework and get feedback on it
### UC-06: Register a face
### UC-07: Build the timetable
### UC-08: Sign in and reach a lesson page

## 4. Activity diagrams

## 5. User stories

<!-- As a <role>, I want <goal> so that <benefit>.
       Given ...
       When ...
       Then ...
-->
