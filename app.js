let questionsList = [];
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

// Nettoyage sécurisé du JSON
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

// Chargement et découpage local du fichier texte
async function loadQuestionsFromTxt() {
  try {
    const response = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    // Analyse du fichier texte (sépare par blocs de questions/réponses)
    const blocks = text.split(/\n\s*\n/);
    let tempQuestions = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;

      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length >= 2) {
        const questionText = lines[0];
        const answerText = lines.slice(1).join(" ");

        tempQuestions.push({
          type: "methode",
          question: questionText,
          reponse_attendue: answerText,
          methode_suggestion: "💡 **Méthode** : Répondez précisément avec les termes officiels du référentiel."
        });
      }
    }

    if (tempQuestions.length > 0) {
      questionsList = tempQuestions;
      console.log(`${questionsList.length} questions chargées avec succès !`);
    }
  } catch (error) {
    console.error("Erreur de chargement du fichier texte:", error);
  }
}

// Initialisation au chargement de la page
loadQuestionsFromTxt();

// Tirage aléatoire local instantané
async function startSession() {
  if (questionsList.length === 0) {
    await loadQuestionsFromTxt();
  }

  if (questionsList.length === 0) {
    alert("Chargement du questionnaire en cours ou fichier inaccessible...");
    return;
  }

  const randomIndex = Math.floor(Math.random() * questionsList.length);
  currentQuestion = questionsList[randomIndex];

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

// 3. Évaluation dynamique avec openai/gpt-oss-20b
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
      throw new Error(`HTTP ${response.status} : ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    const resultIA = cleanAndParseJSON(rawContent);

    let badge = "✅";
    if (resultIA.statut === "PARTIEL") badge = "⚠️";
    if (resultIA.statut === "INCORRECT") badge = "❌";

    const statusHtml = `${badge} Résultat : ${resultIA.statut} (${resultIA.score}/100)`;
    const expectedText = `💡 **Analyse de votre réponse** :\n${resultIA.commentaire}`;
    
    const explanationText = `
✔ **Points retrouvés** : ${(resultIA.notions_presentes || []).join(", ") || "Aucun"}
✖ **Points oubliés** : ${(resultIA.notions_manquantes || []).join(", ") || "Aucun"}

📖 **Réponse officielle** : ${currentQuestion.reponse_attendue}
    `;

    showResult(statusHtml, expectedText, explanationText);

  } catch (error) {
    console.error("Erreur lors de l'analyse :", error);
    showResult(
      "❌ Erreur lors de l'analyse",
      `Détail technique : ${error.message}`,
      "Réessayez ou vérifiez votre saisie."
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
