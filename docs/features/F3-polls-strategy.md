# F3 Polls: build strategy

What the team agreed about polls, and where the code comes from.
Agreed on 2026-11-06. This note feeds the SoW (polls deliverable), the polls requirements in the SRS (F3), the polls use case and the polls EDD.

## 1. The idea

A teacher, in the middle of a live lesson, asks a short question to check that the class understood the material. The students answer from their phones, and the teacher sees the answers come in live.

## 2. What we agreed

1. **Everything runs inside our app.** No room codes, no join step, and no outside poll site (Mentimeter, Slido and similar).
2. **The app has three roles.**
   - The admin builds the timetable: the course, its teacher, its weekly hours and its list of students.
   - The teacher runs the lessons.
   - The student attends them.
3. **A lesson has tabs**, one per feature: attendance, polls and assignments, with more to come. Polls is one of these tabs.
4. **The student is already linked to the lesson** through the timetable and their login, so the app knows which lesson they are in and who they are.
5. **The flow:**
   1. The teacher opens the lesson, goes to the polls tab, writes a question with a few answer options and opens the poll.
   2. Every student of that lesson sees the open poll in their own polls tab, marked as new, and taps an answer.
   3. The teacher sees a results chart that updates without reloading the page.
   4. The teacher closes the poll. The poll and its results are saved under the lesson, next to its attendance.
6. **One answer per student.** Each answer is saved under the student's ID, so a second answer replaces the first one instead of being counted twice.
7. **KISS:** one multiple-choice question per poll.
8. **Storage:** the answers live in the same database as the rest of the app, which the tools report (step 2) chooses. There is no separate poll service.

## 3. Where the code comes from

No ready-made poll system fits as is, because each one has its own users, login and rooms, and can't sit as a tab inside our lesson. So we copy **small pieces** into our app and write the lesson link ourselves.

### 3.1 What we reuse

Source: [PollPosition](https://github.com/siemsene/PollPosition), a small classroom polling app (React, Firebase, Recharts). License: **CC0 1.0** (public domain), so we can copy it without conditions.

| What we take | File in the source | How we use it |
|--------------|--------------------|---------------|
| Poll and answer data types | `src/types/poll.ts` | The starting point for our question and answer data (we drop the room fields) |
| Question editor | `src/components/QuestionEditor.tsx` | The screen where the teacher writes the question and its answers |
| Live results chart | `src/components/ResultsPanel.tsx` | The bar chart the teacher sees; it receives the answers as input, so it doesn't care where they come from |
| One-answer-per-student rule | `firestore.rules` (responses) | The answer is stored under the student's ID, and a student can write only their own answer |

What we leave out: room codes and the QR join, the public results page, AI summaries of open answers, the word cloud, and the teacher sign-up and approval flow (our admin handles users).

The chart library inside those components is [Recharts](https://github.com/recharts/recharts) (MIT).

### 3.2 What we write ourselves

- The link between a poll and a lesson in the timetable.
- The polls tab on the lesson page, for the teacher and for the student.
- The "new poll" mark on the student's tab.
- Saving the poll and its results under the lesson.

### 3.3 Alternatives we checked and rejected

| Option | License | Why not |
|--------|---------|---------|
| [Claper](https://github.com/ClaperCo/Claper) | AGPL-3.0 | A full system with its own users and rooms, written in Elixir; its license would force us to publish all our code under it |
| [ClassQuiz](https://github.com/mawoka-myblock/ClassQuiz) | MPL-2.0 | A Kahoot-style quiz game, not a quick poll; needs several servers |
| [Razzia](https://github.com/Ralex91/Razzia) (formerly Rahoot) | MIT | A quiz game with a join code |
| [livepoll](https://github.com/jutionck/livepoll) | MIT | A good fallback, but it asks the server for news every second instead of receiving updates. **Our plan B** if step 2 chooses a stack other than React with a live database |
| `react-polls`, `react-leaf-polls` (ready-made components) | MIT | Not maintained (last releases in 2018 and 2022) |

## 4. Still open

- **Tech stack (step 2).** PollPosition uses React and Firebase. If we choose them, we copy the pieces almost as they are. If we choose something else, we keep the ideas and use livepoll as the reference.
- **Spike.** Run PollPosition locally, answer a poll from three phones, and record the result in the tools report (section 3).
- **Reuse record.** When code is copied, add its source and license to the table in [app/README.md](../../app/README.md).
- **Questions for the team:**
  - Do students see the results after the poll closes?
  - Can a teacher prepare polls before the lesson?
