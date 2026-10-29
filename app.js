let questionsList = [];
let currentQuestion = null;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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

// Nettoyage JSON des réponses de l'IA
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

// Chargement à partir des balises <Q> et <R>
async function loadQuestionsFromTxt() {
  try {
    const response = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();

    const regex = /<Q>([\s\S]*?)<\/Q>[\s\n\r]*<R>([\s\S]*?)<\/R>/g;
    let match;
    let tempQuestions = [];

    while ((match = regex.exec(text)) !== null) {
      const questionText = match[1].replace(/[\r\n]+/g, " ").trim();
      const answerText = match[2].replace(/[\r\n]+/g, " ").trim();

      if (questionText && answerText) {
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

// Tirage aléatoire instantané local
async function startSession() {
  if (questionsList.length === 0) {
    await loadQuestionsFromTxt();
  }

  if (questionsList.length === 0) {
    alert("Chargement du questionnaire en cours ou fichier 'Questionnaire-rengagement-COSS.txt' inaccessible...");
    return;
  }

  const randomIndex = Math.floor(Math.random() * questionsList.length);
  currentQuestion = questionsList[randomIndex];

  hideAllScreens();
  document.getElementById("method-question").innerText = currentQuestion.question;
  document.getElementById("method-hint").innerHTML = currentQuestion.methode_suggestion;
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

// Évaluation dynamique avec calcul mathématique du score et tolérance accrue
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

  const promptEvaluation = `Tu es un instructeur pompier évaluant un candidat lors d'un examen.
Compare la réponse du candidat à la réponse officielle du référentiel.

DIRECTIVES DE CORRECTION :
1. SOIS TRÈS SOUPLE sur la formulation et le vocabulaire :
   - Accepte les synonymes équivalents ou appellations alternatives (ex: "jet bâton" ou "jet plein", "trottoir" ou "voie publique / chaussée", "soustraire" ou "extraire").
   - Ne sanctionne PAS les fautes de frappe légères si l'intention technique est claire.
2. Découpe la réponse officielle en "notions_presentes" (notions du référentiel retrouvées chez le candidat) et "notions_manquantes" (notions officiellement requises mais omises).

Question : ${safeQuestion}
Réponse officielle : ${safeOfficial}
Réponse saisie par le candidat : ${safeUserText}

Réponds STRICTEMENT sous la forme d'un objet JSON brut.

Format JSON attendu :
{
  "statut": "VALIDE",
  "notions_presentes": ["notion 1", "notion 2"],
  "notions_manquantes": [],
  "commentaire": "Analyse pédagogique personnalisée de la saisie."
}`;

  try {
    const response = await fetch(GROQ_API_URL, {
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

    const retrouvees = resultIA.notions_presentes || [];
    const manquees = resultIA.notions_manquantes || [];
    const totalNotions = retrouvees.length + manquees.length;

    // Calcul du score réel au prorata
    let calculatedScore = 100;
    if (totalNotions > 0) {
      calculatedScore = Math.round((retrouvees.length / totalNotions) * 100);
    }

    // Détermination dynamique du statut et de l'émoji
    let badge = "✅";
    let statutTxt = "VALIDE";

    if (calculatedScore < 50 || resultIA.statut === "INCORRECT" || resultIA.statut === "INVALID") {
      badge = "❌";
      statutTxt = "INCORRECT";
    } else if (calculatedScore < 100 || resultIA.statut === "PARTIEL") {
      badge = "⚠️";
      statutTxt = "PARTIEL";
    }

    const statusHtml = `${badge} Résultat : ${statutTxt} (${calculatedScore}/100)`;
    const expectedText = `💡 **Analyse de votre réponse** :\n${resultIA.commentaire}`;
    
    const explanationText = `
✔ **Points retrouvés** : ${retrouvees.join(", ") || "Aucun"}
✖ **Points oubliés** : ${manquees.join(", ") || "Aucun"}

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
