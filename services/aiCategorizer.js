
const { InferenceClient } = require("@huggingface/inference");

const categories = [
  "Workshop",
  "Placement",
  "Academics",
  "Event",
  "General"
];

async function categorizePost(title, content) {
  const text = `${title || ""}\n${content || ""}`.trim();

  if (!text) {
    return "General";
  }

  if (!process.env.HF_TOKEN) {
    console.error("AI ERROR: HF_TOKEN is missing from .env");
    return "General";
  }

  try {
    const client = new InferenceClient(process.env.HF_TOKEN);

    console.log("AI: Categorizing post...");

    const result = await client.zeroShotClassification({
      model: "facebook/bart-large-mnli",
      inputs: text,
      parameters: {
        candidate_labels: categories
      }
    });

    console.log("AI classification result:", result);

    if (!Array.isArray(result) || result.length === 0) {
      console.error("AI ERROR: Empty classification result");
      return "General";
    }

    const predictedCategory = result[0]?.label;

    if (!categories.includes(predictedCategory)) {
      console.error("AI ERROR: Invalid category:", predictedCategory);
      return "General";
    }

    console.log("AI predicted category:", predictedCategory);

    return predictedCategory;

  } catch (error) {
    console.error("AI CATEGORIZATION ERROR:", error.message);
    return "General";
  }
}

module.exports = { categorizePost };
