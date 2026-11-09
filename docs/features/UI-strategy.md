# User interface: approach and decisions

What the team agreed about the look and the screens of the product, before writing the design documents.
Agreed on 2026-11-09. This note feeds the SRS, the SDD and the tools report.

## 1. The idea

All the screens share one calm look: black bands for titles and navigation, and a light area for reading. The product is in Hebrew, from right to left, and teachers and students use it on a phone.

## 2. What we agreed

### The look

1. **Style.** Near-black and light-gray areas, a few muted colors, square corners, thin frames and large bold headings.
2. **No faces.** No smiley or face drawings anywhere in the product.
3. **Lesson header.** Every lesson page has a black band on top with the course name, the lecture and the three tabs. The open tab takes the color of the content below it.
4. **Content.** Content sits on light gray.
5. **Main action.** The main action of a screen is a filled black button.
6. **Attendance results.** Each result has a color and always shows its word: present is green, review is yellow, not found is orange, conflict is pink and no response is blue.

### The screens

7. **Entry.** One sign-in for everyone, and then a first screen by role.
8. **Admin.** Works on a computer, on one screen with the weekly timetable and a form for a new course.
9. **Teacher and student.** Work on a phone. The first screen lists their lessons, with the current lesson on top. Its menu holds face registration and sign-out.
10. **Lesson page.** One page with three tabs: attendance, forum and homework.
11. **Attendance, teacher.** A large button to photograph the class. After the photos, the same place shows the time left to collect responses, and below it the count per result, the row-and-seat requests and the attendance sheet with a download button.
12. **Attendance, student.** The student's result. A student who is not marked present picks their row and seat on a map of the hall and sends a request.
13. **Forum.** Messages and replies, polls, forms and the button to the lesson summary. A list of all the lectures is one button away.
14. **Expanded conversation.** An expand button opens the lesson conversation in a large window. On a phone the window fills the screen, the user can write in it, and a poll appears in it as one line.
15. **Homework.** The homework with a button to check a solution before submitting, the student's own report and the class chart with its filter.

### Building it

16. **Client tool.** React with Vite, written in TypeScript like the server.
