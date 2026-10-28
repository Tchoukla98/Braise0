// Questions par défaut au cas où le JSON ne charge pas immédiatement
let questionsBase = [
  {
    "id": 1,
    "type": "vrai_faux",
    "categorie": "GAZ",
    "question": "Il est autorisé de manœuvrer un barrage de gaz où l'indication 'Réseau' apparaît.",
    "reponse_correcte": false,
    "explication": "Il est strictly interdit de manœuvrer un barrage où la mention 'réseau' apparaît."
  },
  {
    "id": 2,
    "type": "methode",
    "categorie": "Incendie",
    "question": "Comment opérer sur un feu en espace clos ou semi-clos ?",
    "methode_suggestion": "💡 **Méthode suggérée** : Répondez sous forme de réflexes de sécurité (position, chemin de repli, réglage de lance).",
    "reponse_attendue": "Se placer en position basse côté ouvrant, prévoir un chemin de repli, estimer la chaleur (portes/poignées), chercher les signes thermiques, rendre compte au chef d'agrès, régler la lance en jet diffusé d'attaque (500 L/min) et ouvrir prudemment.",
    "explication_ia": "Analyse de l'IA : Assurez-vous d'avoir mentionné la position basse, le débit de 500 l/min et le compte rendu immédiat."
  }
];

let currentQuestion = null;

// Chargement dynamique depuis questions.json
fetch('questions.json')
  .then(response => response.json())
  .then(data => {
    if (Array.isArray(data) && data.length > 0) {
      questionsBase = data;
      console.log("Questions JSON chargées avec succès !");
    }
  })
  .catch(error => console.warn("Fichier questions.json non trouvé, utilisation de la base par défaut.", error));

// Gestion de la clé API Groq
function getApiKey() {
  let key = localStorage.getItem("groq_api_key");
  if (!key) {
    key = prompt("Entrez votre clé API Groq (gsk_...) :");
    if (key) {
      key = key.trim();
      localStorage.setItem("groq_api_key", key);
    }
  }
  return key;
}

// Pour réinitialiser la clé si besoin
function resetApiKey() {
  localStorage.removeItem("groq_api_key");
  alert("Clé API effacée !");
}

// Lancer une session aléatoire
function startSession() {
  if (questionsBase.length === 0) {
    alert("Les questions sont en cours de chargement...");
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

// 1. Soumission Vrai / Faux
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

// 3. Soumission Rédaction avec Débug de la Clé Groq
async function submitMethod() {
  const userText = document.getElementById("method-input").value;
  if (!userText.trim()) {
    alert("Veuillez saisir une réponse.");
    return;
  }

  let apiKey = getApiKey();
  if (apiKey) {
    apiKey = apiKey.trim();
    localStorage.setItem("groq_api_key", apiKey);
  }

  if (!apiKey) {
    alert("Clé API requise pour utiliser la correction par l'IA.");
    return;
  }

  showResult(
    "⏳ Analyse IA en cours...",
    "Évaluation de votre réponse par l'IA...",
    "Vérification des notions clés et des synonymes..."
  );

  const promptSystem = `Tu es un instructeur pompier évaluant un candidat.
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
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: promptSystem }],
        temperature: 0.1
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errDetails = data.error ? data.error.message : `Code HTTP ${response.status}`;
      const keyPreview = apiKey.length > 8 
        ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` 
        : apiKey;

      showResult(
        "❌ Erreur de connexion Groq",
        `Détail de l'erreur : ${errDetails}`,
        `🔑 Clé utilisée : "${keyPreview}" (Longueur : ${apiKey.length} car.)`
      );
      return;
    }

    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    const resultIA = JSON.parse(content);

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
    const keyPreview = apiKey.length > 8 
      ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` 
      : apiKey;

    showResult(
      "❌ Erreur lors de l'analyse",
      `Message technique : ${error.message}`,
      `🔑 Clé actuellement enregistrée : "${keyPreview}" (Longueur : ${apiKey.length})`
    );
  }
}

// Affichage des résultats
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
