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
// Clé API (À configurer ou demander à l'utilisateur)
// Récupérer la clé sauvegardée dans le navigateur
function getApiKey() {
  return localStorage.getItem("groq_api_key") || "";
}

// Fonction pour sauvegarder la clé saisie par l'utilisateur
function saveApiKey(key) {
  localStorage.setItem("groq_api_key", key.trim());
  alert("Clé API sauvegardée !");
}HL8"; 

async function submitMethod() {
const API_KEY = getApiKey();

if (!API_KEY) {
  const userKey = prompt("Veuillez entrer votre clé API Groq (gsk_...) :");
  if (userKey) {
    saveApiKey(userKey);
    location.reload();
  }
  return;
}

  // Afficher un message de chargement pendant que l'IA réfléchit
  showResult(
    "⏳ Analyse IA en cours...",
    "Veuillez patienter pendant l'évaluation de votre réponse...",
    "L'IA vérifie la présence des notions clés et des synonymes."
  );

  // Construction du prompt envoyé à l'IA
  const promptSystem = `Tu es un instructeur pompier sévère mais juste. 
Ta mission est d'évaluer la réponse d'un candidat par rapport à la réponse officielle du référentiel.
Sois souple sur la formulation : si le candidat utilise des synonymes ou des mots différents qui signifient la même chose, valide la notion.

Question : ${currentQuestion.question}
Réponse officielle : ${currentQuestion.reponse_attendue}
Réponse saisie par le candidat : ${userText}

Réponds STRICTEMENT au format JSON suivant sans autre texte :
{
  "statut": "VALIDE" | "PARTIEL" | "INCORRECT",
  "score": 85,
  "notions_presentes": ["liste des points clés trouvés"],
  "notions_manquantes": ["liste des points clés oubliés"],
  "commentaire": "Explication pédagogique et ajustements nécessaires."
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Modèle ultra-rapide et économique
        messages: [{ role: "user", content: promptSystem }],
        temperature: 0.2
      })
    });

    const data = await response.json();
    const resultIA = JSON.parse(data.choices[0].message.content);

    // Définition de la couleur/icône selon le résultat
    let icon = "✅";
    if (resultIA.statut === "PARTIEL") icon = "⚠️";
    if (resultIA.statut === "INCORRECT") icon = "❌";

    // Formatage du résultat
    const statusText = `${icon} Statut : ${resultIA.statut} (${resultIA.score}/100)`;
    const expectedText = `💡 **Commentaire IA** : ${resultIA.commentaire}`;
    
    const explanationText = `
✔ **Points validés** : ${resultIA.notions_presentes.join(", ") || "Aucun"}
✖ **Points manquants** : ${resultIA.notions_manquantes.join(", ") || "Aucun"}

📖 **Rappel officiel** : ${currentQuestion.reponse_attendue}
    `;

    showResult(statusText, expectedText, explanationText);

  } catch (error) {
    console.error(error);
    showResult(
      "⚠️ Erreur d'analyse",
      "Impossible de contacter l'IA.",
      "Vérifiez votre clé API ou retentez l'opération."
    );
  }
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
