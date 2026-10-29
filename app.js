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

// Tirage dynamique : lit Questionnaire-rengagement-COSS.txt et extrait une question MOT À MOT via openai/gpt-oss-20b
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

    const promptSystem = `Tu es un extracteur de questions pour un concours de sapeurs-pompiers.
À partir du texte du référentiel fourni ci-dessous, sélectionne UNE question de manière complètement ALÉATOIRE.
Tu dois reprendre la question ET la réponse attendue STRICTEMENT MOT À MOT, à l'identique du document, sans modifier une seule virgule ni inventer du texte.

IMPORTANT: Tu dois répondre UNIQUEMENT sous forme d'un objet JSON valide. Ne rajoute AUCUN texte, explication, ni balise HTML ou markdown autour du JSON.

Format JSON attendu :

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

    let rawContent = data.choices[0].message.content.trim();

    // Isolation stricte du bloc JSON pour éviter les erreurs de parsing
    const firstBrace = rawContent.indexOf("{");
    const lastBrace = rawContent.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      rawContent = rawContent.substring(firstBrace, lastBrace + 1);
    }

    currentQuestion = JSON.parse(rawContent);

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
      document.getElementById("method-question").innerText = current
