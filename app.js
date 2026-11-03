let questionsList = [];
let remainingQuestions = []; // Pile de travail des questions non encore posées
let currentQuestion = null;
let customDocuments = {};
let currentDocId = null;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Initialisation au chargement de la page
window.addEventListener("DOMContentLoaded", async () => {
  loadCustomDocuments();
  updateDocSelector();
  await initDefaultDocument();
});

// --- GESTION DE LA CLÉ API ---
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
  alert("🔑 La clé API a été effacée ! Une nouvelle clé vous sera demandée.");
}

// --- GESTION DES PARAMÈTRES ET DOCUMENTS ---
function showSettings() {
  hideAllScreens();
  renderSavedDocsList();
  document.getElementById("screen-settings").classList.remove("hidden");
}

function loadCustomDocuments() {
  const saved = localStorage.getItem("braise0_custom_docs");
  if (saved) {
    try { customDocuments = JSON.parse(saved); } catch (e) { customDocuments = {}; }
  }
}

function saveCustomDocuments() {
  localStorage.setItem("braise0_custom_docs", JSON.stringify(customDocuments));
  updateDocSelector();
  renderSavedDocsList();
}

function updateDocSelector() {
  const selector = document.getElementById("doc-selector");
  if (!selector) return;
  selector.innerHTML = '<option value="default">Questionnaire COSS (Défaut)</option>';
  
  for (const docId in customDocuments) {
    const option = document.createElement("option");
    option.value = docId;
    option.innerText = customDocuments[docId].title;
    selector.appendChild(option);
  }
}

function renderSavedDocsList() {
  const listEl = document.getElementById("saved-docs-list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const keys = Object.keys(customDocuments);
  if (keys.length === 0) {
    listEl.innerHTML = "<li><em>Aucun document personnalisé importé.</em></li>";
    return;
  }

  keys.forEach(docId => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${customDocuments[docId].title}</strong> (${customDocuments[docId].questions.length} questions)
      <button onclick="deleteDocument('${docId}')" class="btn-danger-sm">🗑️ Supprimer</button>
    `;
    listEl.appendChild(li);
  });
}

function deleteDocument(docId) {
  if (confirm("Voulez-vous vraiment supprimer ce document ?")) {
    delete customDocuments[docId];
    saveCustomDocuments();
  }
}

// --- IMPORTATION ET EXTRACTION (PDF / TXT) ---
async function handleFileUpload() {
  const titleInput = document.getElementById("import-title");
  const fileInput = document.getElementById("import-file");

  const title = titleInput.value.trim();
  const file = fileInput.files[0];

  if (!title || !file) {
    alert("Veuillez remplir le titre et sélectionner un fichier.");
    return;
  }

  let textContent = "";

  try {
    if (file.name.endsWith(".pdf")) {
      textContent = await extractTextFromPDF(file);
    } else {
      textContent = await file.text();
    }

    const extractedQuestions = parseBalisesText(textContent);

    if (extractedQuestions.length === 0) {
      alert("⚠️ Aucune question trouvée dans le fichier.");
      return;
    }

    const docId = "doc_" + Date.now();
    customDocuments[docId] = {
      title: title,
      questions: extractedQuestions
    };

    saveCustomDocuments();
    titleInput.value = "";
    fileInput.value = "";
    alert(`✅ Document "${title}" enregistré avec succès (${extractedQuestions.length} questions) !`);

  } catch (error) {
    console.error(error);
    alert("Erreur lors de la lecture du fichier : " + error.message);
  }
}

async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

// Extraction robuste tolérant les balises imparfaites
function parseBalisesText(text) {
  let tempQuestions = [];
  const regex = /<Q>([\s\S]*?)(?:<\/Q>|<\/R>|\n\s*<R>)[\s\n\r]*<R>([\s\S]*?)<\/R>/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    let q = match[1].replace(/<[^>]+>/g, "").replace(/[\r\n]+/g, " ").trim();
    let r = match[2].replace(/<[^>]+>/g, "").replace(/[\r\n]+/g, " ").trim();

    if (q && r) {
      tempQuestions.push({
        type: "methode",
        question: q,
        reponse_attendue: r,
        methode_suggestion: "💡 **Méthode** : Répondez précisément avec les termes officiels du référentiel."
      });
    }
  }

  if (tempQuestions.length === 0) {
    const altRegex = /([^?:\n\r][^?:\r\n]*[?:])\s*([\s\S]*?)(?=(?:[^?:\n\r][^?:\r\n]*[?:])|$)/g;
    while ((match = altRegex.exec(text)) !== null) {
      const q = match[1].replace(/[\r\n]+/g, " ").trim();
      const r = match[2].replace(/[\r\n]+/g, " ").trim();
      if (q.length > 5 && r.length > 0) {
        tempQuestions.push({
          type: "methode",
          question: q,
          reponse_attendue: r,
          methode_suggestion: "💡 **Méthode** : Répondez précisément avec les termes officiels du référentiel."
        });
      }
    }
  }

  return tempQuestions;
}

// Chargement initial du document par défaut
async function initDefaultDocument() {
  try {
    const response = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    questionsList = parseBalisesText(text);
    
    if (remainingQuestions.length === 0 && currentDocId !== "default") {
      remainingQuestions = [...questionsList];
      currentDocId = "default";
    }
  } catch (error) {
    console.error("Erreur de chargement du fichier par défaut:", error);
  }
}

// --- TIRAGE STRICTEMENT SANS DOUBLON ---
async function startSession() {
  const selectedDocId = document.getElementById("doc-selector").value;

  if (currentDocId !== selectedDocId) {
    currentDocId = selectedDocId;
    if (selectedDocId === "default") {
      if (questionsList.length === 0) await initDefaultDocument();
      remainingQuestions = [...questionsList];
    } else if (customDocuments[selectedDocId]) {
      remainingQuestions = [...customDocuments[selectedDocId].questions];
    }
  }

  if (remainingQuestions.length === 0) {
    const sourcePool = (selectedDocId === "default") ? questionsList : customDocuments[selectedDocId].questions;
    alert("🔄 Félicitations ! Vous avez parcouru la totalité des questions du document. Le cycle redémarre.");
    remainingQuestions = [...sourcePool];
  }

  if (remainingQuestions.length === 0) {
    alert("Aucune question disponible pour ce document.");
    return;
  }

  const randomIndex = Math.floor(Math.random() * remainingQuestions.length);
  currentQuestion = remainingQuestions.splice(randomIndex, 1)[0];

  hideAllScreens();
  document.getElementById("method-question").innerText = currentQuestion.question;
  document.getElementById("method-hint").innerHTML = `${currentQuestion.methode_suggestion} <br><em>(Reste : ${remainingQuestions.length} question(s) non posée(s))</em>`;
  document.getElementById("method-input").value = "";
  document.getElementById("screen-method").classList.remove("hidden");
}

function hideAllScreens() {
  document.getElementById("screen-start").classList.add("hidden");
  document.getElementById("screen-settings").classList.add("hidden");
  document.getElementById("screen-method").classList.add("hidden");
  document.getElementById("screen-result").classList.add("hidden");
}

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

// --- ÉVALUATION AVEC OPENAI/GPT-OSS-20B VIA GROQ ---
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

DIRECTIVES D'ÉVALUATION :
1. VALIDE LES ÉQUIVALENCES CONCEPTUELLES ET DE TERRAIN :
   - "elle-même" = "d'elle-même" (VALIDE, ne sanctionne PAS les légères différences de préposition ou d'apostrophe "d' / de / à").
   - "sur le palier" = "à l'étage" (VALIDE)
   - "chaussée" ou "voie publique" = "trottoir" (VALIDE)
   - "en bas de la cage d'escalier" ou "pied de conduite" = "pied de conduite montante" (VALIDE)
   - "soustraire" = "extraire" (VALIDE)
   - "jet bâton" = "jet plein ou bâton" (VALIDE)
2. Ne cherche PAS les termes exacts au mot près. Si l'idée technique ou la localisation opérationnelle correspond à la réponse officielle, ajoute la notion dans "notions_presentes" et ne la mets SURTOUT PAS dans "notions_manquantes".
3. Découpe la réponse officielle en éléments clés et classe-les uniquement selon la présence de l'idée chez le candidat.

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

    let calculatedScore = 100;
    if (totalNotions > 0) {
      calculatedScore = Math.round((retrouvees.length / totalNotions) * 100);
    }

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
    
    // Encart 1 : Votre réponse + Analyse
    const explanationText = `
✍️ **Votre réponse** : ${userText}

✔ **Points retrouvés** : ${retrouvees.join(", ") || "Aucun"}
✖ **Points oubliés** : ${manquees.join(", ") || "Aucun"}

📖 **Réponse officielle** : ${currentQuestion.reponse_attendue}
    `;

    // Encart 2 : Commentaire IA
    const expectedText = `💡 **Commentaire détaillé de l'IA** :\n${resultIA.commentaire}`;

    showResult(statusHtml, explanationText, expectedText);

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
