let currentQuestion = null;

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

// Réinitialiser la clé API
function resetApiKey() {
  localStorage.removeItem("groq_api_key");
  alert("🔑 La clé API a été effacée ! Une nouvelle clé vous sera demandée.");
}

// Nettoyage sécurisé du JSON renvoyé par l'IA
function cleanAndParseJSON(rawContent) {
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

// Tirage dynamique depuis le fichier texte
async function startSession() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  hideAllScreens();
  showResult(
    "⏳ Consultation du référentiel...",
    "L'IA extrait une question officielle mot à mot depuis Questionnaire-rengagement-COSS.txt...",
    "Veuillez patienter quelques secondes."
  );

  try {
    const responseTxt = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!responseTxt.ok) {
      throw new Error(`Impossible de charger le fichier texte (HTTP ${responseTxt.status})`);
    }
    const textContent = await responseTxt.text();

    const promptSystem = `Tu es un système d'extraction pour le concours pompier.
À partir du texte officiel ci-dessous, sélectionne UNE question au hasard.
Tu dois reprendre la question ET la réponse attendue STRICTEMENT MOT À MOT du document.

Réponds STRICTEMENT sous la forme d'un objet JSON brut. Ne mets aucun texte, aucune explication, ni balise markdown autour.

Format JSON :
{
  "type": "methode",
  "question": "Texte exact de la question du document",
  "reponse_attendue": "Texte exact de la réponse officielle du document",
  "methode_suggestion": "💡 **Méthode** : Répondez précisément avec les termes officiels."
}

Texte du référentiel :
${textContent}`;

    const response = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: promptSystem }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur API Groq (${response.status}) : ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    currentQuestion = cleanAndParseJSON(rawContent);

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
    else {
      document.getElementById("method-question").innerText = currentQuestion.question;
      document.getElementById("method-hint").innerHTML = currentQuestion.methode_suggestion || "💡 Lisez attentivement la question.";
      document.getElementById("method-input").value = "";
      document.getElementById("screen-method").classList.remove("hidden");
    }

  } catch (error) {
    console.error(error);
    showResult(
      "❌ Erreur lors du tirage",
      `Détail : ${error.message}`,
      "Vérifiez le fichier texte ou votre clé API."
    );
  }
}

function hideAllScreens() {
  document.getElementById("screen-start").classList.add("hidden");
  document.getElementById("screen-vf").classList.add("hidden");
  document.getElementById("screen-order").classList.add("hidden");
  document.getElementById("screen-method").classList.add("hidden");
  document.getElementById("screen-result").classList.add("hidden");
}

// 1. Validation Vrai / Faux
function submitVF(userChoice) {
  const isCorrect = userChoice === currentQuestion.reponse_correcte;
  showResult(
    isCorrect ? "✅ Bonne réponse !" : "❌ Mauvaise réponse",
    `Réponse attendue : ${currentQuestion.reponse_correcte ? 'VRAI' : 'FAUX'}`,
    currentQuestion.explication || ""
  );
}

// 2. Validation Ordonnance
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

// 3. Évaluation dynamique avec encodage sécurisé des textes
async function submitMethod() {
  const userText = document.getElementById("method-input").value;
  if (!userText.trim()) {
    alert("Veuillez saisir une réponse.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) return;

  showResult(
    "⏳ Correction par l'IA...",
    "Analyse de votre saisie par le modèle openai/gpt-oss-20b...",
    "Vérification des notions clés et des synonymes..."
  );

  // Sécurisation complète contre les caractères spéciaux / guillemets
  const safeQuestion = JSON.stringify(currentQuestion.question || "");
  const safeOfficial = JSON.stringify(currentQuestion.reponse_attendue || "");
  const safeUserText = JSON.stringify(userText);

  const promptEvaluation = `Tu es un instructeur pompier évaluant un candidat.
Compare la réponse du candidat à la réponse officielle du référentiel.
Sois souple sur la formulation : si le candidat utilise des synonymes ou des reformulations qui traduisent la bonne idée, valide la notion.

Question : ${safeQuestion}
Réponse officielle : ${safeOfficial}
Réponse saisie par le candidat : ${safeUserText}

Réponds STRICTEMENT sous la forme d'un objet JSON brut (sans texte ni markdown).

Format JSON attendu :
{
  "statut": "VALIDE",
  "score": 85,
  "notions_presentes": ["notion 1", "notion 2"],
  "notions_manquantes": ["notion manquée"],
  "commentaire": "Analyse pédagogique personnalisée de la saisie."
}`;

  try {
    const response = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: promptEvaluation }],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Code HTTP ${response.status} - Réponse : ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    const resultIA = cleanAndParseJSON(rawContent);

    let badge = "✅";
    if (resultIA.
