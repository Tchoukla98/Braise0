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

// Réinitialiser la clé API depuis un bouton
function resetApiKey() {
  localStorage.removeItem("groq_api_key");
  alert("🔑 La clé API a été effacée ! Une nouvelle clé vous sera demandée.");
}

// Fonction de tirage dynamique : lit le fichier .txt et extrait une question MOT À MOT via l'IA
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
    // Read the text file directly from GitHub root
    const responseTxt = await fetch('Questionnaire-rengagement-COSS.txt');
    if (!responseTxt.ok) {
      throw new Error(`Impossible de charger le fichier texte (HTTP ${responseTxt.status})`);
    }
    const textContent = await responseTxt.text();

    const promptSystem = `Tu es un extraitur de questions pour un concours de sapeurs-pompiers.
À partir du texte du référentiel fourni ci-dessous, sélectionne UNE question de manière complètement ALEATOIRE.
Tu dois reprendre la question ET la réponse attendue STRICTEMENT MOT À MOT, à l'identique du document, sans modifier une seule virgule ni inventer du texte.

Réponds STRICTEMENT sous forme d'un objet JSON valide au format suivant (sans texte ni balises autour) :

Si c'est une question rédigée / méthode :
{
  "type": "methode",
  "question": "Texte exact de la question du document",
  "reponse_attendue": "Texte exact de la réponse officielle du document",
  "methode_suggestion": "💡 **Méthode** : Répondez précisément avec les termes officiels."
}

Si la question demande de remettre dans l'ordre des éléments (ex: MGO ou SECURITE) :
{
  "type": "ordonnance",
  "question": "Texte exact de la question",
  "elements_a_ordonner": ["Étape 1", "Étape 2", "Étape 3"]
}

Si c'est une affirmation Vrai / Faux :
{
  "type": "vrai_faux",
  "question": "Texte exact de l'affirmation",
  "reponse_correcte": false,
  "explication": "Explication exacte tirée du document"
}

Texte source du référentiel :
${textContent}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: promptSystem }],
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const errDetails = data.error ? data.error.message : `Code HTTP ${response.status}`;
      showResult("❌ Erreur Groq", `Erreur : ${errDetails}`, "Vérifiez votre clé API.");
      return;
    }

    let content = data.choices[0].message.content.trim();
    if (content.startsWith("```json")) {
      content = content.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    currentQuestion = JSON.parse(content);

    // Affichage dynamique de la question extraite
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

  } catch (error) {
    console.error(error);
    showResult(
      "❌ Erreur lors du tirage",
      `Détail : ${error.message}`,
      "Assurez-vous que le fichier 'Questionnaire-rengagement-COSS.txt' est bien présent à la racine de votre dépôt GitHub."
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

// 3. Evaluation dynamique de la réponse rédigée par le modèle openai/gpt-oss-20b
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

  const promptEvaluation = `Tu es un instructeur pompier évaluand un candidat.
Compare la réponse du candidat à la réponse officielle du référentiel.
Sois souple sur la formulation : si le candidat utilise des synonymes ou des reformulations qui traduisent la bonne idée, valide la notion.

Question : ${currentQuestion.question}
Réponse officielle : ${currentQuestion.reponse_attendue}
Réponse saisie par le candidat : ${userText}

Réponds STRICTEMENT sous forme d'un objet JSON valide avec cette structure (sans aucun texte autour) :
{
  "statut": "VALIDE" ou "PARTIEL" ou "INCORRECT",
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

    const data = await response.json();
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
    showResult(
      "❌ Erreur lors de l'analyse",
      `Message technique : ${error.message}`,
      "Réessayez ou vérifiez votre connexion."
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
