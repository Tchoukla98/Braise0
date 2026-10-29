let questionsList = [];
let currentQuestion = null;

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

function resetApiKey() {
  localStorage.removeItem("groq_api_key");
  alert("🔑 La clé API a été effacée !");
}

function cleanAndParseJSON(rawContent) {
  let cleaned = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  // Si c'est un tableau JSON
  if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
  }

  // Si c'est un objet JSON
  if (firstBrace !== -1 && lastBrace !== -1) {
    return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
  }

  return JSON.parse(cleaned);
}

// L'IA lit le fichier .txt et extrait dynamiquement toutes les paires question/réponse
async function loadQuestionsWithIA() {
  const apiKey = getApiKey();
  if (!apiKey) return;

  try {
    const responseTxt = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!responseTxt.ok) throw new Error(`HTTP ${responseTxt.status}`);
    const textContent = await responseTxt.text();

    const promptSystem = `Tu es un parseur de document officiel pour pompiers.
Analyse le document fourni et extrait TOUTES les questions (ou consignes "Citez...", "Définition...") avec leurs réponses officielles associées.
Conserve le texte MOT À MOT.

Réponds STRICTEMENT sous forme d'un tableau JSON d'objets :
[
  {
    "type": "methode",
    "question": "Question ou consigne exacte du document",
    "reponse_attendue": "Réponse officielle mot à mot"
  }
]

Document :
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
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erreur API (${response.status}) : ${errText.substring(0, 100)}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    questionsList = cleanAndParseJSON(rawContent);

    console.log(`${questionsList.length} questions analysées et chargées par l'IA !`);

  } catch (error) {
    console.error("Erreur de parsing par l'IA :", error);
  }
}

// Initialisation au chargement
loadQuestionsWithIA();

// Tirage aléatoire instantané
async function startSession() {
  if (questionsList.length === 0) {
    showResult(
      "⏳ Chargement du référentiel...",
      "L'IA analyse le fichier Questionnaire-rengagement-COSS.txt...",
      "Veuillez patienter quelques secondes."
    );
    await loadQuestionsWithIA();
  }

  if (questionsList.length === 0) {
    showResult(
      "❌ Erreur de chargement",
      "Impossible d'analyser le fichier avec l'IA.",
      "Vérifiez votre clé API Groq ou rafraîchissez la page."
    );
    return;
  }

  const randomIndex = Math.floor(Math.random() * questionsList.length);
  currentQuestion = questionsList[randomIndex];

  hideAllScreens();
  document.getElementById("method-question").innerText = currentQuestion.question;
  document.getElementById("method-hint").innerHTML = "💡 Répondez précisément avec les termes officiels du référentiel.";
  document.getElementById("method-input").value = "";
  document.getElementById("screen-method").classList.remove("hidden");
}

function hideAllScreens() {
  document.getElementById("screen-start").classList.add("hidden");
  document.getElementById("screen-vf").classList.add("hidden");
  document.getElementById("screen-order").classList.add("hidden");
  document.getElementById("screen-method").classList.add("hidden");
  document.getElementById("screen-result").classList.add("hidden");
}

// Évaluation dynamique de la réponse par openai/gpt-oss-20b
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

Réponds STRICTEMENT sous la forme d'un objet JSON brut.

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
