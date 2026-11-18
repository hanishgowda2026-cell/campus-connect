
const { InferenceClient } = require("@huggingface/inference");

const client = new InferenceClient(process.env.HF_TOKEN);

const categories = [
  "Workshop",
  "Placement",
  "Academics",
  "Event",
  "General"
];

async function categorizePost(title, content) {
  const text = `${title}\n${content}`;

  const result = await client.zeroShotClassification({
    model: "facebook/bart-large-mnli",
    inputs: text,
    parameters: {
      candidate_labels: categories
    }
  });

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error("AI classification returned no results");
  }

  return result[0].label;
}

module.exports = { categorizePost };
