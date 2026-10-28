let questionsBase = [];
let currentQuestion = null;

// Charger les questions depuis le fichier questions.json
fetch('questions.json')
  .then(response => response.json())
  .then(data => {
    questionsBase = data;
  })
  .catch(error => console.error('Erreur de chargement du JSON :', error));

// Gestion de la clé API dans le navigateur
function getApiKey() {
  let key = localStorage.getItem("groq_api_key");
  if (!key) {
    key = prompt("Pour activer l'analyse IA, entrez votre clé API Groq (gsk_...) :");
    if (key) {
      localStorage.setItem("groq_api_key", key.trim());
    }
  }
  return key;
}

// Lancer une session aléatoire
function startSession() {
  if (questionsBase.length === 0) {
    alert("Les questions sont en cours de chargement ou le fichier questions.json est vide.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * questionsBase.length);
  currentQuestion = questionsBase[randomIndex];
  
  hideAllScreens();

  if (currentQuestion.type === "vrai_faux") {
    document.getElementById("vf-question").innerText = currentQuestion.question;
    document.getElementById("screen-vf").classList.remove("hidden");
  } 
  else if (currentQuestion.type === "ordonnance") {
    document.getElementById("order-question").innerText = currentQuestion.question;
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

// 1. Vrai / Faux
function submitVF(userChoice) {
  const isCorrect = userChoice === currentQuestion.reponse_correcte;
  showResult(
    isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse",
    `Réponse attendue : ${currentQuestion.reponse_correcte ? 'VRAI' : 'FAUX'}`,
    currentQuestion.explication || ""
  );
}

// 2. Ordonnance
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

// 3. Rédaction avec véritable analyse IA via Groq
async function submitMethod() {
  const userText = document.getElementById("method-input").value;
  if (!userText.trim()) {
    alert("Veuillez saisir une réponse.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    alert("Clé API requise pour utiliser la correction automatique par l'IA.");
    return;
  }

  showResult(
    "⏳ Analyse IA en cours...",
    "Évaluation de votre réponse par l'IA...",
    "Vérification des notions clés et des synonymes..."
  );

  const promptSystem = `Tu es un instructeur pompier évaluand un candidat.
Compare la réponse du candidat à la réponse officielle du référentiel.
Sois souple sur la formulation : si le candidat utilise des synonymes ou des reformulations qui traduisent la bonne idée, valide la notion.

Question : ${currentQuestion.question}
Réponse officielle : ${currentQuestion.reponse_attendue}
Réponse du candidat : ${userText}

Réponds STRICTEMENT sous forme d'objet JSON valide avec cette structure (sans texte autour) :
{
  "statut": "VALIDE" ou "PARTIEL" ou "INCORRECT",
  "score": 85,
  "notions_presentes": ["notion 1", "notion 2"],
  "notions_manquantes": ["notion manquée"],
  "commentaire": "Analyse pédagogique personnalisée de la saisie."
}`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: promptSystem }],
        temperature: 0.1
      })
    });

    const data = await response.json();
    const resultIA = JSON.parse(data.choices[0].message.content);

    let badge = "✅";
    if (resultIA.statut === "PARTIEL") badge = "⚠️";
    if (resultIA.statut === "INCORRECT") badge = "❌";

    const statusHtml = `${badge} Résultat : ${resultIA.statut} (${resultIA.score}/100)`;
    const expectedText = `💡 **Analyse de votre réponse** :\n${resultIA.commentaire}`;
    
    const explanationText = `
✔ **Points retrouvés** : ${resultIA.notions_presentes.join(", ") || "Aucun"}
✖ **Points oubliés** : ${resultIA.notions_manquantes.join(", ") || "Aucun"}

📖 **Réponse officielle** : ${currentQuestion.reponse_attendue}
    `;

    showResult(statusHtml, expectedText, explanationText);

  } catch (error) {
    console.error(error);
    showResult(
      "❌ Erreur lors de l'analyse",
      "Vérifiez votre clé API Groq ou réessayez.",
      "Si la clé est incorrecte, vous pouvez réinitialiser la clé enregistrée en tapant localStorage.clear() dans la console de votre navigateur."
    );
  }
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
