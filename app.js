// Base de questions tirée directement du PDF fourni
const questionsBase = [
  {
    id: 1,
    type: "vrai_faux",
    question: "Il est autorisé de manœuvrer un barrage de gaz où l'indication 'Réseau' apparaît.",
    reponseCorrecte: false,
    explication: "Il est strictement interdit de manœuvrer un barrage où la mention 'réseau' apparaît."
  },
  {
    id: 2,
    type: "ordonnance",
    question: "Remettez dans l'ordre chronologique les 4 premières étapes de la MGO :",
    items: ["1. Les reconnaissances", "2. Les sauvetages", "3. Les établissements", "4. La ventilation"],
    // On mélange l'ordre initial pour l'exercice
    itemsShuffled: ["3. Les établissements", "1. Les reconnaissances", "4. La ventilation", "2. Les sauvetages"],
    ordreCorrect: ["1. Les reconnaissances", "2. Les sauvetages", "3. Les établissements", "4. La ventilation"]
  },
  {
    id: 3,
    type: "methode",
    question: "Comment opérer sur un feu en espace clos ou semi-clos ?",
    conseilIA: "💡 **Méthode suggérée** : Indique les positions de sécurité, le cheminement, les contrôles thermiques et le réglage de la lance.",
    reponseAttendue: "Se placer en position basse côté ouvrant, prévoir un chemin de repli, estimer la chaleur (portes/poignées), chercher les signes thermiques, rendre compte au chef d'agrès, régler la lance en jet diffusé d'attaque (500 L/min) et ouvrir prudemment."
  }
];

let currentQuestion = null;

// Lancer une session aléatoire
function startSession() {
  const randomIndex = Math.floor(Math.random() * questionsBase.length);
  currentQuestion = questionsBase[randomIndex];
  
  // Masquer l'accueil
  hideAllScreens();

  // Rediriger vers l'écran spécifique selon le TYPE
  if (currentQuestion.type === "vrai_faux") {
    document.getElementById("vf-question").innerText = currentQuestion.question;
    document.getElementById("screen-vf").classList.remove("hidden");
  } 
  else if (currentQuestion.type === "ordonnance") {
    document.getElementById("order-question").innerText = currentQuestion.question;
    renderOrderList(currentQuestion.itemsShuffled);
    document.getElementById("screen-order").classList.remove("hidden");
  } 
  else if (currentQuestion.type === "methode") {
    document.getElementById("method-question").innerText = currentQuestion.question;
    document.getElementById("method-hint").innerHTML = currentQuestion.conseilIA;
    document.getElementById("method-input").value = "";
    document.getElementById("screen-method").classList.remove("hidden");
  }
}

// Gestion des écrans
function hideAllScreens() {
  document.getElementById("screen-start").classList.add("hidden");
  document.getElementById("screen-vf").classList.add("hidden");
  document.getElementById("screen-order").classList.add("hidden");
  document.getElementById("screen-method").classList.add("hidden");
  document.getElementById("screen-result").classList.add("hidden");
}

// 1. Soumission Vrai/Faux
function submitVF(userChoice) {
  const isCorrect = userChoice === currentQuestion.reponseCorrecte;
  showResult(
    isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse",
    `Réponse attendue : ${currentQuestion.reponseCorrecte ? 'VRAI' : 'FAUX'}`,
    currentQuestion.explication
  );
}

// 2. Soumission Ordonnance
function renderOrderList(items) {
  const listEl = document.getElementById("order-list");
  listEl.innerHTML = "";
  items.forEach((item, index) => {
    const li = document.createElement("li");
    li.innerText = item;
    li.innerHTML += `
      <div>
        <button onclick="moveItem(${index}, -1)">▲</button>
        <button onclick="moveItem(${index}, 1)">▼</button>
      </div>
    `;
    listEl.appendChild(li);
  });
}

function moveItem(index, direction) {
  const items = currentQuestion.itemsShuffled;
  const newIndex = index + direction;
  if (newIndex >= 0 && newIndex < items.length) {
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    renderOrderList(items);
  }
}

function submitOrder() {
  const isCorrect = JSON.stringify(currentQuestion.itemsShuffled) === JSON.stringify(currentQuestion.ordreCorrect);
  showResult(
    isCorrect ? "✅ Séquence parfaite !" : "⚠️ L'ordre n'est pas tout à fait correct",
    "Ordre correct : " + currentQuestion.ordreCorrect.join(" ➔ "),
    "Mémorisez bien la séquence officielle."
  );
}

// 3. Soumission Rédaction (Simulation d'analyse IA)
function submitMethod() {
  const userText = document.getElementById("method-input").value;
  if (!userText.trim()) {
    alert("Veuillez saisir une réponse.");
    return;
  }
  
  showResult(
    "📝 Réponse enregistrée & Analysée par l'IA",
    currentQuestion.reponseAttendue,
    "Analyse de l'IA : Assurez-vous d'avoir mentionné la position basse, le débit de 500 l/min et le compte rendu immédiat."
  );
}

// Affichage du résultat
function showResult(statusHtml, expectedText, explanationText) {
  hideAllScreens();
  document.getElementById("result-status").innerHTML = `<h3>${statusHtml}</h3>`;
  document.getElementById("result-expected").innerText = expectedText;
  document.getElementById("result-explanation").innerText = explanationText;
  document.getElementById("screen-result").classList.remove("hidden");
}

function nextQuestion() {
  startSession();
}
