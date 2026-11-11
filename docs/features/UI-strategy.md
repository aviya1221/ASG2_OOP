# User interface: approach and decisions

What the team agreed about the look and the screens of the product, before writing the design documents.
Agreed on 2026-11-09 and updated on 2026-11-11 after a walk-through of the working product. This note feeds the SRS, the SDD and the tools report.

## 1. The idea

All the screens share one calm look: black bands for titles and navigation, and a light area for reading. The product is in Hebrew, from right to left, and teachers and students use it on a phone.

## 2. What we agreed

### The look

1. **Style.** Near-black and light-gray areas, a few muted colors, rounded corners and large bold headings. Buttons are soft and rounded, with no black frame.
2. **No faces.** No smiley or face drawings anywhere in the product.
3. **Top bar.** One black bar runs across the full width of every screen. On one side it has a back arrow and the product name, which leads to the first screen. On the other side it shows the name and role of the signed-in user, and sign-out. Below it, each page has its own band with its title spread across the width. On a lesson page the band holds the course name, the lecture and the three tabs, and the open tab takes the color of the content below it.
4. **Content.** Content sits on light gray.
5. **Main action.** The main action of a screen is a filled black button.
6. **Attendance results.** Each result has a color and always shows its word: present is green, review is yellow, not found is orange, conflict is pink and no response is blue.

### The screens

7. **Entry.** One sign-in for everyone, and then a first screen by role.
8. **Admin.** Works on a computer, on one screen with the weekly timetable and a form for a new course.
9. **Teacher and student.** Work on a phone. The first screen is a weekly timetable of their lessons. Above it, a card leads in one tap to the lesson happening now, or to the next one. On a computer the whole week shows, Sunday to Friday. On a phone one day shows at a time, under a strip of the days, and it opens on today. Face registration and sign-out sit in the top bar.
10. **Lesson page.** One page with three tabs: attendance, forum and homework.
11. **Attendance, teacher.** A large button to photograph the class. After the photos, the same place shows the time left to collect responses, and below it the count per result, the row-and-seat requests and the attendance sheet with a download button.
12. **Attendance, student.** The student's result. A student who is not marked present picks their row and seat on a map of the hall and sends a request.
13. **Forum.** Messages and replies, polls, forms and the button to the lesson summary. A list of all the lectures is one button away.
14. **Expanded conversation.** An expand button opens the lesson conversation in a large window. On a phone the window fills the screen, the user can write in it, and a poll appears in it as one line.
15. **Homework.** The homework with a button to check a solution before submitting, the student's own report and the class chart with its filter.

### Building it

16. **Client tool.** React with Vite, written in TypeScript like the server.

### Added after the walk-through (2026-11-11)

17. **Icons.** Common actions show a thin-line icon instead of a word: expand (two arrows), close, delete (a bin), reply, edit, back and sign-out. Main actions, such as sending or publishing, show an icon and a short word. Every icon keeps its word as a hint and for screen readers, and no icon shows a face.
18. **Long actions keep running.** Publishing a homework, checking a solution, uploading a recording, processing the class photos and registering a face go on when the user moves to another page of the product. A small sign in the top bar shows that something is running, and a short message says when it has ended. Closing or reloading the page during an upload asks the user first, because only that stops it.
