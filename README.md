# QuizNova - Quiz Management Application

A responsive dark-theme Quiz Management Application using HTML, CSS, Bootstrap, JavaScript and Firebase.

## Features
- Student registration/login
- Admin registration/login with admin code
- Firebase Email/Password Authentication
- Firestore quiz storage
- Admin create/edit/delete quizzes
- Students attend quizzes
- MCQ questions with four options
- Automatic scoring and result display
- Student statistics and admin attempt count
- Responsive Bootstrap UI
- Animated dark glassmorphism design
- `sessionStorage` for login/session metadata and current quiz state
- Countdown timer

## Firebase setup
1. Create a Firebase project at https://console.firebase.google.com/
2. Enable Authentication -> Sign-in method -> Email/Password.
3. Create a Firestore Database.
4. Add a Web App in Firebase Project Settings.
5. Copy the Firebase configuration into `app.js` and replace the `YOUR_*` values.
6. Apply the rules in `firebase-rules.txt` in Firestore Rules.
7. Change `ADMIN_REGISTRATION_CODE` in `app.js` for your college demo.
8. Run with a local server (VS Code Live Server is easiest). Do not open the HTML directly as a file.

## Important security note
The admin registration code is a frontend demo mechanism and is NOT a secure production authorization system. For a real deployment, create admins through a trusted backend/Firebase Admin SDK and use custom claims. Never put a real admin secret in browser JavaScript.
