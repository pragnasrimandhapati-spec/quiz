import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, getDocs, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// 1) Replace these values with your Firebase Web App configuration.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// 2) For your college demo, change this code. For production, use Firebase Admin SDK/custom claims instead.
const ADMIN_REGISTRATION_CODE = "QUIZNOVA-ADMIN";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const $ = id => document.getElementById(id);
let currentUser = null, currentProfile = null, quizzes = [];
let activeQuiz = null, currentQuestion = 0, answers = {}, timerInterval = null, secondsLeft = 0;

const authView=$('authView'), dashboardView=$('dashboardView'), dashboardContent=$('dashboardContent');
const quizModal = new bootstrap.Modal($('quizModal')); const attemptModal = new bootstrap.Modal($('attemptModal')); const resultModal = new bootstrap.Modal($('resultModal'));

function toast(message,type='info'){const el=document.createElement('div');el.className='toast align-items-center text-bg-'+(type==='error'?'danger':type)+' border-0';el.setAttribute('role','alert');el.innerHTML=`<div class="d-flex"><div class="toast-body">${message}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;$('toastContainer').appendChild(el);new bootstrap.Toast(el,{delay:3200}).show()}
function esc(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function sessionSave(){sessionStorage.setItem('quizSession',JSON.stringify({uid:currentUser?.uid,name:currentProfile?.name||'',role:currentProfile?.role||'student',email:currentUser?.email||''}))}
function clearSession(){sessionStorage.removeItem('quizSession');sessionStorage.removeItem('activeQuizState')}

$('regRole').addEventListener('change',e=>$('adminCodeWrap').classList.toggle('d-none',e.target.value!=='admin'));
document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-auth-tab]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const reg=btn.dataset.authTab==='register';$('loginForm').classList.toggle('d-none',reg);$('registerForm').classList.toggle('d-none',!reg)}));

$('registerForm').addEventListener('submit',async e=>{e.preventDefault();try{const role=$('regRole').value;if(role==='admin' && $('adminCode').value!==ADMIN_REGISTRATION_CODE) throw new Error('Invalid admin registration code.');const cred=await createUserWithEmailAndPassword(auth,$('regEmail').value,$('regPassword').value);await setDoc(doc(db,'users',cred.user.uid),{name:$('regName').value.trim(),email:$('regEmail').value.trim(),role,createdAt:serverTimestamp()});toast('Account created successfully','success');}catch(err){toast(err.message,'error')}});
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$('loginEmail').value,$('loginPassword').value)}catch(err){toast(err.message,'error')}});
$('logoutBtn').addEventListener('click',async()=>{clearSession();await signOut(auth)});$('refreshBtn').addEventListener('click',loadDashboard);

onAuthStateChanged(auth,async user=>{if(user){currentUser=user;const snap=await getDoc(doc(db,'users',user.uid));if(!snap.exists()){toast('Profile not found. Please register again.','error');await signOut(auth);return}currentProfile=snap.data();sessionSave();authView.classList.add('d-none');dashboardView.classList.remove('d-none');$('logoutBtn').classList.remove('d-none');$('navUser').textContent=`${currentProfile.name} · ${currentProfile.role}`;await loadDashboard()}else{currentUser=null;currentProfile=null;authView.classList.remove('d-none');dashboardView.classList.add('d-none');$('logoutBtn').classList.add('d-none');$('navUser').textContent=''}});

async function loadDashboard(){if(!currentProfile)return;$('welcomeTitle').textContent=`Hello, ${currentProfile.name.split(' ')[0]} 👋`;$('roleBadge').textContent=currentProfile.role==='admin'?'Admin Dashboard':'Student Dashboard';if(currentProfile.role==='admin')await renderAdmin();else await renderStudent()}

async function getAllQuizzes(){const snap=await getDocs(query(collection(db,'quizzes'),orderBy('createdAt','desc')));return snap.docs.map(d=>({id:d.id,...d.data()}))}

async function renderAdmin(){quizzes=await getAllQuizzes();const resultsSnap=await getDocs(collection(db,'results'));dashboardContent.innerHTML=`<div class="row g-3 mb-4"><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Total quizzes</div><div class="stat-number">${quizzes.length}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Attempts</div><div class="stat-number">${resultsSnap.size}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Account</div><div class="stat-number fs-3">ADMIN</div></div></div></div><div class="d-flex justify-content-between align-items-center mb-3"><h4 class="mb-0">Manage Quizzes</h4><button id="newQuizBtn" class="btn btn-primary btn-glow"><i class="bi bi-plus-lg"></i> Create Quiz</button></div><div class="row g-4" id="quizGrid"></div>`;$('newQuizBtn').onclick=()=>openQuizEditor();renderQuizCards(true)}

function renderQuizCards(admin=false){const grid=$('quizGrid');if(!quizzes.length){grid.innerHTML='<div class="col-12"><div class="empty-state"><i class="bi bi-journal-x fs-1"></i><p class="mt-3">No quizzes yet. Create your first quiz.</p></div></div>';return}grid.innerHTML=quizzes.map(q=>`<div class="col-md-6 col-xl-4 fade-up"><div class="quiz-card h-100"><div class="d-flex justify-content-between"><span class="badge-soft">${q.questions?.length||0} Questions</span><span class="meta">${q.duration||10} min</span></div><h5 class="mt-3">${esc(q.title)}</h5><p class="meta">${esc(q.description||'No description')}</p><div class="mt-4 d-flex gap-2">${admin?`<button class="btn btn-outline-light btn-sm" onclick="editQuiz('${q.id}')"><i class="bi bi-pencil"></i> Edit</button><button class="btn btn-outline-danger btn-sm" onclick="removeQuiz('${q.id}')"><i class="bi bi-trash"></i></button>`:`<button class="btn btn-primary btn-sm flex-grow-1 btn-glow" onclick="startQuiz('${q.id}')">Start Quiz <i class="bi bi-arrow-right"></i></button>`}</div></div></div>`).join('')}

async function renderStudent(){quizzes=await getAllQuizzes();const resultSnap=await getDocs(query(collection(db,'results'),where('studentId','==',currentUser.uid)));const avg=resultSnap.size?Math.round([...resultSnap.docs].reduce((a,d)=>a+(d.data().percentage||0),0)/resultSnap.size):0;dashboardContent.innerHTML=`<div class="row g-3 mb-4"><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Available quizzes</div><div class="stat-number">${quizzes.length}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Attempts</div><div class="stat-number">${resultSnap.size}</div></div></div><div class="col-md-4"><div class="stat-card"><div class="text-secondary">Average score</div><div class="stat-number">${avg}%</div></div></div></div><h4 class="mb-3">Available Quizzes</h4><div class="row g-4" id="quizGrid"></div>`;renderQuizCards(false)}

function blankQuestion(i){return `<div class="question-editor" data-q="${i}"><div class="d-flex justify-content-between mb-2"><strong>Question ${i+1}</strong><button type="button" class="btn btn-sm btn-outline-danger remove-q">Remove</button></div><input class="form-control q-text mb-2" placeholder="Enter question" required><div class="row g-2">${[0,1,2,3].map(n=>`<div class="col-md-6"><input class="form-control q-option" placeholder="Option ${String.fromCharCode(65+n)}" required></div>`).join('')}</div><div class="mt-2"><label>Correct option</label><select class="form-select q-correct"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div></div>`}
function addQuestion(data=null){const c=$('questionsContainer');const i=c.children.length;c.insertAdjacentHTML('beforeend',blankQuestion(i));const el=c.lastElementChild;if(data){el.querySelector('.q-text').value=data.text||'';el.querySelectorAll('.q-option').forEach((x,n)=>x.value=data.options?.[n]||'');el.querySelector('.q-correct').value=data.correctIndex??0)}el.querySelector('.remove-q').onclick=()=>{el.remove();[...c.children].forEach((x,n)=>x.querySelector('strong').textContent=`Question ${n+1}`)} }
$('addQuestionBtn').onclick=()=>addQuestion();
function openQuizEditor(quiz=null){$('quizModalTitle').textContent=quiz?'Edit Quiz':'Create Quiz';$('quizId').value=quiz?.id||'';$('quizTitle').value=quiz?.title||'';$('quizDuration').value=quiz?.duration||10;$('quizDescription').value=quiz?.description||'';$('questionsContainer').innerHTML='';(quiz?.questions?.length?quiz.questions:[{}]).forEach(q=>addQuestion(q));quizModal.show()}
window.openQuizEditor=openQuizEditor;
window.editQuiz=async id=>{const q=quizzes.find(x=>x.id===id);openQuizEditor(q)};
window.removeQuiz=async id=>{if(!confirm('Delete this quiz?'))return;try{await deleteDoc(doc(db,'quizzes',id));toast('Quiz deleted','success');loadDashboard()}catch(e){toast(e.message,'error')}};
$('quizForm').addEventListener('submit',async e=>{e.preventDefault();const questions=[...$('questionsContainer').children].map(el=>({text:el.querySelector('.q-text').value.trim(),options:[...el.querySelectorAll('.q-option')].map(x=>x.value.trim()),correctIndex:Number(el.querySelector('.q-correct').value)}));const data={title:$('quizTitle').value.trim(),description:$('quizDescription').value.trim(),duration:Number($('quizDuration').value),questions,createdBy:currentUser.uid,updatedAt:serverTimestamp()};try{const id=$('quizId').value;if(id)await updateDoc(doc(db,'quizzes',id),data);else await addDoc(collection(db,'quizzes'),{...data,createdAt:serverTimestamp()});quizModal.hide();toast('Quiz saved successfully','success');loadDashboard()}catch(err){toast(err.message,'error')}});

window.startQuiz=async id=>{activeQuiz=quizzes.find(q=>q.id===id);if(!activeQuiz||!activeQuiz.questions?.length)return toast('This quiz has no questions','error');currentQuestion=0;answers={};secondsLeft=(activeQuiz.duration||10)*60;sessionStorage.setItem('activeQuizState',JSON.stringify({quizId:id,answers,currentQuestion,secondsLeft}));$('attemptTitle').textContent=activeQuiz.title;renderQuestion();attemptModal.show();startTimer()};
function startTimer(){clearInterval(timerInterval);timerInterval=setInterval(()=>{secondsLeft--;updateTimer();if(secondsLeft<=0){clearInterval(timerInterval);submitAttempt()}},1000);updateTimer()}
function updateTimer(){$('timer').textContent=`${String(Math.floor(secondsLeft/60)).padStart(2,'0')}:${String(secondsLeft%60).padStart(2,'0')}`;if(secondsLeft<=30)$('timer').parentElement.classList.add('pulse')}
function saveAttemptState(){sessionStorage.setItem('activeQuizState',JSON.stringify({quizId:activeQuiz.id,answers,currentQuestion,secondsLeft}))}
function renderQuestion(){const q=activeQuiz.questions[currentQuestion];$('progressText').textContent=`Question ${currentQuestion+1} of ${activeQuiz.questions.length}`;$('quizProgress').style.width=((currentQuestion+1)/activeQuiz.questions.length*100)+'%';$('questionArea').innerHTML=`<div class="question-box fade-up"><h4 class="mb-4">${esc(q.text)}</h4>${q.options.map((o,i)=>`<label class="option-label"><input type="radio" name="answer" value="${i}" ${answers[currentQuestion]===i?'checked':''}> ${String.fromCharCode(65+i)}. ${esc(o)}</label>`).join('')}</div>`;document.querySelectorAll('input[name=answer]').forEach(r=>r.onchange=()=>{answers[currentQuestion]=Number(r.value);saveAttemptState()});$('prevQuestion').disabled=currentQuestion===0;const last=currentQuestion===activeQuiz.questions.length-1;$('nextQuestion').classList.toggle('d-none',last);$('submitQuiz').classList.toggle('d-none',!last)}
$('prevQuestion').onclick=()=>{if(currentQuestion>0){currentQuestion--;saveAttemptState();renderQuestion()}};$('nextQuestion').onclick=()=>{if(currentQuestion<activeQuiz.questions.length-1){currentQuestion++;saveAttemptState();renderQuestion()}};$('submitQuiz').onclick=()=>submitAttempt();
async function submitAttempt(){clearInterval(timerInterval);let score=0;activeQuiz.questions.forEach((q,i)=>{if(answers[i]===q.correctIndex)score++});const total=activeQuiz.questions.length,percentage=Math.round(score/total*100);try{await addDoc(collection(db,'results'),{quizId:activeQuiz.id,quizTitle:activeQuiz.title,studentId:currentUser.uid,studentName:currentProfile.name,score,total,percentage,submittedAt:serverTimestamp()});sessionStorage.removeItem('activeQuizState');attemptModal.hide();$('scoreValue').textContent=score;$('scoreValue').nextElementSibling.textContent=`/ ${total}`;$('resultTitle').textContent=percentage>=80?'Excellent work!':percentage>=50?'Good attempt!':'Keep practicing!';$('resultMessage').textContent=`You scored ${percentage}%.`;resultModal.show();loadDashboard()}catch(e){toast(e.message,'error')}}

// Optional: restore a student's quiz after accidental refresh within the same browser tab/session.
window.addEventListener('load',()=>{const raw=sessionStorage.getItem('activeQuizState');if(raw)console.info('Saved quiz session detected:',JSON.parse(raw))});
