let questionsBase = [];
let currentQuestion = null;

// Charger les questions depuis le fichier questions.json
fetch('questions.json')
  .then(response => response.json())
  .then(data => {
    questionsBase = data;
  })
  .catch(error => console.error('Erreur de chargement du JSON :', error));

// Lancer une session aléatoire
function startSession() {
  if (questionsBase.length === 0) {
    alert("Les questions sont en cours de chargement ou le fichier questions.json est vide.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * questionsBase.length);
  currentQuestion = questionsBase[randomIndex];
  
  hideAllScreens();

  // Redirection selon le TYPE de question
  if (currentQuestion.type === "vrai_faux") {
    document.getElementById("vf-question").innerText = currentQuestion.question;
    document.getElementById("screen-vf").classList.remove("hidden");
  } 
  else if (currentQuestion.type === "ordonnance") {
    document.getElementById("order-question").innerText = currentQuestion.question;
    // On melange les elements pour le jeu
    currentQuestion.itemsShuffled = [...currentQuestion.elements_a_ordonner].sort(() => Math.random() - 0.5);
    renderOrderList(currentQuestion.itemsShuffled);
    document.getElementById("screen-order").classList.remove("hidden");
  } 
  else if (currentQuestion.type === "methode") {
    document.getElementById("method-question").innerText = currentQuestion.question;
    document.getElementById("method-hint").innerHTML = currentQuestion.methode_suggestion || "💡 Lisez attentivement la question.";
    document.getElementById("method-input").value = "";
    document.getElementById("screen-method").classList.remove("hidden");
  }
}

function hideAllScreens() {
  document.getElementById("screen-start").classList.add("hidden");
  document.getElementById("screen-vf").classList.add("hidden");
  document.getElementById("screen-order").classList.add("hidden");
  document.getElementById("screen-method").classList.add("hidden");
  document.getElementById("screen-result").classList.add("hidden");
}

// 1. Soumission Vrai/Faux
function submitVF(userChoice) {
  const isCorrect = userChoice === currentQuestion.reponse_correcte;
  showResult(
    isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse",
    `Réponse attendue : ${currentQuestion.reponse_correcte ? 'VRAI' : 'FAUX'}`,
    currentQuestion.explication || ""
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
  const isCorrect = JSON.stringify(currentQuestion.itemsShuffled) === JSON.stringify(currentQuestion.elements_a_ordonner);
  showResult(
    isCorrect ? "✅ Séquence parfaite !" : "⚠️ L'ordre n'est pas tout à fait correct",
    "Ordre correct : " + currentQuestion.elements_a_ordonner.join(" ➔ "),
    "Mémorisez bien la séquence officielle."
  );
}

// 3. Soumission Rédaction
function submitMethod() {
  const userText = document.getElementById("method-input").value;
  if (!userText.trim()) {
    alert("Veuillez saisir une réponse.");
    return;
  }
  
  showResult(
    "📝 Réponse enregistrée & Analysée par l'IA",
    currentQuestion.reponse_attendue,
    currentQuestion.explication_ia || "Comparez votre réponse avec la correction officielle ci-dessus."
  );
}

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
